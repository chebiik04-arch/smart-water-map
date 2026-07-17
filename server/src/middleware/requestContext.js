import crypto from "node:crypto";
import { logger } from "../utils/logger.js";
import { emitOperationalAlert } from "../services/alerts.js";
import { metrics, routeLabel } from "../services/metrics.js";

export function requestContext(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_class: `${Math.floor(res.statusCode / 100)}xx`
    };
    metrics.increment("http_requests_total", labels);
    metrics.observeHttpLatency(labels, durationSeconds);
    logger.info("http_request", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      route: labels.route,
      status: res.statusCode,
      durationMs: Math.round(durationSeconds * 1000),
      ip: req.ip,
      userId: req.user?.id,
      tenantId: req.user?.tenantId || req.tenantId
    });
    if (res.statusCode >= 500) {
      emitOperationalAlert("api_5xx", "API returned 5xx response", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode
      });
    }
  });

  next();
}
