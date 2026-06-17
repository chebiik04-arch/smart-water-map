import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { simulateGroundwaterScenario } from "../services/digitalTwin.js";

const router = Router();

router.post("/groundwater", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = z.object({
      districtId: z.string().uuid(),
      scenarioName: z.string().min(2).default("Rainfall stress scenario"),
      rainfallDropPercent: z.number().min(0).max(100),
      durationWeeks: z.number().int().min(1).max(104)
    }).parse(req.body);

    const district = await prisma.district.findFirst({
      where: { id: input.districtId, ...(req.user.tenantId ? { tenantId: req.user.tenantId } : {}) },
      select: { id: true }
    });
    if (!district) return res.status(404).json({ error: "District not found" });

    const latest = await prisma.$queryRaw`
      SELECT AVG(r.value)::float AS groundwater
      FROM "Sensor" s
      JOIN "SensorReading" r ON r."sensorId" = s.id
      WHERE s."districtId" = ${input.districtId}::uuid
        AND s.type = 'GROUNDWATER'::"SensorType"
        AND r.timestamp >= NOW() - interval '30 days'
    `;
    const baselineGroundwater = Number(latest[0]?.groundwater ?? 62);
    const result = simulateGroundwaterScenario({ baselineGroundwater, ...input });
    const simulation = await prisma.digitalTwinSimulation.create({
      data: {
        tenantId: req.user.tenantId,
        districtId: input.districtId,
        scenarioName: input.scenarioName,
        rainfallDropPercent: input.rainfallDropPercent,
        durationWeeks: input.durationWeeks,
        baselineGroundwater,
        ...result
      }
    });
    res.status(201).json(simulation);
  } catch (err) {
    next(err);
  }
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const simulations = await prisma.digitalTwinSimulation.findMany({
      where: req.user.tenantId ? { tenantId: req.user.tenantId } : {},
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(simulations);
  } catch (err) {
    next(err);
  }
});

export default router;
