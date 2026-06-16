import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "field_agent", "community_user"]).default("community_user"),
  district: z.string().optional()
});

router.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
    const user = await prisma.user.create({
      data: { tenantId: tenant?.id, name: input.name, email: input.email, passwordHash, role: input.role, district: input.district },
      select: { id: true, tenantId: true, name: true, email: true, role: true, district: true, createdAt: true }
    });
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser, token: signToken(user) });
  } catch (err) {
    return next(err);
  }
});

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tenantId: user.tenantId }, env.jwtSecret, { expiresIn: "12h" });
}

export default router;
