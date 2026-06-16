import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { requireApiKey } from "../middleware/apiKeyAuth.js";

const router = Router();
router.use(requireApiKey);

router.get("/districts", async (req, res, next) => {
  try {
    const districts = await prisma.district.findMany({
      where: req.tenantId ? { tenantId: req.tenantId } : {},
      select: { id: true, name: true, droughtRiskLevel: true, createdAt: true }
    });
    res.json(districts);
  } catch (err) {
    next(err);
  }
});

router.get("/sensors", async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT s.id, s.type, s.status, s."lastPing", d.name AS "districtName", ST_AsGeoJSON(s.location)::json AS location
      FROM "Sensor" s
      JOIN "District" d ON d.id = s."districtId"
      WHERE (${req.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.tenantId || null}::uuid)
      ORDER BY s."lastPing" DESC NULLS LAST
    `;
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/readings", async (req, res, next) => {
  try {
    const { sensorId } = req.query;
    if (!sensorId) return res.status(400).json({ error: "sensorId is required" });
    const readings = await prisma.sensorReading.findMany({
      where: { sensorId: String(sensorId) },
      orderBy: { timestamp: "desc" },
      take: 500
    });
    res.json(readings);
  } catch (err) {
    next(err);
  }
});

export default router;

