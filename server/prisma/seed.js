import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { generateApiKey, hashApiKey, keyPrefix } from "../src/utils/apiKeys.js";
import { buildIrrigationAdvice } from "../src/services/irrigationAdvisor.js";
import { marketDecisionHint } from "../src/services/marketPrices.js";

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

  const tenant = await prisma.tenant.create({
    data: { name: "Kenya Drought Response Pilot", slug: "kenya-pilot", country: "Kenya" }
  });
  const adminPassword = await bcrypt.hash("AdminPass123", 12);
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: "Platform Admin",
      email: "admin@smartwater.local",
      passwordHash: adminPassword,
      role: "admin",
      district: "Turkana Central",
      points: 120
    }
  });
  await prisma.user.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: "Amina Field Agent",
        email: "amina.field@smartwater.local",
        passwordHash: adminPassword,
        role: "field_agent",
        district: "Marsabit East",
        points: 86
      },
      {
        tenantId: tenant.id,
        name: "Hassan Community Monitor",
        email: "hassan.community@smartwater.local",
        passwordHash: adminPassword,
        role: "community_user",
        district: "Isiolo North",
        points: 64
      },
      {
        tenantId: tenant.id,
        name: "Voice Reports",
        email: "voice-reports@smartwater.local",
        passwordHash: "external-channel-disabled",
        role: "community_user",
        district: "External intake",
        points: 22
      }
    ]
  });

  for (const district of districts) {
    await prisma.$executeRaw`
      INSERT INTO "District" (id, "tenantId", name, geometry, "droughtRiskLevel", "createdAt")
      VALUES (${district.id}::uuid, ${tenant.id}::uuid, ${district.name},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify({ type: "Polygon", coordinates: [district.polygon] })}), 4326),
        ${district.risk}::"DroughtRiskLevel", NOW())
    `;
  }

  await seedDroughtSnapshots();
  await seedBoreholes();
  await seedConflictRiskAreas();
  await seedHydroEvents();
  await seedCropVarieties(tenant.id);
  await seedMarketPrices(tenant.id);
  await seedLivestockLayers();

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
        ${sensor.districtId}::uuid, 'ONLINE'::"SensorStatus", ${i < 2 ? daysAgo(1) : new Date()})
    `;
  }

  await prisma.maintenanceTicket.create({
    data: {
      sensorId: sensors[0].id,
      districtId: sensors[0].districtId,
      title: "Groundwater sensor missed ping SLA",
      description: "Seeded maintenance ticket for stale sensor health workflow.",
      priority: "HIGH",
      staleHours: 24,
      assignedTo: "Amina Field Agent"
    }
  });

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

  await seedIrrigationSchedule(districts[1].id);

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
      INSERT INTO "CommunityReport" (id, "userId", "districtId", location, "waterLevel", description, "photoUrl",
        "photoMetadata", "gpsAccuracyMeters", source, status, "createdAt")
      VALUES (gen_random_uuid(), ${admin.id}::uuid, ${district.id}::uuid,
        ST_SetSRID(ST_MakePoint(${district.polygon[0][0] + 0.1}, ${district.polygon[0][1] + 0.1}), 4326),
        ${Math.round(20 + Math.random() * 50)}, ${`Community report for ${district.name}`},
        NULL, ${JSON.stringify({ capturedBy: "seed", gpsTagged: true })}::jsonb, ${8 + Math.round(Math.random() * 18)},
        'MOBILE_APP'::"ReportSource", 'VERIFIED'::"ReportStatus", NOW() - interval '2 days')
    `;
  }

  const apiKey = generateApiKey();
  await prisma.apiKey.create({
    data: {
      tenantId: tenant.id,
      name: "Researcher sandbox key",
      ownerEmail: "researcher@example.org",
      quotaPerHour: 250,
      keyHash: hashApiKey(apiKey),
      keyPrefix: keyPrefix(apiKey)
    }
  });

  console.info("Seed complete");
  console.info("Admin login: admin@smartwater.local / AdminPass123");
  console.info(`Research API key: ${apiKey}`);
}

