import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createSensorReading } from "../services/readingService.js";
import { hashApiKey } from "../utils/apiKeys.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { type, district } = req.query;
    const rows = await prisma.$queryRaw`
      SELECT s.id, s.type, s.status, s."lastPing", s."districtId",
        d.name AS "districtName", ST_AsGeoJSON(s.location)::json AS location,
        sd."externalId" AS "externalId", sd.metadata AS "deviceMetadata",
        latest.value AS "latestValue", latest.unit AS "latestUnit", latest.timestamp AS "latestTimestamp",
        latest.metadata AS "readingMetadata",
        ROW_NUMBER() OVER (PARTITION BY s.type ORDER BY s."lastPing" DESC NULLS LAST, s.id)::int AS "typeIndex"
      FROM "Sensor" s
      JOIN "District" d ON d.id = s."districtId"
      LEFT JOIN "SensorDevice" sd ON sd."sensorId" = s.id
      LEFT JOIN LATERAL (
        SELECT r.value, r.unit, r.timestamp, r.metadata
        FROM "SensorReading" r
        WHERE r."sensorId" = s.id
        ORDER BY r.timestamp DESC
        LIMIT 1
      ) latest ON TRUE
      WHERE (${type ? toSensorType(String(type)) : null}::text IS NULL OR s.type::text = ${type ? toSensorType(String(type)) : null})
        AND (${district || null}::uuid IS NULL OR s."districtId" = ${district || null}::uuid)
        AND (${req.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.tenantId || null}::uuid)
      ORDER BY s."lastPing" DESC NULLS LAST
    `;
    res.json(rows.map(formatSensor));
  } catch (err) {
    next(err);
  }
});

router.post("/", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = sensorSchema.parse(req.body);
    const sensorType = toSensorType(input.type);
    const sensorStatus = toSensorStatus(input.status || "Online");
    const district = await findDistrictForLocation(input.location, req.user.tenantId);
    if (!district) return res.status(404).json({ error: "No district is available for this sensor location." });

    const sensorId = input.sensor_id || await nextSensorId(sensorType);
    const metadata = {
      name: input.name,
      locationName: input.location,
      battery: input.battery ?? 100,
      signal: input.signal,
      rssi: input.rssi
    };

    const [sensor] = await prisma.$queryRaw`
      INSERT INTO "Sensor" (id, type, location, "districtId", status, "lastPing")
      VALUES (gen_random_uuid(), ${sensorType}::"SensorType",
        ST_SetSRID(ST_MakePoint(${district.longitude}, ${district.latitude}), 4326),
        ${district.id}::uuid, ${sensorStatus}::"SensorStatus", ${input.last_updated ? new Date(input.last_updated) : new Date()})
      RETURNING id
    `;

    await prisma.sensorDevice.create({
      data: {
        sensorId: sensor.id,
        tenantId: district.tenantId,
        externalId: sensorId,
        authTokenHash: hashApiKey(crypto.randomBytes(24).toString("hex")),
        provider: "dashboard",
        metadata
      }
    });

    const readingValue = parseReadingValue(input.reading);
    if (readingValue !== null && sensorStatus !== "OFFLINE") {
      await prisma.sensorReading.create({
        data: {
          sensorId: sensor.id,
          value: readingValue,
          unit: unitForSensorType(sensorType),
          timestamp: input.last_updated ? new Date(input.last_updated) : new Date(),
          metadata: { battery: metadata.battery }
        }
      });
    }

    const [created] = await sensorRows({ id: sensor.id, tenantId: req.user.tenantId });
    res.status(201).json(formatSensor(created));
  } catch (err) {
    next(err);
  }
});

router.get("/summary", async (req, res, next) => {
  try {
    const rows = await prisma.sensor.groupBy({
      by: ["status"],
      where: { district: req.tenantId ? { tenantId: req.tenantId } : {} },
      _count: { _all: true }
    });
    const total = rows.reduce((sum, row) => sum + row._count._all, 0);
    const online = countStatus(rows, "ONLINE");
    const offline = countStatus(rows, "OFFLINE");
    const maintenance = countStatus(rows, "MAINTENANCE");
    res.json({
      total,
      online,
      offline,
      maintenance,
      health_pct: total ? Math.round((online / total) * 100) : 0
    });
  } catch (err) {
    next(err);
  }
});

