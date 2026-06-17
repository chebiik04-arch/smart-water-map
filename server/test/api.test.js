import request from "supertest";
import tmp from "tmp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { hashApiKey, keyPrefix } from "../src/utils/apiKeys.js";

const uploadDir = tmp.dirSync({ unsafeCleanup: true });
process.env.UPLOAD_DIR = uploadDir.name;
const app = createApp();
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const tenantSlug = `test-tenant-${runId}`;
let tenant;
let otherTenant;
let district;
let otherDistrict;
let adminToken;
let userToken;
let user;

describe("API hardening", () => {
  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: `Tenant ${runId}`, slug: tenantSlug, country: "Kenya" } });
    otherTenant = await prisma.tenant.create({ data: { name: `Other ${runId}`, slug: `other-${runId}`, country: "Kenya" } });
    district = await createDistrict(tenant.id, `District ${runId}`);
    otherDistrict = await createDistrict(otherTenant.id, `Other District ${runId}`);
  });

  afterAll(async () => {
    await prisma.apiUsage.deleteMany({ where: { apiKey: { tenantId: { in: [tenant.id, otherTenant.id] } } } });
    await prisma.apiKey.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
    await prisma.marketImportRun.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
    await prisma.messagingConversation.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
    await prisma.uploadAsset.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
    await prisma.reportModeration.deleteMany({ where: { report: { user: { tenantId: tenant.id } } } });
    await prisma.communityReport.deleteMany({ where: { user: { tenantId: tenant.id } } });
    await prisma.irrigationSchedule.deleteMany({ where: { districtId: { in: [district.id, otherDistrict.id] } } });
    await prisma.sensorReading.deleteMany({ where: { sensor: { districtId: { in: [district.id, otherDistrict.id] } } } });
    await prisma.sensorDevice.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
    await prisma.sensor.deleteMany({ where: { districtId: { in: [district.id, otherDistrict.id] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
    await prisma.district.deleteMany({ where: { id: { in: [district.id, otherDistrict.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenant.id, otherTenant.id] } } });
    uploadDir.removeCallback();
    await prisma.$disconnect();
  });

  it("registers and logs in users with tenant-scoped JWTs", async () => {
    const admin = await request(app)
      .post("/api/v1/auth/register")
      .set("x-tenant-slug", tenantSlug)
      .send({ name: "Admin User", email: `admin-${runId}@example.com`, password: "password123", role: "admin" })
      .expect(201);
    expect(admin.body.user.tenantId).toBe(tenant.id);
    adminToken = admin.body.token;

    const community = await request(app)
      .post("/api/v1/auth/register")
      .set("x-tenant-slug", tenantSlug)
      .send({ name: "Reporter User", email: `reporter-${runId}@example.com`, password: "password123", role: "community_user" })
      .expect(201);
    userToken = community.body.token;
    user = community.body.user;

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: `admin-${runId}@example.com`, password: "password123" })
      .expect(200);
    expect(login.body.token).toBeTruthy();
  });

  it("stores uploaded report evidence and records moderation actions", async () => {
    const upload = await request(app)
      .post("/api/v1/community/report/upload")
      .set("Authorization", `Bearer ${userToken}`)
      .field("districtId", district.id)
      .field("latitude", "-1.8")
      .field("longitude", "37.6")
      .field("waterLevel", "18")
      .field("description", "Borehole is nearly dry")
      .attach("photo", Buffer.from("fake image"), { filename: "report.jpg", contentType: "image/jpeg" })
      .expect(201);

    expect(upload.body.photoUrl).toMatch(/^\/uploads\//);
    expect(upload.body.status).toBe("PENDING");

    const moderated = await request(app)
      .post(`/api/v1/community/reports/${upload.body.id}/moderate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "VERIFIED", notes: "GPS and image checked" })
      .expect(200);
    expect(moderated.body.report.status).toBe("VERIFIED");
    expect(moderated.body.awardedPoints).toBe(10);

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    expect(refreshed.points).toBe(10);
    const asset = await prisma.uploadAsset.findFirst({ where: { reportId: upload.body.id } });
    expect(asset.scanStatus).toBe("PENDING");
  });

  it("blocks advisory writes against another tenant district", async () => {
    await request(app)
      .post("/api/v1/advisory/irrigation/schedule")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ districtId: otherDistrict.id, cropName: "Maize", rainfallForecastMm: 0 })
      .expect(404);

    const response = await request(app)
      .post("/api/v1/advisory/irrigation/schedule")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ districtId: district.id, cropName: "Sorghum", rainfallForecastMm: 2 })
      .expect(201);
    expect(response.body.districtId).toBe(district.id);
  });

  it("enforces public API quota and tenant-scopes readings", async () => {
    const rawKey = `swm_test_${runId}`;
    await prisma.apiKey.create({
      data: {
        tenantId: tenant.id,
        name: "Quota test",
        keyHash: hashApiKey(rawKey),
        keyPrefix: keyPrefix(rawKey),
        ownerEmail: `researcher-${runId}@example.com`,
        quotaPerHour: 1
      }
    });

    const sensor = await createSensor(district.id);
    const otherSensor = await createSensor(otherDistrict.id);
    await prisma.sensorReading.createMany({
      data: [
        { sensorId: sensor.id, value: 34, unit: "%", metadata: {} },
        { sensorId: otherSensor.id, value: 12, unit: "%", metadata: {} }
      ]
    });

    const readingsKey = `swm_test_readings_${runId}`;
    await prisma.apiKey.create({
      data: {
        tenantId: tenant.id,
        name: "Readings scope test",
        keyHash: hashApiKey(readingsKey),
        keyPrefix: keyPrefix(readingsKey),
        ownerEmail: `reader-${runId}@example.com`,
        quotaPerHour: 10
      }
    });

    const hidden = await request(app)
      .get(`/api/v1/public/readings?sensorId=${otherSensor.id}`)
      .set("x-api-key", readingsKey)
      .expect(200);
    expect(hidden.body).toHaveLength(0);

    await request(app).get("/api/v1/public/districts").set("x-api-key", rawKey).expect(200);
    await request(app).get("/api/v1/public/districts").set("x-api-key", rawKey).expect(429);
  });

  it("manages tenants and tenant users for admins", async () => {
    const tenants = await request(app)
      .get("/api/v1/tenants")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(tenants.body[0].id).toBe(tenant.id);

    const createdUser = await request(app)
      .post(`/api/v1/tenants/${tenant.id}/users`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Field Agent", email: `field-${runId}@example.com`, password: "password123", role: "field_agent" })
      .expect(201);
    expect(createdUser.body.role).toBe("field_agent");
  });

  it("maintains WhatsApp conversation state and creates a report", async () => {
    await request(app)
      .post("/api/v1/community/voice/whatsapp")
      .set("x-tenant-slug", tenantSlug)
      .send({ provider: "generic", phone: "+254700000000", text: "start" })
      .expect(200);
    const level = await request(app)
      .post("/api/v1/community/voice/whatsapp")
      .set("x-tenant-slug", tenantSlug)
      .send({ provider: "generic", phone: "+254700000000", text: "19" })
      .expect(200);
    expect(level.body.state).toBe("AWAITING_DESCRIPTION");
    const completed = await request(app)
      .post("/api/v1/community/voice/whatsapp")
      .set("x-tenant-slug", tenantSlug)
      .send({ provider: "generic", phone: "+254700000000", text: "Community pan is dry" })
      .expect(200);
    expect(completed.body.state).toBe("COMPLETED");
    expect(completed.body.report.status).toBe("PENDING");
  });

  it("registers sensor devices and accepts authenticated device readings", async () => {
    const sensor = await createSensor(district.id);
    const deviceToken = `device-token-${runId}`;
    await request(app)
      .post("/api/v1/provider/sensors/devices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sensorId: sensor.id, externalId: `sensor-${runId}`, authToken: deviceToken })
      .expect(201);

    await request(app)
      .post("/api/v1/provider/sensors/readings")
      .set("x-sensor-id", `sensor-${runId}`)
      .set("x-sensor-token", deviceToken)
      .send({ value: 41, unit: "%", metadata: { battery: 88 } })
      .expect(201);

    const count = await prisma.sensorReading.count({ where: { sensorId: sensor.id } });
    expect(count).toBeGreaterThan(0);
  });
});

async function createDistrict(tenantId, name) {
  const [row] = await prisma.$queryRaw`
    INSERT INTO "District" (id, "tenantId", name, geometry, "droughtRiskLevel", "createdAt")
    VALUES (gen_random_uuid(), ${tenantId}::uuid, ${name},
      ST_GeomFromText('POLYGON((37.0 -2.0, 38.0 -2.0, 38.0 -1.0, 37.0 -1.0, 37.0 -2.0))', 4326),
      'NORMAL'::"DroughtRiskLevel", NOW())
    RETURNING id, "tenantId", name
  `;
  return row;
}

async function createSensor(districtId) {
  const [row] = await prisma.$queryRaw`
    INSERT INTO "Sensor" (id, type, location, "districtId", status, "lastPing")
    VALUES (gen_random_uuid(), 'SOIL_MOISTURE'::"SensorType", ST_SetSRID(ST_MakePoint(37.6, -1.8), 4326),
      ${districtId}::uuid, 'ONLINE'::"SensorStatus", NOW())
    RETURNING id, "districtId"
  `;
  return row;
}
