import { Router } from "express";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/:districtId", async (req, res, next) => {
  try {
    const forecasts = await prisma.droughtForecast.findMany({
      where: { districtId: req.params.districtId },
      orderBy: { forecastDate: "asc" },
      take: 30
    });
    res.json(forecasts);
  } catch (err) {
    next(err);
  }
});

export default router;

