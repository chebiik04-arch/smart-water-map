import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createSensorReading } from "../services/readingService.js";
import { hashApiKey } from "../utils/apiKeys.js";

const router = Router();

router.post("/devices", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = z.object({
      sensorId: z.string().uuid(),
      externalId: z.string().min(2),
      authToken: z.string().min(12),
      provider: z.string().default("generic_http"),
      pollUrl: z.string().url().optional(),
      metadata: z.record(z.any()).optional()
    }).parse(req.body);
    const sensor = await prisma.sensor.findFirst({
      where: { id: input.sensorId, district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} },
      select: { id: true }
    });
    if (!sensor) return res.status(404).json({ error: "Sensor not found" });
    const device = await prisma.sensorDevice.upsert({
      where: { sensorId: sensor.id },
      update: {
        externalId: input.externalId,
        authTokenHash: hashApiKey(input.authToken),
        provider: input.provider,
        pollUrl: input.pollUrl,
        metadata: input.metadata || {}
      },
      create: {
        tenantId: req.user.tenantId,
        sensorId: sensor.id,
        externalId: input.externalId,
        authTokenHash: hashApiKey(input.authToken),
        provider: input.provider,
        pollUrl: input.pollUrl,
        metadata: input.metadata || {}
      }
    });
    res.status(201).json({ ...device, authTokenHash: undefined });
  } catch (err) {
    next(err);
  }
});

router.post("/readings", async (req, res, next) => {
  try {
    const token = req.headers["x-sensor-token"];
    const externalId = req.headers["x-sensor-id"] || req.body.externalId;
    if (!token || !externalId) return res.status(401).json({ error: "Missing sensor credentials" });
    const device = await prisma.sensorDevice.findFirst({
      where: { externalId: String(externalId), authTokenHash: hashApiKey(String(token)) },
      include: { sensor: true }
    });
    if (!device) return res.status(401).json({ error: "Invalid sensor credentials" });
    const input = readingSchema.parse(req.body);
    await prisma.sensorDevice.update({ where: { id: device.id }, data: { lastAuthenticated: new Date() } });
    const reading = await createSensorReading(device.sensorId, {
      value: input.value,
      unit: input.unit,
      metadata: { source: "device_push", providerTimestamp: input.timestamp, ...(input.metadata || {}) }
    });
    res.status(201).json(reading);
  } catch (err) {
    next(err);
  }
});

router.post("/readings/batch", async (req, res, next) => {
  try {
    const token = req.headers["x-sensor-token"];
    const input = z.object({ readings: z.array(readingSchema.extend({ externalId: z.string().min(2) })).min(1).max(500) }).parse(req.body);
    if (!token) return res.status(401).json({ error: "Missing sensor token" });
    const created = [];
    for (const row of input.readings) {
      const device = await prisma.sensorDevice.findFirst({
        where: { externalId: row.externalId, authTokenHash: hashApiKey(String(token)) },
        include: { sensor: true }
      });
      if (!device) continue;
      created.push(await createSensorReading(device.sensorId, {
        value: row.value,
        unit: row.unit,
        metadata: { source: "device_batch_push", providerTimestamp: row.timestamp, ...(row.metadata || {}) }
      }));
    }
    res.status(201).json({ createdCount: created.length, readings: created });
  } catch (err) {
    next(err);
  }
});

const readingSchema = z.object({
  value: z.number(),
  unit: z.string().min(1),
  timestamp: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export default router;
