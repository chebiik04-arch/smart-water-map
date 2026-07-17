import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export function standardizeErrorResponses(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === "object" && "error" in body) {
      const { error, code, details, ...extra } = body;
      const extraDetails = Object.keys(extra).length ? [extra] : [];
      return json({
        error,
        code: code || codeForStatus(res.statusCode),
        details: Array.isArray(details) ? details : extraDetails
      });
    }
    return json(body);
  };
  return next();
}

export function notFound(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND",
    details: []
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const isZodError = err instanceof ZodError;
  const status = isZodError ? 400 : err.statusCode || err.status || 500;
  const code = isZodError ? "VALIDATION_ERROR" : err.code || (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR");
  const details = isZodError
    ? err.issues.map((issue) => ({ path: issue.path, message: issue.message, code: issue.code }))
    : err.details || [];
  const message = status >= 500 ? "Internal server error" : err.message;
  if (status >= 500) {
    logger.error("unhandled_error", {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      error: err.message,
      stack: err.stack
    });
  }
  return res.status(status).json({ error: message, code, details });
}

function codeForStatus(status) {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_SERVER_ERROR";
  return "REQUEST_ERROR";
}
