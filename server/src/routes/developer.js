import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { generateApiKey, hashApiKey, keyPrefix } from "../utils/apiKeys.js";
import { paginationParams } from "../utils/http.js";

const router = Router();

router.get("/portal", (req, res) => {
  res.json({
    title: "Smart Water Map Research API",
    authentication: "Send x-api-key with each /api/v1/public request.",
    defaultQuotaPerHour: 100,
    endpoints: [
      "GET /api/v1/public/districts",
      "GET /api/v1/public/sensors",
      "GET /api/v1/public/readings?sensorId=<uuid>"
    ]
  });
});

router.post("/api-keys", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().min(2),
      ownerEmail: z.string().email(),
      quotaPerHour: z.number().int().min(1).max(10000).default(100)
    }).parse(req.body);
    const key = generateApiKey();
    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: req.user.tenantId,
        name: input.name,
        ownerEmail: input.ownerEmail,
        quotaPerHour: input.quotaPerHour,
        keyHash: hashApiKey(key),
        keyPrefix: keyPrefix(key)
      }
    });
    res.status(201).json({ apiKey: { ...apiKey, keyHash: undefined }, key });
  } catch (err) {
    next(err);
  }
});

router.get("/api-keys", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { limit, offset } = paginationParams(req.query);
    const keys = await prisma.apiKey.findMany({
      where: req.user.tenantId ? { tenantId: req.user.tenantId } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: { id: true, name: true, keyPrefix: true, ownerEmail: true, quotaPerHour: true, status: true, createdAt: true, lastUsedAt: true }
    });
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

router.get("/usage", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { limit, offset } = paginationParams(req.query);
    const usage = await prisma.apiUsage.findMany({
      where: { apiKey: req.user.tenantId ? { tenantId: req.user.tenantId } : {} },
      include: { apiKey: { select: { name: true, keyPrefix: true } } },
      orderBy: { usedAt: "desc" },
      take: limit,
      skip: offset
    });
    res.json(usage);
  } catch (err) {
    next(err);
  }
});

export default router;
