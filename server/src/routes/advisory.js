import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { buildIrrigationAdvice } from "../services/irrigationAdvisor.js";
import { recommendationRationale, scoreCropVariety } from "../services/cropRecommender.js";
import { fetchExternalMarketPrices, marketDecisionHint } from "../services/marketPrices.js";

const router = Router();

router.post("/irrigation/schedule", authenticate, requireRole("admin", "field_agent", "community_user"), async (req, res, next) => {
  try {
    const input = z.object({
      districtId: z.string().uuid(),
      cropName: z.string().min(2),
      soilMoisturePercent: z.number().min(0).max(100).optional(),
      evapotranspirationMmDay: z.number().min(0).optional(),
      rainfallForecastMm: z.number().min(0).default(0)
    }).parse(req.body);

    const district = await prisma.district.findFirst({
      where: { id: input.districtId, ...(req.user.tenantId ? { tenantId: req.user.tenantId } : {}) },
      select: { id: true }
    });
    if (!district) return res.status(404).json({ error: "District not found" });

    const metrics = await latestAdvisoryMetrics(input.districtId);
    const advice = buildIrrigationAdvice({
      cropName: input.cropName,
      soilMoisturePercent: input.soilMoisturePercent ?? metrics.soilMoisturePercent,
      evapotranspirationMmDay: input.evapotranspirationMmDay ?? metrics.et,
      rainfallForecastMm: input.rainfallForecastMm
    });

    const schedule = await prisma.irrigationSchedule.create({
      data: {
        districtId: input.districtId,
        cropName: input.cropName,
        soilMoisturePercent: input.soilMoisturePercent ?? metrics.soilMoisturePercent,
        evapotranspirationMmDay: input.evapotranspirationMmDay ?? metrics.et,
        ...advice
      }
    });
    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
});

router.get("/irrigation/schedules", authenticate, async (req, res, next) => {
  try {
    const schedules = await prisma.irrigationSchedule.findMany({
      where: { district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} },
      include: { district: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(schedules);
  } catch (err) {
    next(err);
  }
});

router.get("/crops/recommendations/:districtId", authenticate, async (req, res, next) => {
  try {
    const district = await prisma.district.findFirst({
      where: { id: req.params.districtId, ...(req.user.tenantId ? { tenantId: req.user.tenantId } : {}) }
    });
    if (!district) return res.status(404).json({ error: "District not found" });
    const metrics = await latestAdvisoryMetrics(district.id);
    const varieties = await prisma.cropVariety.findMany({
      where: { tenantId: district.tenantId },
      orderBy: [{ droughtTolerance: "desc" }, { maturityDays: "asc" }]
    });
    const recommendations = varieties
      .map((variety) => ({
        variety,
        score: scoreCropVariety(variety, { riskLevel: district.droughtRiskLevel, ndvi: metrics.ndvi }),
        rationale: recommendationRationale(variety, { riskLevel: district.droughtRiskLevel, ndvi: metrics.ndvi })
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    res.json({ district, metrics, recommendations });
  } catch (err) {
    next(err);
  }
});

router.get("/market/prices", authenticate, async (req, res, next) => {
  try {
    let external = [];
    try {
      external = await fetchExternalMarketPrices();
    } catch (err) {
      console.warn("Market price provider unavailable, using stored prices", err.message);
    }
    const stored = await prisma.marketPrice.findMany({
      where: req.user.tenantId ? { tenantId: req.user.tenantId } : {},
      orderBy: { observedAt: "desc" },
      take: 100
    });
    res.json({ external, stored });
  } catch (err) {
    next(err);
  }
});

router.post("/market/prices", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = z.object({
      commodity: z.string().min(2),
      marketName: z.string().min(2),
      unit: z.string().min(1),
      price: z.number().positive(),
      currency: z.string().default("KES"),
      trend: z.enum(["RISING", "STABLE", "FALLING"]).default("STABLE"),
      source: z.string().default("field_update")
    }).parse(req.body);
    const price = await prisma.marketPrice.create({
      data: { tenantId: req.user.tenantId, observedAt: new Date(), decisionHint: marketDecisionHint(input), ...input }
    });
    res.status(201).json(price);
  } catch (err) {
    next(err);
  }
});

router.get("/livestock/water-stress", authenticate, async (req, res, next) => {
  try {
    const waterPoints = await prisma.$queryRaw`
      SELECT wp.id, wp.name, wp.status, wp."districtId", d.name AS "districtName", wp."waterVolumeLiters",
        wp."dailyDemandLiters", wp."daysRemaining", wp."supportedLivestock", wp."lastUpdatedAt",
        ST_AsGeoJSON(wp.location)::json AS location
      FROM "LivestockWaterPoint" wp
      JOIN "District" d ON d.id = wp."districtId"
      WHERE (${req.user.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.user.tenantId || null}::uuid)
      ORDER BY wp."daysRemaining" ASC
    `;
    const pasture = await prisma.pastureCondition.findMany({
      where: { district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} },
      include: { district: { select: { name: true } } },
      orderBy: { observedAt: "desc" },
      take: 30
    });
    res.json({ waterPoints, pasture });
  } catch (err) {
    next(err);
  }
});

async function latestAdvisoryMetrics(districtId) {
  const sensorRows = await prisma.$queryRaw`
    SELECT s.type, AVG(r.value)::float AS value
    FROM "Sensor" s
    JOIN "SensorReading" r ON r."sensorId" = s.id
    WHERE s."districtId" = ${districtId}::uuid
      AND r.timestamp >= NOW() - interval '14 days'
    GROUP BY s.type
  `;
  const byType = Object.fromEntries(sensorRows.map((row) => [row.type, row.value]));
  const indexes = await prisma.satelliteIndex.findMany({
    where: { districtId, indexType: { in: ["ET", "NDVI"] } },
    orderBy: { capturedAt: "desc" },
    take: 8
  });
  const latest = Object.fromEntries(indexes.map((item) => [item.indexType, item.value]));
  return {
    soilMoisturePercent: Number((byType.SOIL_MOISTURE ?? 38).toFixed(1)),
    et: Number((latest.ET ?? 4.2).toFixed(1)),
    ndvi: Number((latest.NDVI ?? 0.38).toFixed(2))
  };
}

export default router;
