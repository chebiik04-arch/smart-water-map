import { prisma } from "../config/prisma.js";
import { hashApiKey } from "../utils/apiKeys.js";

export async function requireApiKey(req, res, next) {
  const rawKey = req.headers["x-api-key"] || req.query.apiKey;
  if (!rawKey) {
    return res.status(401).json({ error: "Missing x-api-key" });
  }

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: { keyHash: hashApiKey(String(rawKey)), status: "ACTIVE" },
      include: { tenant: true }
    });
    if (!apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const used = await prisma.apiUsage.count({ where: { apiKeyId: apiKey.id, usedAt: { gte: since } } });
    if (used >= apiKey.quotaPerHour) {
      return res.status(429).json({ error: "API quota exceeded", quotaPerHour: apiKey.quotaPerHour });
    }

    await prisma.$transaction([
      prisma.apiUsage.create({ data: { apiKeyId: apiKey.id, route: req.originalUrl } }),
      prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    ]);

    req.apiKey = apiKey;
    req.tenantId = apiKey.tenantId;
    return next();
  } catch (err) {
    return next(err);
  }
}