router.get("/operations/health", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const staleHours = Number(req.query.staleHours || 6);
    const rows = await prisma.$queryRaw`
      SELECT s.id, s.type, s.status, s."lastPing", s."districtId", d.name AS "districtName",
        EXTRACT(EPOCH FROM (NOW() - COALESCE(s."lastPing", NOW() - interval '999 hours'))) / 3600 AS "hoursSincePing",
        COUNT(mt.id)::int AS "openTickets"
      FROM "Sensor" s
      JOIN "District" d ON d.id = s."districtId"
      LEFT JOIN "MaintenanceTicket" mt ON mt."sensorId" = s.id AND mt.status != 'RESOLVED'::"MaintenanceTicketStatus"
      WHERE (${req.user.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.user.tenantId || null}::uuid)
      GROUP BY s.id, d.name
      ORDER BY "hoursSincePing" DESC
    `;
    res.json({ staleHours, sensors: rows, stale: rows.filter((row) => Number(row.hoursSincePing) >= staleHours) });
  } catch (err) {
    next(err);
  }
});

router.get("/operations/tickets", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const tickets = await prisma.maintenanceTicket.findMany({
      where: { sensor: { district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} } },
      include: { sensor: { select: { id: true, type: true, status: true, lastPing: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

router.post("/operations/tickets/:id/status", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = z.object({
      status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED"]),
      assignedTo: z.string().optional()
    }).parse(req.body);
    const existing = await prisma.maintenanceTicket.findFirst({
      where: { id: req.params.id, sensor: { district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} } },
      select: { id: true }
    });
    if (!existing) return res.status(404).json({ error: "Maintenance ticket not found" });
    const ticket = await prisma.maintenanceTicket.update({
      where: { id: req.params.id },
      data: {
        status: input.status,
        assignedTo: input.assignedTo,
        resolvedAt: input.status === "RESOLVED" ? new Date() : null
      }
    });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [sensor] = await sensorRows({ id: req.params.id, tenantId: req.tenantId });
    if (!sensor) return res.status(404).json({ error: "Sensor not found" });
    res.json(formatSensor(sensor));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reading", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = z.object({
      value: z.number(),
      unit: z.string().min(1),
      metadata: z.record(z.any()).optional()
    }).parse(req.body);
    const sensor = await prisma.sensor.findFirst({
      where: { id: req.params.id, district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} },
      select: { id: true }
    });
    if (!sensor) return res.status(404).json({ error: "Sensor not found" });
    const reading = await createSensorReading(req.params.id, input);
    res.status(201).json(reading);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/readings", async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const readings = await prisma.sensorReading.findMany({
      where: {
        sensorId: req.params.id,
        timestamp: { gte: since },
        sensor: { district: req.tenantId ? { tenantId: req.tenantId } : {} }
      },
      orderBy: { timestamp: "asc" }
    });
    res.json(readings);
  } catch (err) {
    next(err);
  }
});

const sensorSchema = z.object({
  sensor_id: z.string().min(2).optional(),
  name: z.string().min(2),
  location: z.string().min(2),
  type: z.enum(["Groundwater", "Soil Moisture", "Weather", "Rainfall", "GROUNDWATER", "SOIL_MOISTURE", "WEATHER", "RAINFALL"]),
  battery: z.number().int().min(0).max(100).optional(),
  signal: z.number().int().min(0).max(4).optional(),
  rssi: z.number().optional(),
  reading: z.union([z.number(), z.string()]).optional(),
  status: z.enum(["Online", "Offline", "Maintenance", "ONLINE", "OFFLINE", "MAINTENANCE"]).default("Online"),
  last_updated: z.string().datetime().optional()
});

async function sensorRows({ id, tenantId }) {
  return prisma.$queryRaw`
    SELECT s.id, s.type, s.status, s."lastPing", s."districtId",
      d.name AS "districtName", ST_AsGeoJSON(s.location)::json AS location,
      sd."externalId" AS "externalId", sd.metadata AS "deviceMetadata",
      latest.value AS "latestValue", latest.unit AS "latestUnit", latest.timestamp AS "latestTimestamp",
      latest.metadata AS "readingMetadata",
      ROW_NUMBER() OVER (PARTITION BY s.type ORDER BY s."lastPing" DESC NULLS LAST, s.id)::int AS "typeIndex"
    FROM "Sensor" s
    JOIN "District" d ON d.id = s."districtId"
    LEFT JOIN "SensorDevice" sd ON sd."sensorId" = s.id
    LEFT JOIN LATERAL (
      SELECT r.value, r.unit, r.timestamp, r.metadata
      FROM "SensorReading" r
      WHERE r."sensorId" = s.id
      ORDER BY r.timestamp DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE (${id || null}::uuid IS NULL OR s.id = ${id || null}::uuid)
      AND (${tenantId || null}::uuid IS NULL OR d."tenantId" = ${tenantId || null}::uuid)
    ORDER BY s."lastPing" DESC NULLS LAST
  `;
}

