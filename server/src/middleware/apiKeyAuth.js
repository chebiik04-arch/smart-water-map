import { prisma } from "../config/prisma.js";
import { metrics } from "../services/metrics.js";
import { hashApiKey } from "../utils/apiKeys.js";

export async function requireApiKey(req, res, next) {
  const rawKey = req.headers["x-api-key"] || req.query.apiKey;
  if (!rawKey) {
    metrics.increment("auth_failures_total", { reason: "missing_api_key" });
    return res.status(401).json({ error: "Missing x-api-key" });
  }

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: { keyHash: hashApiKey(String(rawKey)), status: "ACTIVE" },
      include: { tenant: true }
    });
    if (!apiKey) {
      metrics.increment("auth_failures_total", { reason: "invalid_api_key" });
      return res.status(401).json({ error: "Invalid API key" });
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const used = await prisma.apiUsage.count({ where: { apiKeyId: apiKey.id, usedAt: { gte: since } } });
    if (used >= apiKey.quotaPerHour) {
      metrics.increment("rate_limit_hits_total", { limiter: "public_api_quota" });
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
