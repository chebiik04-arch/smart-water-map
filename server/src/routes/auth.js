import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { loginRateLimit, registrationRateLimit } from "../middleware/rateLimit.js";
import { hashApiKey } from "../utils/apiKeys.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "field_agent", "community_user"]).default("community_user"),
  adminScope: z.enum(["PLATFORM", "TENANT"]).optional(),
  district: z.string().optional()
});

router.post("/register", registrationRateLimit, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const tenant = req.tenantId
      ? await prisma.tenant.findUnique({ where: { id: req.tenantId } })
      : await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
    const adminScope = adminScopeFor(input, tenant?.id);
    const user = await prisma.user.create({
      data: { tenantId: tenant?.id, name: input.name, email: input.email, passwordHash, role: input.role, adminScope, district: input.district },
      select: userSelect
    });
    res.status(201).json({ user, ...(await issueTokenPair(user)) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", loginRateLimit, async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (user.status !== "ACTIVE") return res.status(403).json({ error: "User account is inactive" });
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: userSelect
    });
    return res.json({ user: updatedUser, ...(await issueTokenPair(updatedUser)) });
  } catch (err) {
    return next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(32) }).parse(req.body);
    const tokenHash = hashApiKey(refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: userSelect } }
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      return res.status(401).json({ error: "Invalid or expired refresh token", code: "REFRESH_TOKEN_INVALID" });
    }
    if (stored.user.status !== "ACTIVE") {
      await revokeUserRefreshTokens(stored.user.id);
      return res.status(401).json({ error: "User account is inactive", code: "USER_INACTIVE" });
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return res.json({ user: stored.user, ...(await issueTokenPair(stored.user)) });
  } catch (err) {
    return next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(32).optional() }).parse(req.body || {});
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashApiKey(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

const accessTokenTtl = "15m";
const refreshTokenTtlMs = 30 * 24 * 60 * 60 * 1000;

const userSelect = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  role: true,
  adminScope: true,
  status: true,
  tokenVersion: true,
  district: true,
  points: true,
  lastLoginAt: true,
  createdAt: true
};

function signToken(user) {
  return jwt.sign({
    sub: user.id,
    role: user.role,
    adminScope: user.adminScope,
    tenantId: user.tenantId,
    tokenVersion: user.tokenVersion
  }, env.jwtSecret, { expiresIn: accessTokenTtl });
}

async function issueTokenPair(user) {
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashApiKey(refreshToken),
      expiresAt: new Date(Date.now() + refreshTokenTtlMs)
    }
  });
  return {
    token: signToken(user),
    accessToken: signToken(user),
    expiresIn: 15 * 60,
    refreshToken,
    refreshExpiresIn: Math.floor(refreshTokenTtlMs / 1000)
  };
}

function adminScopeFor(input, tenantId) {
  if (input.role !== "admin") return null;
  if (input.adminScope) return input.adminScope;
  return tenantId ? "TENANT" : "PLATFORM";
}

async function revokeUserRefreshTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export default router;
