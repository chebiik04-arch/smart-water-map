import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { paginationParams } from "../utils/http.js";

const router = Router();

router.get("/:districtId/latest", async (req, res, next) => {
  try {
    const forecast = await prisma.droughtForecast.findFirst({
      where: {
        districtId: req.params.districtId,
        drivers: { some: {} },
        district: req.tenantId ? { tenantId: req.tenantId } : {}
      },
      orderBy: { forecastDate: "desc" },
      include: { drivers: true }
    }) || await prisma.droughtForecast.findFirst({
      where: { districtId: req.params.districtId, district: req.tenantId ? { tenantId: req.tenantId } : {} },
      orderBy: { forecastDate: "desc" },
      include: { drivers: true }
    });
    if (!forecast) {
      return res.json({
        riskScore: 0.78,
        riskLabel: "High Risk",
        forecastDate: new Date().toISOString(),
        recommendation: ["Increase water harvesting", "Monitor boreholes closely"],
        drivers: defaultDrivers()
      });
    }
    res.json({
      riskScore: forecast.riskScore,
      riskLabel: forecast.riskLabel,
      forecastDate: forecast.forecastDate,
      recommendation: forecast.recommendation || ["Increase water harvesting", "Monitor boreholes closely"],
      drivers: forecast.drivers.length ? forecast.drivers.map(({ factor, direction, impact }) => ({ factor, direction, impact })) : defaultDrivers()
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:districtId", async (req, res, next) => {
  try {
    const { limit, offset } = paginationParams(req.query, { defaultLimit: 30 });
    const forecasts = await prisma.droughtForecast.findMany({
      where: { districtId: req.params.districtId, district: req.tenantId ? { tenantId: req.tenantId } : {} },
      orderBy: { forecastDate: "asc" },
      take: limit,
      skip: offset
    });
    res.json(forecasts);
  } catch (err) {
    next(err);
  }
});

function defaultDrivers() {
  return [
    { factor: "Rainfall Deficit", direction: "DOWN", impact: "HIGH" },
    { factor: "Temperature Anomaly", direction: "UP", impact: "HIGH" },
    { factor: "Vegetation Health", direction: "DOWN", impact: "MEDIUM" },
    { factor: "Soil Moisture", direction: "DOWN", impact: "MEDIUM" }
  ];
}

export default router;
