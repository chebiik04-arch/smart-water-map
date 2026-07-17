import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { paginationParams } from "../utils/http.js";

const router = Router();

router.get("/", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { limit, offset } = paginationParams(req.query);
    const where = req.user.tenantId ? { id: req.user.tenantId } : {};
    const tenants = await prisma.tenant.findMany({
      where,
      include: { _count: { select: { users: true, districts: true, apiKeys: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset
    });
    res.json(tenants);
  } catch (err) {
    next(err);
  }
});

router.post("/", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    if (req.user.tenantId) return res.status(403).json({ error: "Only platform admins can create tenants" });
    const input = tenantSchema.parse(req.body);
    const tenant = await prisma.tenant.create({
      data: { name: input.name, slug: input.slug, country: input.country, billingPlan: input.billingPlan, config: input.config || {} }
    });
    res.status(201).json(tenant);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    if (req.user.tenantId && req.user.tenantId !== req.params.id) return res.status(404).json({ error: "Tenant not found" });
    const input = tenantUpdateSchema.parse(req.body);
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data: input });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/users", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { limit, offset } = paginationParams(req.query);
    if (req.user.tenantId && req.user.tenantId !== req.params.id) return res.status(404).json({ error: "Tenant not found" });
    const users = await prisma.user.findMany({
      where: { tenantId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: { id: true, name: true, email: true, role: true, status: true, district: true, points: true, lastLoginAt: true, createdAt: true }
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/users", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    if (req.user.tenantId && req.user.tenantId !== req.params.id) return res.status(404).json({ error: "Tenant not found" });
    const input = userSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: { tenantId: req.params.id, name: input.name, email: input.email, passwordHash, role: input.role, district: input.district },
      select: { id: true, name: true, email: true, role: true, status: true, district: true, points: true, lastLoginAt: true, createdAt: true }
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.patch("/:tenantId/users/:userId", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    if (req.user.tenantId && req.user.tenantId !== req.params.tenantId) return res.status(404).json({ error: "Tenant not found" });
    const input = userUpdateSchema.parse(req.body);
    const existing = await prisma.user.findFirst({ where: { id: req.params.userId, tenantId: req.params.tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: "User not found" });
    const data = { ...input };
    if (input.password) {
      data.passwordHash = await bcrypt.hash(input.password, 12);
      delete data.password;
    }
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data,
      select: { id: true, name: true, email: true, role: true, status: true, district: true, points: true, lastLoginAt: true, createdAt: true }
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post("/:tenantId/users/:userId/deactivate", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    if (req.user.tenantId && req.user.tenantId !== req.params.tenantId) return res.status(404).json({ error: "Tenant not found" });
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { status: "INACTIVE" },
      select: { id: true, name: true, email: true, role: true, status: true, district: true, points: true, lastLoginAt: true, createdAt: true }
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

const tenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  country: z.string().min(2),
  billingPlan: z.string().default("starter"),
  config: z.record(z.any()).optional()
});

const tenantUpdateSchema = tenantSchema.partial();

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "field_agent", "community_user"]).default("community_user"),
  district: z.string().optional()
});

const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["admin", "field_agent", "community_user"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  district: z.string().optional()
});

export default router;
