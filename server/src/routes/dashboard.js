import { Router } from "express";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/summary", async (req, res, next) => {
  try {
    const [activeAlerts, sensorsOnline, districtsAtRisk, recentCommunityReports] = await Promise.all([
      prisma.droughtAlert.count({ where: { resolvedAt: null } }),
      prisma.sensor.count({ where: { status: "ONLINE" } }),
      prisma.district.count({ where: { droughtRiskLevel: { in: ["WATCH", "WARNING", "EMERGENCY"] } } }),
      prisma.communityReport.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true } }, district: { select: { name: true } } }
      })
    ]);

    res.json({ activeAlerts, sensorsOnline, districtsAtRisk, recentCommunityReports });
  } catch (err) {
    next(err);
  }
});

export default router;