async function clearData() {
  await prisma.apiUsage.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.digitalTwinSimulation.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.irrigationSchedule.deleteMany();
  await prisma.cropRecommendation.deleteMany();
  await prisma.cropVariety.deleteMany();
  await prisma.marketPrice.deleteMany();
  await prisma.$executeRaw`DELETE FROM "LivestockWaterPoint"`;
  await prisma.pastureCondition.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.satelliteIndex.deleteMany();
  await prisma.droughtForecast.deleteMany();
  await prisma.droughtAlert.deleteMany();
  await prisma.droughtSnapshot.deleteMany();
  await prisma.$executeRaw`DELETE FROM "HydroEvent"`;
  await prisma.$executeRaw`DELETE FROM "ConflictRiskArea"`;
  await prisma.$executeRaw`DELETE FROM "Borehole"`;
  await prisma.$executeRaw`DELETE FROM "CommunityReport"`;
  await prisma.$executeRaw`DELETE FROM "Sensor"`;
  await prisma.$executeRaw`DELETE FROM "District"`;
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

async function seedCropVarieties(tenantId) {
  await prisma.cropVariety.createMany({
    data: [
      { tenantId, cropName: "Sorghum", varietyName: "Seredo", season: "Short rains", waterDemand: "LOW", droughtTolerance: 9, maturityDays: 95, notes: "Reliable in arid and semi-arid zones." },
      { tenantId, cropName: "Pearl millet", varietyName: "KAT PM2", season: "Short rains", waterDemand: "LOW", droughtTolerance: 9, maturityDays: 80, notes: "Good option when rainfall onset is uncertain." },
      { tenantId, cropName: "Cowpea", varietyName: "K80", season: "Short rains", waterDemand: "LOW", droughtTolerance: 8, maturityDays: 75, notes: "Dual-purpose grain and fodder crop." },
      { tenantId, cropName: "Green gram", varietyName: "N26", season: "Short rains", waterDemand: "LOW", droughtTolerance: 8, maturityDays: 70, notes: "Fast-maturing legume for dry spells." },
      { tenantId, cropName: "Maize", varietyName: "DH04", season: "Long rains", waterDemand: "MEDIUM", droughtTolerance: 6, maturityDays: 110, notes: "Use only where soil moisture is stable." }
    ]
  });
}

async function seedMarketPrices(tenantId) {
  const prices = [
    { commodity: "Goat", marketName: "Lodwar", unit: "head", price: 5200, trend: "FALLING", source: "seeded_market_observer" },
    { commodity: "Cattle", marketName: "Marsabit", unit: "head", price: 31000, trend: "FALLING", source: "seeded_market_observer" },
    { commodity: "Sorghum", marketName: "Isiolo", unit: "90kg bag", price: 4300, trend: "RISING", source: "seeded_market_observer" },
    { commodity: "Hay", marketName: "Nanyuki", unit: "bale", price: 420, trend: "RISING", source: "seeded_market_observer" }
  ];
  for (const item of prices) {
    await prisma.marketPrice.create({
      data: {
        tenantId,
        currency: "KES",
        observedAt: daysAgo(Math.floor(Math.random() * 5)),
        decisionHint: marketDecisionHint(item),
        ...item
      }
    });
  }
}

async function seedLivestockLayers() {
  const statuses = ["RELIABLE", "STRESSED", "DRY"];
  for (const [districtIndex, district] of districts.entries()) {
    for (let i = 0; i < 3; i += 1) {
      const volume = 180000 - districtIndex * 30000 - i * 42000;
      const demand = 22000 + i * 7000;
      await prisma.$executeRaw`
        INSERT INTO "LivestockWaterPoint" (id, "districtId", name, location, status, "waterVolumeLiters",
          "dailyDemandLiters", "daysRemaining", "supportedLivestock", "lastUpdatedAt")
        VALUES (gen_random_uuid(), ${district.id}::uuid, ${`${district.name} water point ${i + 1}`},
          ST_SetSRID(ST_MakePoint(${district.polygon[0][0] + 0.08 + i * 0.07}, ${district.polygon[0][1] + 0.08 + i * 0.04}), 4326),
          ${statuses[(districtIndex + i) % statuses.length]}::"WaterPointStatus",
          ${volume}, ${demand}, ${Number((volume / demand).toFixed(1))}, ${420 + i * 180}, NOW())
      `;
    }
    await prisma.pastureCondition.create({
      data: {
        districtId: district.id,
        pastureIndex: Number((0.28 + districtIndex * 0.09).toFixed(2)),
        grazingPressure: Number((0.72 - districtIndex * 0.08).toFixed(2)),
        stressLevel: district.risk,
        observedAt: daysAgo(2),
        notes: `Pasture condition for ${district.name} reflects livestock pressure and current NDVI.`
      }
    });
  }
}

async function seedIrrigationSchedule(districtId) {
  const advice = buildIrrigationAdvice({
    cropName: "Sorghum",
    soilMoisturePercent: 31,
    evapotranspirationMmDay: 4.8,
    rainfallForecastMm: 2
  });
  await prisma.irrigationSchedule.create({
    data: {
      districtId,
      cropName: "Sorghum",
      soilMoisturePercent: 31,
      evapotranspirationMmDay: 4.8,
      ...advice
    }
  });
}

async function seedDroughtSnapshots() {
  const snapshots = [];
  for (const [districtIndex, district] of districts.entries()) {
    for (let week = 15; week >= 0; week -= 1) {
      const spreadPressure = (15 - week) * (4.2 + districtIndex * 0.8);
      const base = [34, 22, 14][districtIndex];
      const score = Math.min(96, base + spreadPressure);
      snapshots.push({
        districtId: district.id,
        weekStart: weeksAgo(week),
        severityScore: Number(score.toFixed(1)),
        riskLevel: riskLevelForScore(score),
        groundwaterDepthMeters: Number((28 + score * 0.42 + districtIndex * 4).toFixed(1)),
        rainfallAnomalyPercent: Number((-12 - score * 0.7).toFixed(1)),
        ndvi: Number(Math.max(0.12, 0.62 - score / 190).toFixed(2))
      });
    }
  }
  await prisma.droughtSnapshot.createMany({ data: snapshots });
}

async function seedBoreholes() {
  const statuses = ["FUNCTIONAL", "DRY", "ABANDONED", "FUNCTIONAL", "FUNCTIONAL", "DRY"];
  let counter = 1;
  for (const district of districts) {
    for (let i = 0; i < 6; i += 1) {
      const lng = district.polygon[0][0] + 0.04 + (i % 3) * 0.09;
      const lat = district.polygon[0][1] + 0.06 + Math.floor(i / 3) * 0.1;
      await prisma.$executeRaw`
        INSERT INTO "Borehole" (id, name, location, "districtId", "depthMeters", "yieldLitersPerHour", status, "lastInspectedAt")
        VALUES (gen_random_uuid(), ${`BH-${String(counter).padStart(3, "0")}`},
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
          ${district.id}::uuid, ${55 + i * 18 + counter}, ${420 + i * 120},
          ${statuses[(counter + i) % statuses.length]}::"BoreholeStatus", NOW() - interval '6 days')
      `;
      counter += 1;
    }
  }
}

async function seedConflictRiskAreas() {
  const areas = [
    {
      name: "Turkana grazing corridor",
      riskScore: 82,
      incidentsLastYear: 11,
      notes: "Dry-season livestock movement overlaps with declining borehole yield.",
      polygon: [[35.22, 0.47], [35.5, 0.44], [35.48, 0.62], [35.2, 0.6], [35.22, 0.47]]
    },
    {
      name: "Marsabit border wells",
      riskScore: 68,
      incidentsLastYear: 6,
      notes: "Shared shallow wells show repeated queuing disputes during drought watch periods.",
      polygon: [[35.66, 0.32], [35.93, 0.32], [35.86, 0.52], [35.6, 0.48], [35.66, 0.32]]
    },
    {
      name: "Isiolo seasonal river access",
      riskScore: 49,
      incidentsLastYear: 3,
      notes: "Conflict risk rises after flash flood damage closes alternate water points.",
      polygon: [[35.18, 0.02], [35.42, 0.03], [35.39, 0.19], [35.16, 0.18], [35.18, 0.02]]
    }
  ];

  for (const area of areas) {
    await prisma.$executeRaw`
      INSERT INTO "ConflictRiskArea" (id, name, geometry, "riskScore", "incidentsLastYear", notes, "updatedAt")
      VALUES (gen_random_uuid(), ${area.name},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify({ type: "Polygon", coordinates: [area.polygon] })}), 4326),
        ${area.riskScore}, ${area.incidentsLastYear}, ${area.notes}, NOW())
    `;
  }
}

async function seedHydroEvents() {
  const events = [
    { district: districts[0], eventType: "DROUGHT", severity: "EMERGENCY", weeks: 1, inset: 0.03, notes: "Emergency drought footprint around primary grazing belt." },
    { district: districts[1], eventType: "DROUGHT", severity: "WARNING", weeks: 3, inset: 0.04, notes: "Drought expansion detected across eastern ward." },
    { district: districts[2], eventType: "FLASH_FLOOD", severity: "WATCH", weeks: 10, inset: 0.06, notes: "Wet-season flash flood exposure along seasonal drainage." },
    { district: districts[0], eventType: "FLASH_FLOOD", severity: "WARNING", weeks: 13, inset: 0.08, notes: "Flood-drought duality zone: flood-prone channels within drought-stressed district." }
  ];

  for (const event of events) {
    await prisma.$executeRaw`
      INSERT INTO "HydroEvent" (id, "districtId", "eventType", severity, "eventDate", geometry, notes)
      VALUES (gen_random_uuid(), ${event.district.id}::uuid, ${event.eventType}::"HydroEventType",
        ${event.severity}::"DroughtRiskLevel", ${weeksAgo(event.weeks)},
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify({ type: "Polygon", coordinates: [insetPolygon(event.district.polygon, event.inset)] })}), 4326),
        ${event.notes})
    `;
  }
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

function weeksAgo(week) {
  return new Date(Date.now() - week * 7 * 24 * 60 * 60 * 1000);
}

function riskLevelForScore(score) {
  if (score <= 30) return "NORMAL";
  if (score <= 50) return "WATCH";
  if (score <= 75) return "WARNING";
  return "EMERGENCY";
}

function insetPolygon(polygon, inset) {
  return polygon.map(([lng, lat], index) => {
    if (index === polygon.length - 1) {
      const [firstLng, firstLat] = polygon[0];
      return [firstLng + inset, firstLat + inset];
    }
    const directionLng = index === 0 || index === 3 ? inset : -inset;
    const directionLat = index < 2 ? inset : -inset;
    return [lng + directionLng, lat + directionLat];
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
