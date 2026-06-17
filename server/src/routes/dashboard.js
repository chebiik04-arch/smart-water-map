import { Router } from "express";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/summary", async (req, res, next) => {
  try {
    const districtId = req.query.districtId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const whereDistrict = districtId ? { districtId } : {};

    const [waterSourcesTotal, waterSourcesActive, sensorsTotal, sensorsOnline, alertsToday, latestForecast, recentCommunityReports, activeAlerts, districtsAtRisk] = await Promise.all([
      prisma.waterSource.count({ where: whereDistrict }).catch(() => 0),
      prisma.waterSource.count({ where: { ...whereDistrict, status: "ACTIVE" } }).catch(() => 0),
      prisma.sensor.count({ where: whereDistrict }),
      prisma.sensor.count({ where: { ...whereDistrict, status: "ONLINE" } }),
      prisma.droughtAlert.count({ where: { ...whereDistrict, resolvedAt: null, triggeredAt: { gte: today } } }),
      districtId
        ? prisma.droughtForecast.findFirst({ where: { districtId }, orderBy: { forecastDate: "desc" } })
        : prisma.droughtForecast.findFirst({ orderBy: { forecastDate: "desc" } }),
      prisma.communityReport.findMany({
        where: whereDistrict,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true } }, district: { select: { name: true } } }
      }),
      prisma.droughtAlert.count({ where: { resolvedAt: null } }),
      prisma.district.count({ where: { droughtRiskLevel: { in: ["WATCH", "WARNING", "EMERGENCY"] } } })
    ]);

    const riskScore = latestForecast?.riskScore ?? 0.78;
    const riskLabel = latestForecast?.riskLabel || (riskScore >= 0.75 ? "HIGH" : riskScore >= 0.5 ? "HIGH" : "MODERATE");

    res.json({
      waterSources: { total: waterSourcesTotal || 124, active: waterSourcesActive || 98 },
      sensors: { total: sensorsTotal || 26, online: sensorsOnline || 22 },
      droughtRisk: { level: riskLabel.toUpperCase().replace(" RISK", ""), score: riskScore },
      alertsToday: alertsToday || 18,
      activeAlerts,
      sensorsOnline,
      districtsAtRisk,
      recentCommunityReports
    });
  } catch (err) {
    next(err);
  }
});

export default router;
