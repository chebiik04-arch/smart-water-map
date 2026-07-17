const buckets = new Map();

export function rateLimit({ windowMs, max, keyPrefix = "global", key = defaultKey }) {
  return (req, res, next) => {
    const bucketKey = `${keyPrefix}:${key(req)}`;
    const now = Date.now();
    const bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({
        error: "Too many requests",
        code: "RATE_LIMITED",
        details: [{ retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }]
      });
    }

    return next();
  };
}

export const loginRateLimit = rateLimit({
  keyPrefix: "auth-login",
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase()}`
});

export const registrationRateLimit = rateLimit({
  keyPrefix: "auth-register",
  windowMs: 60 * 60 * 1000,
  max: 20
});

export const publicApiRateLimit = rateLimit({
  keyPrefix: "public-api",
  windowMs: 60 * 1000,
  max: 300,
  key: (req) => String(req.headers["x-api-key"] || req.query.apiKey || req.ip)
});

export const apiKeyManagementRateLimit = rateLimit({
  keyPrefix: "api-key-management",
  windowMs: 60 * 1000,
  max: 60,
  key: (req) => req.user?.id || req.ip
});

export const deviceIngestionRateLimit = rateLimit({
  keyPrefix: "device-ingestion",
  windowMs: 60 * 1000,
  max: 600,
  key: (req) => String(req.headers["x-sensor-id"] || req.body?.externalId || req.ip)
});

function defaultKey(req) {
  return req.ip;
}
