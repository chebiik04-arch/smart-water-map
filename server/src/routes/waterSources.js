import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { emitWaterSourceUpdate } from "../services/socket.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const filters = {
      districtId: req.query.districtId || null,
      type: req.query.type || null,
      status: req.query.status || null
    };

    const rows = await prisma.$queryRaw`
      SELECT ws.id, ws.name, ws.type, ws.status, ws.depth, ws.yield, ws."lastInspected",
        d.name AS "districtName",
        ST_AsGeoJSON(ws.location)::json AS geometry,
        latest."waterLevel" AS "latestLevel"
      FROM "WaterSource" ws
      JOIN "District" d ON d.id = ws."districtId"
      LEFT JOIN LATERAL (
        SELECT "waterLevel"
        FROM "WaterSourceReading" wsr
        WHERE wsr."sourceId" = ws.id
        ORDER BY wsr.timestamp DESC
        LIMIT 1
      ) latest ON true
      WHERE (${filters.districtId}::uuid IS NULL OR ws."districtId" = ${filters.districtId}::uuid)
        AND (${filters.type}::"WaterSourceType" IS NULL OR ws.type = ${filters.type}::"WaterSourceType")
        AND (${filters.status}::"SourceStatus" IS NULL OR ws.status = ${filters.status}::"SourceStatus")
        AND (${req.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.tenantId || null}::uuid)
      ORDER BY ws.name ASC
    `;

    res.json({
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          id: row.id,
          name: row.name,
          type: row.type,
          status: row.status,
          depth: row.depth,
          yield: row.yield,
          districtName: row.districtName,
          latestLevel: row.latestLevel,
          lastInspected: row.lastInspected
        }
      }))
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [source] = await prisma.$queryRaw`
      SELECT ws.id, ws.name, ws.type, ws.status, ws.depth, ws.yield, ws."lastInspected", ws."createdAt",
        ws."districtId", d.name AS "districtName", ST_AsGeoJSON(ws.location)::json AS location
      FROM "WaterSource" ws
      JOIN "District" d ON d.id = ws."districtId"
      WHERE ws.id = ${req.params.id}::uuid
        AND (${req.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.tenantId || null}::uuid)
    `;
    if (!source) return res.status(404).json({ error: "Water source not found" });
    res.json(source);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/readings", async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
    const readings = await prisma.waterSourceReading.findMany({
      where: {
        sourceId: req.params.id,
        timestamp: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        source: { district: req.tenantId ? { tenantId: req.tenantId } : {} }
      },
      orderBy: { timestamp: "asc" }
    });
    res.json(readings);
  } catch (err) {
    next(err);
  }
});

router.post("/", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = sourceSchema.parse(req.body);
    const district = await prisma.district.findFirst({
      where: { id: input.districtId, ...(req.user.tenantId ? { tenantId: req.user.tenantId } : {}) },
      select: { id: true }
    });
    if (!district) return res.status(404).json({ error: "District not found" });
    const [source] = await prisma.$queryRaw`
      INSERT INTO "WaterSource" (id, name, type, location, "districtId", status, depth, yield, "lastInspected", "createdAt")
      VALUES (gen_random_uuid(), ${input.name}, ${input.type}::"WaterSourceType",
        ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
        ${input.districtId}::uuid, ${input.status}::"SourceStatus", ${input.depth || null}, ${input.yield || null},
        ${input.lastInspected ? new Date(input.lastInspected) : null}, NOW())
      RETURNING id, name, type, status, depth, yield, "lastInspected", "districtId", ST_AsGeoJSON(location)::json AS location
    `;
    res.status(201).json(source);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reading", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = readingSchema.parse(req.body);
    const source = await prisma.waterSource.findFirst({
      where: { id: req.params.id, district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} },
      select: { id: true }
    });
    if (!source) return res.status(404).json({ error: "Water source not found" });
    const reading = await prisma.waterSourceReading.create({
      data: {
        sourceId: req.params.id,
        waterLevel: input.waterLevel,
        turbidity: input.turbidity,
        ph: input.ph
      },
      include: { source: { select: { districtId: true, name: true, type: true, status: true } } }
    });
    emitWaterSourceUpdate({ ...reading, districtId: reading.source.districtId });
    res.status(201).json(reading);
  } catch (err) {
    next(err);
  }
});

const sourceSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["BOREHOLE", "WATER_POINT", "RIVER", "RESERVOIR"]),
  districtId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.enum(["ACTIVE", "DRY", "UNDER_REPAIR", "ABANDONED"]).default("ACTIVE"),
  depth: z.number().optional(),
  yield: z.number().optional(),
  lastInspected: z.string().datetime().optional()
});

const readingSchema = z.object({
  waterLevel: z.number(),
  turbidity: z.number().optional(),
  ph: z.number().optional()
});

export default router;
