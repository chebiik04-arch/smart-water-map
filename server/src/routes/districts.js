import { Router } from "express";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, name, "droughtRiskLevel", "createdAt",
        ST_AsGeoJSON(geometry)::json AS geometry
      FROM "District"
      ORDER BY name ASC
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
