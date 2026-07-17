import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { metrics } from "../services/metrics.js";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    recordAuthFailure("missing_bearer_token");
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      recordAuthFailure("invalid_subject");
      return res.status(401).json({ error: "Invalid token subject" });
    }
    if (user.status !== "ACTIVE") {
      recordAuthFailure("inactive_user");
      return res.status(401).json({ error: "User account is inactive", code: "USER_INACTIVE" });
    }
    if (payload.tokenVersion !== user.tokenVersion) {
      recordAuthFailure("token_revoked");
      return res.status(401).json({ error: "Token has been revoked", code: "TOKEN_REVOKED" });
    }
    req.user = user;
    return next();
  } catch {
    recordAuthFailure("invalid_or_expired_token");
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      recordAuthFailure("insufficient_permissions");
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    return next();
  };
}

export function requireAdminScope(...scopes) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== "admin" || !scopes.includes(req.user.adminScope)) {
      recordAuthFailure("insufficient_admin_scope");
      return res.status(403).json({ error: "Insufficient admin scope" });
    }
    return next();
  };
}

function recordAuthFailure(reason) {
  metrics.increment("auth_failures_total", { reason });
}
