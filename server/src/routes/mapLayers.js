import { Router } from "express";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/drought-timeline", async (req, res, next) => {
  try {
    const rows = await prisma.droughtSnapshot.findMany({
      where: { district: req.tenantId ? { tenantId: req.tenantId } : {} },
      orderBy: [{ weekStart: "asc" }, { districtId: "asc" }],
      include: { district: { select: { name: true } } }
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/boreholes", async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT b.id, b.name, b."districtId", d.name AS "districtName", b."depthMeters",
        b."yieldLitersPerHour", b.status, b."lastInspectedAt",
        ST_AsGeoJSON(b.location)::json AS location
      FROM "Borehole" b
      JOIN "District" d ON d.id = b."districtId"
      WHERE (${req.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.tenantId || null}::uuid)
      ORDER BY b.status ASC, b.name ASC
    `;
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/conflict-risks", async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, name, "riskScore", "incidentsLastYear", notes, "updatedAt",
        ST_AsGeoJSON(geometry)::json AS geometry
      FROM "ConflictRiskArea"
      WHERE (${req.tenantId || null}::uuid IS NULL OR "tenantId" = ${req.tenantId || null}::uuid)
      ORDER BY "riskScore" DESC
    `;
    res.json(toFeatureCollection(rows, (row) => ({
      name: row.name,
      riskScore: row.riskScore,
      incidentsLastYear: row.incidentsLastYear,
      notes: row.notes,
      updatedAt: row.updatedAt
    })));
  } catch (err) {
    next(err);
  }
});

router.get("/hydro-events", async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT h.id, h."districtId", d.name AS "districtName", h."eventType", h.severity,
        h."eventDate", h.notes, ST_AsGeoJSON(h.geometry)::json AS geometry
      FROM "HydroEvent" h
      JOIN "District" d ON d.id = h."districtId"
      WHERE (${req.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.tenantId || null}::uuid)
      ORDER BY h."eventDate" DESC
    `;
    res.json(toFeatureCollection(rows, (row) => ({
      districtId: row.districtId,
      districtName: row.districtName,
      eventType: row.eventType,
      severity: row.severity,
      eventDate: row.eventDate,
      notes: row.notes
    })));
  } catch (err) {
    next(err);
  }
});

function toFeatureCollection(rows, propertiesFor) {
  return {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      id: row.id,
      geometry: row.geometry,
      properties: propertiesFor(row)
    }))
  };
}

export default router;
