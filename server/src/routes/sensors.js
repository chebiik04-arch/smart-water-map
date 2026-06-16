import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createSensorReading } from "../services/readingService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { type, district } = req.query;
    const rows = await prisma.$queryRaw`
      SELECT s.id, s.type, s.status, s."lastPing", s."districtId",
        d.name AS "districtName", ST_AsGeoJSON(s.location)::json AS location
      FROM "Sensor" s
      JOIN "District" d ON d.id = s."districtId"
      WHERE (${type || null}::text IS NULL OR s.type::text = ${type || null})
        AND (${district || null}::uuid IS NULL OR s."districtId" = ${district || null}::uuid)
      ORDER BY s."lastPing" DESC NULLS LAST
    `;
    res.json(rows);
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
      where: { sensorId: req.params.id, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" }
    });
    res.json(readings);
  } catch (err) {
    next(err);
  }
});

export default router;
