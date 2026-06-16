import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/reports", async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT cr.id, cr."userId", cr."districtId", cr."waterLevel", cr.description, cr."photoUrl",
        cr."photoMetadata", cr."gpsAccuracyMeters", cr.source, cr."externalReporterPhone", cr.status, cr."createdAt",
        u.name AS "userName", d.name AS "districtName", ST_AsGeoJSON(cr.location)::json AS location
      FROM "CommunityReport" cr
      LEFT JOIN "User" u ON u.id = cr."userId"
      LEFT JOIN "District" d ON d.id = cr."districtId"
      ORDER BY cr."createdAt" DESC
      LIMIT 100
    `;
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/report", authenticate, async (req, res, next) => {
  try {
    const input = z.object({
      districtId: z.string().uuid().optional(),
      latitude: z.number(),
      longitude: z.number(),
      waterLevel: z.number(),
      description: z.string().min(5),
      photoUrl: z.string().optional(),
      photoMetadata: z.record(z.any()).optional(),
      gpsAccuracyMeters: z.number().optional(),
      source: z.enum(["MOBILE_APP", "OFFLINE_SYNC"]).default("MOBILE_APP")
    }).parse(req.body);

    const [report] = await prisma.$queryRaw`
      INSERT INTO "CommunityReport" (id, "userId", "districtId", location, "waterLevel", description, "photoUrl",
        "photoMetadata", "gpsAccuracyMeters", source, status, "createdAt")
      VALUES (gen_random_uuid(), ${req.user.id}::uuid, ${input.districtId || null}::uuid,
        ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
        ${input.waterLevel}, ${input.description}, ${input.photoUrl || null},
        ${input.photoMetadata || null}::jsonb, ${input.gpsAccuracyMeters || null}, ${input.source}::"ReportSource", 'PENDING', NOW())
      RETURNING id, "userId", "districtId", "waterLevel",
        description, "photoUrl", "photoMetadata", "gpsAccuracyMeters", source, status, "createdAt",
        ST_AsGeoJSON(location)::json AS location
    `;
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

router.post("/reports/:id/verify", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const [report] = await prisma.$queryRaw`
      UPDATE "CommunityReport"
      SET status = 'VERIFIED'::"ReportStatus"
      WHERE id = ${req.params.id}::uuid
      RETURNING id, "userId", "districtId", "waterLevel", description, "photoUrl", source, status, "createdAt",
        ST_AsGeoJSON(location)::json AS location
    `;
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.userId) {
      await prisma.user.update({ where: { id: report.userId }, data: { points: { increment: 10 } } });
    }
    res.json({ report, awardedPoints: report.userId ? 10 : 0 });
  } catch (err) {
    next(err);
  }
});

router.get("/leaderboard", async (req, res, next) => {
  try {
    const leaders = await prisma.user.findMany({
      where: { role: { in: ["field_agent", "community_user"] } },
      orderBy: [{ points: "desc" }, { createdAt: "asc" }],
      take: 20,
      select: { id: true, name: true, district: true, role: true, points: true }
    });
    res.json(leaders);
  } catch (err) {
    next(err);
  }
});

router.post("/voice/ivr", async (req, res, next) => {
  try {
    const input = voiceReportSchema.parse(req.body);
    const report = await createExternalReport({ ...input, source: "IVR" });
    res.status(201).json({ report, message: "IVR water level report accepted" });
  } catch (err) {
    next(err);
  }
});

router.post("/voice/whatsapp", async (req, res, next) => {
  try {
    const input = voiceReportSchema.parse(req.body);
    const report = await createExternalReport({ ...input, source: "WHATSAPP" });
    res.status(201).json({ report, message: "WhatsApp water level report accepted" });
  } catch (err) {
    next(err);
  }
});

const voiceReportSchema = z.object({
  phone: z.string().min(7),
  latitude: z.number(),
  longitude: z.number(),
  waterLevel: z.number(),
  description: z.string().min(3),
  districtId: z.string().uuid().optional()
});

async function createExternalReport(input) {
  const systemUser = await prisma.user.upsert({
    where: { email: "voice-reports@smartwater.local" },
    update: {},
    create: {
      name: "Voice Reports",
      email: "voice-reports@smartwater.local",
      passwordHash: "external-channel-disabled",
      role: "community_user",
      district: "External intake"
    }
  });
  const [report] = await prisma.$queryRaw`
    INSERT INTO "CommunityReport" (id, "userId", "districtId", location, "waterLevel", description,
      source, "externalReporterPhone", status, "createdAt")
    VALUES (gen_random_uuid(), ${systemUser.id}::uuid, ${input.districtId || null}::uuid,
      ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
      ${input.waterLevel}, ${input.description}, ${input.source}::"ReportSource", ${input.phone}, 'PENDING', NOW())
    RETURNING id, "userId", "districtId", "waterLevel", description, source, "externalReporterPhone", status, "createdAt",
      ST_AsGeoJSON(location)::json AS location
  `;
  return report;
}

export default router;
