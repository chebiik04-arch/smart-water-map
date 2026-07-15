import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadCountyAoisFromShapefile } from "../src/services/shapefileParser.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const sensorTypes = ["GROUNDWATER", "SOIL_MOISTURE", "RAINFALL", "WEATHER"];
const sourceTypes = ["BOREHOLE", "WATER_POINT", "RIVER", "RESERVOIR"];
const riskLevels = ["NORMAL", "WATCH", "WARNING", "EMERGENCY"];

async function main() {
  const tenant = await ensureTenant();
  const admin = await ensureAdmin(tenant.id);
  const countyAois = await loadCountyAoisFromShapefile({
    shpPath: path.join(projectRoot, "counties", "County.shp"),
    dbfPath: path.join(projectRoot, "counties", "County.dbf")
  });

  let districtsSeeded = 0;
  for (const [index, county] of countyAois.entries()) {
    const district = await ensureDistrictForAoi(county, tenant.id, index);
    await refreshAoiSampleData({ district, county, index, userId: admin.id });
    districtsSeeded += 1;
  }

  console.info(`Seeded sample data for ${districtsSeeded} AOI counties`);
}

async function ensureTenant() {
  const existing = await prisma.tenant.findFirst({ where: { slug: "kenya-pilot" } });
  if (existing) return existing;
  return prisma.tenant.create({
    data: { name: "Kenya Drought Response Pilot", slug: "kenya-pilot", country: "Kenya" }
  });
}

