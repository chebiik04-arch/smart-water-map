import { Router } from "express";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/summary", async (req, res, next) => {
  try {
    const districtId = req.query.districtId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const districtTenant = req.tenantId ? { tenantId: req.tenantId } : {};
    let selectedDistrict = null;
    if (districtId) {
      selectedDistrict = await prisma.district.findFirst({ where: { id: districtId, ...districtTenant }, select: { id: true, droughtRiskLevel: true } });
      if (!selectedDistrict) return res.status(404).json({ error: "District not found" });
    }
    const whereDistrict = {
      ...(districtId ? { districtId } : {}),
      ...(req.tenantId ? { district: { tenantId: req.tenantId } } : {})
    };
    const districtWhere = { ...(req.tenantId ? { tenantId: req.tenantId } : {}) };

    const [waterSourcesTotal, waterSourcesActive, sensorsTotal, sensorsOnline, alertsToday, latestForecast, recentCommunityReports, activeAlerts, districtsAtRisk] = await Promise.all([
      prisma.waterSource.count({ where: whereDistrict }).catch(() => 0),
      prisma.waterSource.count({ where: { ...whereDistrict, status: "ACTIVE" } }).catch(() => 0),
      prisma.sensor.count({ where: whereDistrict }),
      prisma.sensor.count({ where: { ...whereDistrict, status: "ONLINE" } }),
      prisma.droughtAlert.count({ where: { ...whereDistrict, resolvedAt: null, triggeredAt: { gte: today } } }),
      districtId
        ? prisma.droughtForecast.findFirst({ where: whereDistrict, orderBy: { forecastDate: "desc" } })
        : prisma.droughtForecast.findFirst({ where: req.tenantId ? { district: { tenantId: req.tenantId } } : {}, orderBy: { forecastDate: "desc" } }),
      prisma.communityReport.findMany({
        where: whereDistrict,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true } }, district: { select: { name: true } } }
      }),
      prisma.droughtAlert.count({ where: { ...whereDistrict, resolvedAt: null } }),
      districtId
        ? prisma.district.count({ where: { id: districtId, ...districtWhere, droughtRiskLevel: { in: ["WATCH", "WARNING", "EMERGENCY"] } } })
        : prisma.district.count({ where: { ...districtWhere, droughtRiskLevel: { in: ["WATCH", "WARNING", "EMERGENCY"] } } })
    ]);

    const riskScore = latestForecast?.riskScore ?? 0;
    const riskLabel = latestForecast?.riskLabel || selectedDistrict?.droughtRiskLevel || (riskScore >= 0.75 ? "HIGH" : riskScore >= 0.5 ? "WARNING" : riskScore > 0 ? "WATCH" : "UNKNOWN");

    res.json({
      waterSources: { total: waterSourcesTotal, active: waterSourcesActive },
      sensors: { total: sensorsTotal, online: sensorsOnline },
      droughtRisk: { level: riskLabel.toUpperCase().replace(" RISK", ""), score: riskScore },
      alertsToday,
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
