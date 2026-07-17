import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { paginationParams } from "../utils/http.js";

const router = Router();

router.get("/:districtId", async (req, res, next) => {
  try {
    const { limit, offset } = paginationParams(req.query, { defaultLimit: 120, maxLimit: 120 });
    const indexes = await prisma.satelliteIndex.findMany({
      where: { districtId: req.params.districtId, district: req.tenantId ? { tenantId: req.tenantId } : {} },
      orderBy: { capturedAt: "desc" },
      take: limit,
      skip: offset
    });
    res.json(indexes);
  } catch (err) {
    next(err);
  }
});

export default router;
