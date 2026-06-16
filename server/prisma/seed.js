import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const districts = [
  {
    id: randomUUID(),
    name: "Turkana Central",
    risk: "WARNING",
    polygon: [[35.15, 0.35], [35.45, 0.35], [35.45, 0.65], [35.15, 0.65], [35.15, 0.35]]
  },
  {
    id: randomUUID(),
    name: "Marsabit East",
    risk: "WATCH",
    polygon: [[35.55, 0.25], [35.9, 0.25], [35.9, 0.58], [35.55, 0.58], [35.55, 0.25]]
  },
  {
    id: randomUUID(),
    name: "Isiolo North",
    risk: "NORMAL",
    polygon: [[35.1, -0.05], [35.48, -0.05], [35.48, 0.25], [35.1, 0.25], [35.1, -0.05]]
  }
];

const sensorTypes = ["GROUNDWATER", "SOIL_MOISTURE", "RAINFALL", "WEATHER"];

async function main() {
  await clearData();

  const adminPassword = await bcrypt.hash("AdminPass123", 12);
  const admin = await prisma.user.create({
    data: {
      name: "Platform Admin",
      email: "admin@smartwater.local",
      passwordHash: adminPassword,
      role: "admin",
      district: "Turkana Central"
    }
  });

  for (const district of districts) {
    await prisma.$executeRaw`
      INSERT INTO "District" (id, name, geometry, "droughtRiskLevel", "createdAt")
      VALUES (${district.id}::uuid, ${district.name},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify({ type: "Polygon", coordinates: [district.polygon] })}), 4326),
        ${district.risk}::"DroughtRiskLevel", NOW())
    `;
  }

  const sensors = [];
  for (let i = 0; i < 10; i += 1) {
    const district = districts[i % districts.length];
    const sensor = {
      id: randomUUID(),
      districtId: district.id,
      type: sensorTypes[i % sensorTypes.length],
      lng: district.polygon[0][0] + 0.05 + (i % 3) * 0.07,
      lat: district.polygon[0][1] + 0.05 + (i % 2) * 0.08
    };
    sensors.push(sensor);
    await prisma.$executeRaw`
      INSERT INTO "Sensor" (id, type, location, "districtId", status, "lastPing")
      VALUES (${sensor.id}::uuid, ${sensor.type}::"SensorType",
        ST_SetSRID(ST_MakePoint(${sensor.lng}, ${sensor.lat}), 4326),
        ${sensor.districtId}::uuid, 'ONLINE'::"SensorStatus", NOW())
    `;
  }

  for (const sensor of sensors) {
    for (let day = 29; day >= 0; day -= 1) {
      await prisma.sensorReading.create({
        data: {
          sensorId: sensor.id,
          value: valueFor(sensor.type, day),
          unit: unitFor(sensor.type),
          timestamp: daysAgo(day),
          metadata: { quality: "seeded", battery: 78 + (day % 10) }
        }
      });
    }
  }

  for (const district of districts) {
    for (const indexType of ["NDVI", "LST", "SMAP", "ET"]) {
      for (let week = 4; week >= 0; week -= 1) {
        await prisma.satelliteIndex.create({
          data: {
            districtId: district.id,
            indexType,
            value: satelliteValue(indexType, week),
            capturedAt: daysAgo(week * 7),
            geoTiff: `s3://smart-water-map/${district.name.toLowerCase().replaceAll(" ", "-")}/${indexType}-${week}.tif`
          }
        });
      }
    }

    await prisma.droughtForecast.createMany({
      data: [1, 2, 3, 4, 5].map((offset) => ({
        districtId: district.id,
        forecastDate: daysFromNow(offset * 3),
        predictedSeverity: district.risk,
        confidenceScore: Number((0.72 + offset * 0.03).toFixed(2)),
        modelVersion: "baseline-v1"
      }))
    });
  }

  const warningDistrict = districts[0];
  await prisma.droughtAlert.create({
    data: {
      districtId: warningDistrict.id,
      severity: "WARNING",
      message: "Groundwater and NDVI composite score indicates worsening drought conditions."
    }
  });

  for (const district of districts) {
    await prisma.$executeRaw`
      INSERT INTO "CommunityReport" (id, "userId", "districtId", location, "waterLevel", description, "photoUrl", status, "createdAt")
      VALUES (gen_random_uuid(), ${admin.id}::uuid, ${district.id}::uuid,
        ST_SetSRID(ST_MakePoint(${district.polygon[0][0] + 0.1}, ${district.polygon[0][1] + 0.1}), 4326),
        ${Math.round(20 + Math.random() * 50)}, ${`Community report for ${district.name}`},
        NULL, 'VERIFIED'::"ReportStatus", NOW() - interval '2 days')
    `;
  }

  console.info("Seed complete");
  console.info("Admin login: admin@smartwater.local / AdminPass123");
}

async function clearData() {
  await prisma.sensorReading.deleteMany();
  await prisma.satelliteIndex.deleteMany();
  await prisma.droughtForecast.deleteMany();
  await prisma.droughtAlert.deleteMany();
  await prisma.$executeRaw`DELETE FROM "CommunityReport"`;
  await prisma.$executeRaw`DELETE FROM "Sensor"`;
  await prisma.$executeRaw`DELETE FROM "District"`;
  await prisma.user.deleteMany();
}

function valueFor(type, day) {
  const baseline = { GROUNDWATER: 65, SOIL_MOISTURE: 48, RAINFALL: 18, WEATHER: 29 }[type] || 40;
  return Number((baseline - day * 0.55 + Math.sin(day) * 4).toFixed(2));
}

function unitFor(type) {
  return { GROUNDWATER: "%", SOIL_MOISTURE: "%", RAINFALL: "mm", WEATHER: "C" }[type] || "unit";
}

function satelliteValue(type, week) {
  const baseline = { NDVI: 0.42, LST: 32, SMAP: 0.28, ET: 3.1 }[type] || 1;
  return Number((baseline - week * 0.02).toFixed(2));
}

function daysAgo(day) {
  return new Date(Date.now() - day * 24 * 60 * 60 * 1000);
}

function daysFromNow(day) {
  return new Date(Date.now() + day * 24 * 60 * 60 * 1000);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

