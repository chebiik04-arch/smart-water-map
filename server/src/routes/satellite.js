import { Router } from "express";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/:districtId", async (req, res, next) => {
  try {
    const indexes = await prisma.satelliteIndex.findMany({
      where: { districtId: req.params.districtId, district: req.tenantId ? { tenantId: req.tenantId } : {} },
      orderBy: { capturedAt: "desc" },
      take: 120
    });
    res.json(indexes);
  } catch (err) {
    next(err);
  }
});

export default router;
