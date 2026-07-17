import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ error: "Invalid token subject" });
    }
    if (user.status !== "ACTIVE") {
      return res.status(401).json({ error: "User account is inactive", code: "USER_INACTIVE" });
    }
    if (payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: "Token has been revoked", code: "TOKEN_REVOKED" });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    return next();
  };
}

export function requireAdminScope(...scopes) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== "admin" || !scopes.includes(req.user.adminScope)) {
      return res.status(403).json({ error: "Insufficient admin scope" });
    }
    return next();
  };
}
