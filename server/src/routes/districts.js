import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { paginationParams } from "../utils/http.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = paginationParams(req.query);
    const rows = await prisma.$queryRaw`
      SELECT id, name, "droughtRiskLevel", "createdAt",
        ST_AsGeoJSON(geometry)::json AS geometry
      FROM "District"
      WHERE (${req.tenantId || null}::uuid IS NULL OR "tenantId" = ${req.tenantId || null}::uuid)
      ORDER BY name ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    res.json({
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature",
        id: row.id,
        properties: { name: row.name, droughtRiskLevel: row.droughtRiskLevel, createdAt: row.createdAt },
        geometry: row.geometry
      }))
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/status", async (req, res, next) => {
  try {
    const district = await prisma.district.findUnique({
      where: { id: req.params.id },
      include: {
        droughtAlerts: { where: { resolvedAt: null }, orderBy: { triggeredAt: "desc" } },
        droughtForecasts: { orderBy: { forecastDate: "desc" }, take: 1 }
      }
    });
    if (!district) return res.status(404).json({ error: "District not found" });
    if (req.tenantId && district.tenantId !== req.tenantId) return res.status(404).json({ error: "District not found" });

    const [sensorCount, reportCount] = await Promise.all([
      prisma.sensor.count({ where: { districtId: district.id, status: "ONLINE" } }),
      prisma.communityReport.count({ where: { districtId: district.id, status: "PENDING" } })
    ]);

    return res.json({ district, sensorCount, pendingCommunityReports: reportCount });
  } catch (err) {
    return next(err);
  }
});

export default router;