async function ensureAdmin(tenantId) {
  const existing = await prisma.user.findFirst({ where: { tenantId, role: "admin" } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash("AdminPass123", 12);
  return prisma.user.create({
    data: {
      tenantId,
      name: "Platform Admin",
      email: "admin@smartwater.local",
      passwordHash,
      role: "admin",
      district: "Kenya",
      points: 120
    }
  });
}

async function ensureDistrictForAoi(county, tenantId, index) {
  const polygonGeometry = districtPolygonGeometry(county.geometry);
  const risk = riskLevels[index % riskLevels.length];
  const [existing] = await prisma.$queryRaw`
    SELECT id, name FROM "District" WHERE name = ${county.name} LIMIT 1
  `;

  if (existing) {
    await prisma.$executeRaw`
      UPDATE "District"
      SET "tenantId" = ${tenantId}::uuid,
        geometry = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(polygonGeometry)}), 4326),
        "droughtRiskLevel" = ${risk}::"DroughtRiskLevel"
      WHERE id = ${existing.id}::uuid
    `;
    return { id: existing.id, name: county.name };
  }

  const [created] = await prisma.$queryRaw`
    INSERT INTO "District" (id, "tenantId", name, geometry, "droughtRiskLevel", "createdAt")
    VALUES (gen_random_uuid(), ${tenantId}::uuid, ${county.name},
      ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(polygonGeometry)}), 4326),
      ${risk}::"DroughtRiskLevel", NOW())
    RETURNING id, name
  `;
  return created;
}

async function refreshAoiSampleData({ district, county, index, userId }) {
  const points = samplePoints(county.geometry, 7);
  const months = yearMonths();
  const baseRainfall = 38 + (index % 9) * 8;
  const riskScore = Number((0.24 + (index % 12) * 0.055).toFixed(2));
  const riskLevel = riskLevels[index % riskLevels.length];

  for (const [monthIndex, month] of months.entries()) {
    await prisma.rainfallRecord.upsert({
      where: { districtId_month_source: { districtId: district.id, month, source: "AOI seed" } },
      update: { mmTotal: rainfallValue(baseRainfall, monthIndex, index) },
      create: {
        districtId: district.id,
        month,
        mmTotal: rainfallValue(baseRainfall, monthIndex, index),
        source: "AOI seed"
      }
    });
  }

  await prisma.nDVIReading.deleteMany({ where: { districtId: district.id, source: "AOI seed" } });
  for (const [monthIndex, month] of months.entries()) {
    await prisma.nDVIReading.create({
      data: {
        districtId: district.id,
        value: Number(Math.max(0.12, Math.min(0.82, 0.67 - riskScore * 0.32 - monthIndex * 0.018 + (index % 5) * 0.018)).toFixed(2)),
        capturedAt: new Date(`${month}-15T00:00:00.000Z`),
        source: "AOI seed"
      }
    });
  }

  await seedSensors({ district, points, index });
  await seedWaterSources({ district, points, index, months });
  await seedForecast({ district, index, riskScore, riskLevel });
  await seedReports({ district, points, index, userId });
}

async function seedSensors({ district, points, index }) {
  for (const [typeIndex, type] of sensorTypes.entries()) {
    const externalId = `AOI-${slugify(district.name)}-${type}`;
    const point = points[typeIndex % points.length];
    const [existingDevice] = await prisma.$queryRaw`
      SELECT "sensorId" FROM "SensorDevice" WHERE "externalId" = ${externalId} LIMIT 1
    `;
    let sensorId = existingDevice?.sensorId;

    if (sensorId) {
      await prisma.$executeRaw`
        UPDATE "Sensor"
        SET type = ${type}::"SensorType",
          location = ST_SetSRID(ST_MakePoint(${point[0]}, ${point[1]}), 4326),
          "districtId" = ${district.id}::uuid,
          status = 'ONLINE'::"SensorStatus",
          "lastPing" = NOW() - (${typeIndex} || ' hours')::interval
        WHERE id = ${sensorId}::uuid
      `;
    } else {
      const [sensor] = await prisma.$queryRaw`
        INSERT INTO "Sensor" (id, type, location, "districtId", status, "lastPing")
        VALUES (gen_random_uuid(), ${type}::"SensorType",
          ST_SetSRID(ST_MakePoint(${point[0]}, ${point[1]}), 4326),
          ${district.id}::uuid, 'ONLINE'::"SensorStatus", NOW() - (${typeIndex} || ' hours')::interval)
        RETURNING id
      `;
      sensorId = sensor.id;
      await prisma.sensorDevice.create({
        data: {
          sensorId,
          externalId,
          authTokenHash: `seed-${externalId}`,
          provider: "aoi_seed",
          metadata: { county: district.name, index }
        }
      });
    }

    await prisma.sensorReading.deleteMany({ where: { sensorId } });
    for (let day = 13; day >= 0; day -= 1) {
      await prisma.sensorReading.create({
        data: {
          sensorId,
          value: sensorValue(type, index, day),
          unit: sensorUnit(type),
          timestamp: daysAgo(day),
          metadata: { source: "AOI seed", battery: 82 - (day % 6) }
        }
      });
    }
  }
}

async function seedWaterSources({ district, points, index, months }) {
  for (const [sourceIndex, type] of sourceTypes.entries()) {
    const point = points[(sourceIndex + 3) % points.length];
    const name = `${district.name} ${labelForSourceType(type)} ${sourceIndex + 1}`;
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM "WaterSource" WHERE "districtId" = ${district.id}::uuid AND name = ${name} LIMIT 1
    `;
    const status = sourceIndex === 2 && index % 4 === 0 ? "DRY" : sourceIndex === 3 && index % 5 === 0 ? "UNDER_REPAIR" : "ACTIVE";
    let sourceId = existing?.id;

    if (sourceId) {
      await prisma.$executeRaw`
        UPDATE "WaterSource"
        SET type = ${type}::"WaterSourceType",
          status = ${status}::"SourceStatus",
          location = ST_SetSRID(ST_MakePoint(${point[0]}, ${point[1]}), 4326),
          depth = ${type === "BOREHOLE" ? 42 + index : null},
          yield = ${type === "BOREHOLE" ? 460 + index * 12 : null},
          "lastInspected" = NOW() - (${sourceIndex + 1} || ' days')::interval,
          "inspectionNotes" = 'AOI seed sample source'
        WHERE id = ${sourceId}::uuid
      `;
    } else {
      const [created] = await prisma.$queryRaw`
        INSERT INTO "WaterSource" (id, name, type, location, "districtId", status, depth, yield, "lastInspected", "inspectionNotes", "createdAt")
        VALUES (gen_random_uuid(), ${name}, ${type}::"WaterSourceType",
          ST_SetSRID(ST_MakePoint(${point[0]}, ${point[1]}), 4326),
          ${district.id}::uuid, ${status}::"SourceStatus",
          ${type === "BOREHOLE" ? 42 + index : null},
          ${type === "BOREHOLE" ? 460 + index * 12 : null},
          NOW() - (${sourceIndex + 1} || ' days')::interval, 'AOI seed sample source', NOW())
        RETURNING id
      `;
      sourceId = created.id;
    }

    await prisma.waterSourceReading.deleteMany({ where: { sourceId } });
    for (const [monthIndex, month] of months.entries()) {
      await prisma.waterSourceReading.create({
        data: {
          sourceId,
          waterLevel: Number((-4.5 - sourceIndex * 1.1 - monthIndex * 0.28 - (index % 4) * 0.35).toFixed(1)),
          turbidity: Number((1.2 + sourceIndex * 0.4 + (index % 3) * 0.15).toFixed(1)),
          ph: Number((6.7 + (sourceIndex % 3) * 0.12).toFixed(1)),
          timestamp: new Date(`${month}-20T00:00:00.000Z`)
        }
      });
    }
  }
}

async function seedForecast({ district, index, riskScore, riskLevel }) {
  await prisma.droughtForecast.deleteMany({ where: { districtId: district.id, modelVersion: "aoi-seed-v1" } });
  const forecast = await prisma.droughtForecast.create({
    data: {
      districtId: district.id,
      forecastDate: daysFromNow(7),
      predictedSeverity: riskLevel,
      confidenceScore: Number((0.72 + (index % 6) * 0.035).toFixed(2)),
      riskScore: Math.min(0.94, riskScore),
      riskLabel: riskText(riskScore),
      recommendation: {
        priority: riskScore > 0.7 ? "Emergency water trucking" : "Monitor water points",
        source: "AOI seed"
      },
      modelVersion: "aoi-seed-v1"
    }
  });

  await prisma.droughtForecastDriver.createMany({
    data: [
      { forecastId: forecast.id, factor: "Rainfall anomaly", direction: "down", impact: "Reduced seasonal recharge" },
      { forecastId: forecast.id, factor: "NDVI", direction: riskScore > 0.55 ? "down" : "stable", impact: "Vegetation stress indicator" },
      { forecastId: forecast.id, factor: "Groundwater", direction: "down", impact: "Borehole depth trend" }
    ]
  });
}

async function seedReports({ district, points, index, userId }) {
  await prisma.$executeRaw`
    DELETE FROM "CommunityReport"
    WHERE "districtId" = ${district.id}::uuid AND "photoMetadata"->>'source' = 'AOI seed'
  `;

  for (let reportIndex = 0; reportIndex < 2; reportIndex += 1) {
    const point = points[(reportIndex + 1) % points.length];
    await prisma.$executeRaw`
      INSERT INTO "CommunityReport" (id, "userId", "districtId", location, "waterLevel", description,
        "photoUrl", "photoMetadata", "gpsAccuracyMeters", source, status, "createdAt")
      VALUES (gen_random_uuid(), ${userId}::uuid, ${district.id}::uuid,
        ST_SetSRID(ST_MakePoint(${point[0]}, ${point[1]}), 4326),
        ${Math.max(8, 68 - index - reportIndex * 7)},
        ${`AOI seed report for ${district.name} water access point ${reportIndex + 1}`},
        NULL, ${JSON.stringify({ source: "AOI seed", gpsTagged: true })}::jsonb,
        ${8 + reportIndex * 4}, 'MOBILE_APP'::"ReportSource",
        ${reportIndex === 0 ? "VERIFIED" : "PENDING"}::"ReportStatus",
        NOW() - (${reportIndex + 1} || ' days')::interval)
    `;
  }
}

function districtPolygonGeometry(geometry) {
  if (geometry.type === "Polygon") return geometry;
  if (geometry.type !== "MultiPolygon") throw new Error(`Unsupported county geometry: ${geometry.type}`);
  const largest = geometry.coordinates.reduce((best, polygon) => polygonArea(polygon[0]) > polygonArea(best[0]) ? polygon : best, geometry.coordinates[0]);
  return { type: "Polygon", coordinates: largest };
}

function samplePoints(geometry, count) {
  const bounds = geometryBounds(geometry);
  const width = bounds.maxLng - bounds.minLng;
  const height = bounds.maxLat - bounds.minLat;
  return Array.from({ length: count }, (_, index) => [
    Number((bounds.minLng + width * (0.25 + (index % 3) * 0.2)).toFixed(6)),
    Number((bounds.minLat + height * (0.25 + Math.floor(index / 3) * 0.2)).toFixed(6))
  ]);
}

function geometryBounds(geometry) {
  const coordinates = [];
  collectCoordinates(geometry, coordinates);
  return coordinates.reduce((bounds, [lng, lat]) => ({
    minLng: Math.min(bounds.minLng, lng),
    maxLng: Math.max(bounds.maxLng, lng),
    minLat: Math.min(bounds.minLat, lat),
    maxLat: Math.max(bounds.maxLat, lat)
  }), { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity });
}

function collectCoordinates(geometry, output) {
  if (geometry.type === "Polygon") {
    geometry.coordinates.flat(1).forEach((point) => output.push(point));
    return;
  }
  if (geometry.type === "MultiPolygon") {
    geometry.coordinates.flat(2).forEach((point) => output.push(point));
  }
}

function polygonArea(ring) {
  return Math.abs(ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2);
}

function yearMonths() {
  const year = new Date().getUTCFullYear();
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

function rainfallValue(base, monthIndex, countyIndex) {
  const seasonal = [0.4, 0.55, 0.82, 1.15, 1.28, 0.75, 0.42, 0.38, 0.52, 1.05, 1.22, 0.7][monthIndex] || 0.6;
  return Math.round(base * seasonal + (countyIndex % 6) * 4);
}

function sensorValue(type, index, day) {
  if (type === "GROUNDWATER") return Number((-5.5 - (index % 8) * 0.45 - day * 0.08).toFixed(1));
  if (type === "SOIL_MOISTURE") return Math.max(12, Math.round(42 - (index % 7) * 2 - day * 0.7));
  if (type === "RAINFALL") return Math.max(0, Math.round(24 - day * 1.2 + (index % 5) * 3));
  return Math.round(24 + (index % 9) * 0.6 + day * 0.2);
}

function sensorUnit(type) {
  if (type === "GROUNDWATER") return "m";
  if (type === "SOIL_MOISTURE") return "%";
  if (type === "RAINFALL") return "mm";
  return "C";
}

function riskText(score) {
  if (score >= 0.75) return "Extreme";
  if (score >= 0.55) return "High";
  if (score >= 0.35) return "Moderate";
  return "Low";
}

function labelForSourceType(type) {
  return type.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
