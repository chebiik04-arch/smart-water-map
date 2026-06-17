import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { monthLabel, monthsBack } from "../utils/time.js";

export const ndviRouter = Router();
export const rainfallRouter = Router();
export const groundwaterRouter = Router();

ndviRouter.get("/:districtId", async (req, res, next) => {
  try {
    const months = requestedMonths(req.query.months);
    const start = new Date(`${monthsBack(months)[0]}-01T00:00:00.000Z`);
    const rows = await prisma.$queryRaw`
      SELECT to_char(date_trunc('month', "capturedAt"), 'YYYY-MM') AS month, AVG(value)::float AS value
      FROM "NDVIReading"
      WHERE "districtId" = ${req.params.districtId}::uuid
        AND "capturedAt" >= ${start}
        AND (${req.tenantId || null}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM "District" d WHERE d.id = "NDVIReading"."districtId" AND d."tenantId" = ${req.tenantId || null}::uuid
        ))
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    res.json(fillSeries(rows, months, "value", 0.45));
  } catch (err) {
    next(err);
  }
});

rainfallRouter.get("/:districtId", async (req, res, next) => {
  try {
    const months = requestedMonths(req.query.months);
    const rows = await prisma.rainfallRecord.findMany({
      where: {
        districtId: req.params.districtId,
        month: { in: monthsBack(months) },
        district: req.tenantId ? { tenantId: req.tenantId } : {}
      },
      orderBy: { month: "asc" }
    });
    res.json(fillSeries(rows, months, "mmTotal", 0));
  } catch (err) {
    next(err);
  }
});

groundwaterRouter.get("/:districtId", async (req, res, next) => {
  try {
    const months = requestedMonths(req.query.months);
    const start = `${monthsBack(months)[0]}-01`;
    const rows = await prisma.$queryRaw`
      SELECT to_char(date_trunc('month', wsr.timestamp), 'YYYY-MM') AS month,
        AVG(wsr."waterLevel")::float AS "avgDepth"
      FROM "WaterSourceReading" wsr
      JOIN "WaterSource" ws ON ws.id = wsr."sourceId"
      WHERE ws."districtId" = ${req.params.districtId}::uuid
        AND wsr.timestamp >= ${new Date(`${start}T00:00:00.000Z`)}
        AND (${req.tenantId || null}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM "District" d WHERE d.id = ws."districtId" AND d."tenantId" = ${req.tenantId || null}::uuid
        ))
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    res.json(fillSeries(rows, months, "avgDepth", -8));
  } catch (err) {
    next(err);
  }
});

function requestedMonths(value) {
  return Math.max(1, Math.min(24, Number(value || 6)));
}

function fillSeries(rows, count, key, fallback) {
  const byMonth = Object.fromEntries(rows.map((row) => [row.month, row]));
  return monthsBack(count).map((month) => ({
    month: monthLabel(month),
    [key]: Number((byMonth[month]?.[key] ?? fallback).toFixed(2))
  }));
}
