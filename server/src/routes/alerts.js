import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { emitAlertResolved } from "../services/socket.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const alerts = await prisma.droughtAlert.findMany({
      where: { resolvedAt: null },
      include: { district: { select: { id: true, name: true, droughtRiskLevel: true } } },
      orderBy: { triggeredAt: "desc" }
    });
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/resolve", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const alert = await prisma.droughtAlert.update({
      where: { id: req.params.id },
      data: { resolvedAt: new Date() }
    });
    emitAlertResolved(alert);
    res.json(alert);
  } catch (err) {
    next(err);
  }
});

export default router;

