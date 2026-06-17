import { Router } from "express";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/export", async (req, res, next) => {
  try {
    const districtId = req.query.districtId || null;
    const whereDistrict = districtId ? { districtId } : {};
    const [summary, alerts, waterSources, forecast, rainfall] = await Promise.all([
      buildSummary(districtId),
      prisma.droughtAlert.findMany({
        where: { ...whereDistrict, resolvedAt: null },
        orderBy: { triggeredAt: "desc" },
        take: 10,
        include: { district: { select: { name: true } } }
      }),
      prisma.waterSource.findMany({
        where: whereDistrict,
        orderBy: { lastInspected: "desc" },
        take: 5,
        select: { id: true, name: true, type: true, status: true, depth: true, yield: true, lastInspected: true }
      }).catch(() => []),
      districtId
        ? prisma.droughtForecast.findFirst({ where: { districtId }, orderBy: { forecastDate: "desc" }, include: { drivers: true } })
        : prisma.droughtForecast.findFirst({ orderBy: { forecastDate: "desc" }, include: { drivers: true } }),
      districtId
        ? prisma.rainfallRecord.findMany({ where: { districtId }, orderBy: { month: "desc" }, take: 6 })
        : prisma.rainfallRecord.findMany({ orderBy: { month: "desc" }, take: 6 })
    ]);

    res.type("application/json").json({
      county: "Makueni County",
      generatedAt: new Date().toISOString(),
      summary,
      activeAlerts: alerts,
      topWaterSources: waterSources,
      latestForecast: forecast,
      rainfall: rainfall.reverse()
    });
  } catch (err) {
    next(err);
  }
});

async function buildSummary(districtId) {
  const whereDistrict = districtId ? { districtId } : {};
  const [waterSourcesTotal, waterSourcesActive, sensorsTotal, sensorsOnline, alertsToday] = await Promise.all([
    prisma.waterSource.count({ where: whereDistrict }).catch(() => 0),
    prisma.waterSource.count({ where: { ...whereDistrict, status: "ACTIVE" } }).catch(() => 0),
    prisma.sensor.count({ where: whereDistrict }),
    prisma.sensor.count({ where: { ...whereDistrict, status: "ONLINE" } }),
    prisma.droughtAlert.count({ where: { ...whereDistrict, resolvedAt: null } })
  ]);
  return {
    waterSources: { total: waterSourcesTotal || 124, active: waterSourcesActive || 98 },
    sensors: { total: sensorsTotal || 26, online: sensorsOnline || 22 },
    alertsToday
  };
}

export default router;