async function findDistrictForLocation(location, tenantId) {
  const [match] = await prisma.$queryRaw`
    SELECT id, name, "tenantId",
      ST_X(ST_Centroid(geometry)) AS longitude,
      ST_Y(ST_Centroid(geometry)) AS latitude
    FROM "District"
    WHERE (${tenantId || null}::uuid IS NULL OR "tenantId" = ${tenantId || null}::uuid)
    ORDER BY CASE WHEN LOWER(name) = LOWER(${location}) THEN 0 WHEN LOWER(name) LIKE LOWER(${`%${location}%`}) THEN 1 ELSE 2 END, name
    LIMIT 1
  `;
  return match;
}

async function nextSensorId(type) {
  const count = await prisma.sensor.count({ where: { type } });
  return `${sensorPrefix(type)}-${String(count + 1).padStart(3, "0")}`;
}

function formatSensor(row) {
  const metadata = row.deviceMetadata || {};
  const readingMetadata = row.readingMetadata || {};
  const statusCode = row.status;
  const type = toDisplayType(row.type);
  const battery = clampPercent(metadata.battery ?? readingMetadata.battery ?? 100);
  const signal = statusCode === "OFFLINE" ? 0 : signalBars(metadata.signal, metadata.rssi);
  const lastUpdated = row.latestTimestamp || row.lastPing;
  return {
    id: row.id,
    sensor_id: row.externalId || `${sensorPrefix(row.type)}-${String(row.typeIndex || 1).padStart(3, "0")}`,
    name: metadata.name || `${type} ${type === "Weather" ? "Station" : type === "Rainfall" ? "Gauge" : "Sensor"}`,
    location: metadata.locationName || row.districtName,
    type,
    battery,
    signal,
    reading: statusCode === "OFFLINE" || row.latestValue === null || row.latestValue === undefined ? "–" : formatReading(row.latestValue, row.latestUnit),
    status: toDisplayStatus(statusCode),
    last_updated: lastUpdated,
    districtName: row.districtName,
    districtId: row.districtId,
    locationGeojson: row.location,
    lastPing: row.lastPing,
    typeCode: row.type,
    statusCode
  };
}

function countStatus(rows, status) {
  return rows.find((row) => row.status === status)?._count._all || 0;
}

function toSensorType(type) {
  return {
    Groundwater: "GROUNDWATER",
    "Soil Moisture": "SOIL_MOISTURE",
    Weather: "WEATHER",
    Rainfall: "RAINFALL"
  }[type] || type;
}

function toSensorStatus(status) {
  return { Online: "ONLINE", Offline: "OFFLINE", Maintenance: "MAINTENANCE" }[status] || status;
}

function toDisplayType(type) {
  return {
    GROUNDWATER: "Groundwater",
    SOIL_MOISTURE: "Soil Moisture",
    WEATHER: "Weather",
    RAINFALL: "Rainfall"
  }[type] || type;
}

function toDisplayStatus(status) {
  return { ONLINE: "Online", OFFLINE: "Offline", MAINTENANCE: "Maintenance" }[status] || status;
}

function sensorPrefix(type) {
  return { GROUNDWATER: "GW", SOIL_MOISTURE: "SM", WEATHER: "WS", RAINFALL: "RG" }[type] || "SN";
}

function unitForSensorType(type) {
  return { GROUNDWATER: "%", SOIL_MOISTURE: "%", WEATHER: "°C", RAINFALL: "mm" }[type] || "";
}

function formatReading(value, unit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "–";
  const display = Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(1));
  return `${display}${unit === "C" ? "°C" : unit || ""}`;
}

function parseReadingValue(value) {
  if (value === undefined || value === null || value === "–") return null;
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 100;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function signalBars(signal, rssi) {
  if (Number.isFinite(Number(signal))) return Math.max(0, Math.min(4, Number(signal)));
  const dbm = Number(rssi);
  if (!Number.isFinite(dbm)) return 3;
  if (dbm >= -60) return 4;
  if (dbm >= -70) return 3;
  if (dbm >= -80) return 2;
  if (dbm >= -90) return 1;
  return 0;
}

export default router;
