import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createSensorReading } from "../services/readingService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { type, district } = req.query;
    const rows = await prisma.$queryRaw`
      SELECT s.id, s.type, s.status, s."lastPing", s."districtId",
        d.name AS "districtName", ST_AsGeoJSON(s.location)::json AS location
      FROM "Sensor" s
      JOIN "District" d ON d.id = s."districtId"
      WHERE (${type || null}::text IS NULL OR s.type::text = ${type || null})
        AND (${district || null}::uuid IS NULL OR s."districtId" = ${district || null}::uuid)
      ORDER BY s."lastPing" DESC NULLS LAST
    `;
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reading", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = z.object({
      value: z.number(),
      unit: z.string().min(1),
      metadata: z.record(z.any()).optional()
    }).parse(req.body);
    const reading = await createSensorReading(req.params.id, input);
    res.status(201).json(reading);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/readings", async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const readings = await prisma.sensorReading.findMany({
      where: { sensorId: req.params.id, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" }
    });
    res.json(readings);
  } catch (err) {
    next(err);
  }
});

router.get("/operations/health", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const staleHours = Number(req.query.staleHours || 6);
    const rows = await prisma.$queryRaw`
      SELECT s.id, s.type, s.status, s."lastPing", s."districtId", d.name AS "districtName",
        EXTRACT(EPOCH FROM (NOW() - COALESCE(s."lastPing", NOW() - interval '999 hours'))) / 3600 AS "hoursSincePing",
        COUNT(mt.id)::int AS "openTickets"
      FROM "Sensor" s
      JOIN "District" d ON d.id = s."districtId"
      LEFT JOIN "MaintenanceTicket" mt ON mt."sensorId" = s.id AND mt.status != 'RESOLVED'::"MaintenanceTicketStatus"
      WHERE (${req.user.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.user.tenantId || null}::uuid)
      GROUP BY s.id, d.name
      ORDER BY "hoursSincePing" DESC
    `;
    res.json({ staleHours, sensors: rows, stale: rows.filter((row) => Number(row.hoursSincePing) >= staleHours) });
  } catch (err) {
    next(err);
  }
});

router.get("/operations/tickets", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const tickets = await prisma.maintenanceTicket.findMany({
      where: { sensor: { district: req.user.tenantId ? { tenantId: req.user.tenantId } : {} } },
      include: { sensor: { select: { id: true, type: true, status: true, lastPing: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

router.post("/operations/tickets/:id/status", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = z.object({
      status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED"]),
      assignedTo: z.string().optional()
    }).parse(req.body);
    const ticket = await prisma.maintenanceTicket.update({
      where: { id: req.params.id },
      data: {
        status: input.status,
        assignedTo: input.assignedTo,
        resolvedAt: input.status === "RESOLVED" ? new Date() : null
      }
    });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

export default router;
