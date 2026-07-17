import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { emitAlertResolved } from "../services/socket.js";
import { timeAgo } from "../utils/time.js";
import { paginationParams } from "../utils/http.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = paginationParams(req.query, { defaultLimit: 100 });
    const status = req.query.status || "ACTIVE";
    const where = {
      ...(req.query.districtId ? { districtId: req.query.districtId } : {}),
      ...(req.tenantId ? { district: { tenantId: req.tenantId } } : {}),
      ...(status === "ACTIVE" ? { resolvedAt: null } : {})
    };
    const alerts = await prisma.droughtAlert.findMany({
      where,
      include: { district: { select: { id: true, name: true, droughtRiskLevel: true } } },
      orderBy: { triggeredAt: "desc" },
      take: limit,
      skip: offset
    });
    res.json(alerts.map((alert) => ({
      ...alert,
      subDistrict: alert.subDistrict || alert.district?.name,
      timeAgo: timeAgo(alert.triggeredAt)
    })));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/resolve", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const existing = await prisma.droughtAlert.findFirst({
      where: { id: req.params.id, district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} },
      select: { id: true }
    });
    if (!existing) return res.status(404).json({ error: "Alert not found" });
    const alert = await prisma.droughtAlert.update({
      where: { id: req.params.id },
      data: { resolvedAt: new Date() }
    });
    emitAlertResolved({ ...alert, tenantId: req.user.tenantId });
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/escalate", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const existing = await prisma.droughtAlert.findFirst({
      where: { id: req.params.id, district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} },
      select: { id: true, severity: true }
    });
    if (!existing) return res.status(404).json({ error: "Alert not found" });
    const severity = existing.severity === "WATCH" ? "WARNING" : "EMERGENCY";
    const alert = await prisma.droughtAlert.update({ where: { id: req.params.id }, data: { severity } });
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

export default router;
