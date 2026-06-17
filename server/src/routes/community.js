import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { timeAgo } from "../utils/time.js";
import { saveReportEvidence } from "../services/uploadStorage.js";
import { sendIvrAcknowledgement, sendWhatsAppMessage } from "../providers/messagingProvider.js";
import { ivrResponse, parseIvrInbound, parseWhatsAppInbound, verifyInboundSignature } from "../providers/messagingInboundProvider.js";
import { advanceReportConversation } from "../services/conversationService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads are allowed"));
    return cb(null, true);
  }
});

router.get("/reports", async (req, res, next) => {
  try {
    const districtId = req.query.districtId || null;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 100)));
    const rows = await prisma.$queryRaw`
      SELECT cr.id, cr."userId", cr."districtId", cr."waterLevel", cr.description, cr."photoUrl",
        cr."photoMetadata", cr."gpsAccuracyMeters", cr.source, cr."externalReporterPhone", cr.status, cr."createdAt",
        u.name AS "userName", d.name AS "districtName", ST_AsGeoJSON(cr.location)::json AS location
      FROM "CommunityReport" cr
      LEFT JOIN "User" u ON u.id = cr."userId"
      LEFT JOIN "District" d ON d.id = cr."districtId"
      WHERE (${districtId}::uuid IS NULL OR cr."districtId" = ${districtId}::uuid)
        AND (${req.tenantId || null}::uuid IS NULL OR d."tenantId" = ${req.tenantId || null}::uuid)
      ORDER BY cr."createdAt" DESC
      LIMIT ${limit}
    `;
    res.json(rows.map((row) => ({
      ...row,
      reporterName: row.userName || row.externalReporterPhone || "Community reporter",
      timeAgo: timeAgo(row.createdAt),
      severityColor: severityColor(row.waterLevel, row.status)
    })));
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

    await assertDistrictAccess(input.districtId, req.user.tenantId);
    const [report] = await prisma.$queryRaw`
      INSERT INTO "CommunityReport" (id, "userId", "districtId", location, "waterLevel", description, "photoUrl",
        "photoMetadata", "gpsAccuracyMeters", source, status, "createdAt")
      VALUES (gen_random_uuid(), ${req.user.id}::uuid, ${input.districtId || null}::uuid,
        ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
        ${input.waterLevel}, ${input.description}, ${input.photoUrl || null},
        ${input.photoMetadata ? JSON.stringify(input.photoMetadata) : null}::jsonb, ${input.gpsAccuracyMeters || null}, ${input.source}::"ReportSource", 'PENDING', NOW())
      RETURNING id, "userId", "districtId", "waterLevel",
        description, "photoUrl", "photoMetadata", "gpsAccuracyMeters", source, status, "createdAt",
        ST_AsGeoJSON(location)::json AS location
    `;
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

router.post("/report/upload", authenticate, upload.single("photo"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "photo file is required" });
    const input = z.object({
      districtId: z.string().uuid().optional(),
      latitude: z.coerce.number(),
      longitude: z.coerce.number(),
      waterLevel: z.coerce.number(),
      description: z.string().min(5),
      gpsAccuracyMeters: z.coerce.number().optional()
    }).parse(req.body);
    await assertDistrictAccess(input.districtId, req.user.tenantId);
    const stored = await saveReportEvidence(req.file, { tenantId: req.user.tenantId });
    const [report] = await prisma.$queryRaw`
      INSERT INTO "CommunityReport" (id, "userId", "districtId", location, "waterLevel", description, "photoUrl",
        "photoMetadata", "gpsAccuracyMeters", source, status, "createdAt")
      VALUES (gen_random_uuid(), ${req.user.id}::uuid, ${input.districtId || null}::uuid,
        ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
        ${input.waterLevel}, ${input.description}, ${stored.url},
        ${JSON.stringify(stored.metadata)}::jsonb, ${input.gpsAccuracyMeters || null}, 'MOBILE_APP'::"ReportSource", 'PENDING', NOW())
      RETURNING id, "userId", "districtId", "waterLevel", description, "photoUrl", "photoMetadata",
        "gpsAccuracyMeters", source, status, "createdAt", ST_AsGeoJSON(location)::json AS location
    `;
    await prisma.uploadAsset.update({ where: { id: stored.assetId }, data: { reportId: report.id } }).catch(() => null);
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

router.post("/reports/:id/moderate", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    const input = z.object({
      status: z.enum(["VERIFIED", "REJECTED", "RESOLVED"]),
      notes: z.string().optional()
    }).parse(req.body);
    const [report] = await prisma.$queryRaw`
      UPDATE "CommunityReport"
      SET status = ${input.status}::"ReportStatus"
      WHERE id = ${req.params.id}::uuid
        AND (${req.user.tenantId || null}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM "District" d WHERE d.id = "CommunityReport"."districtId" AND d."tenantId" = ${req.user.tenantId || null}::uuid
        ) OR EXISTS (
          SELECT 1 FROM "User" u WHERE u.id = "CommunityReport"."userId" AND u."tenantId" = ${req.user.tenantId || null}::uuid
        ))
      RETURNING id, "userId", "districtId", "waterLevel", description, "photoUrl", source, status, "createdAt",
        ST_AsGeoJSON(location)::json AS location
    `;
    if (!report) return res.status(404).json({ error: "Report not found" });
    await prisma.reportModeration.create({
      data: { reportId: report.id, moderatorId: req.user.id, action: input.status, notes: input.notes }
    });
    if (report.userId && input.status === "VERIFIED") {
      await prisma.user.update({ where: { id: report.userId }, data: { points: { increment: 10 } } });
    }
    res.json({ report, awardedPoints: report.userId && input.status === "VERIFIED" ? 10 : 0 });
  } catch (err) {
    next(err);
  }
});

router.post("/reports/:id/verify", authenticate, requireRole("admin", "field_agent"), async (req, res, next) => {
  try {
    req.body = { status: "VERIFIED", notes: req.body?.notes };
    const [report] = await prisma.$queryRaw`
      UPDATE "CommunityReport"
      SET status = 'VERIFIED'::"ReportStatus"
      WHERE id = ${req.params.id}::uuid
        AND (${req.user.tenantId || null}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM "District" d WHERE d.id = "CommunityReport"."districtId" AND d."tenantId" = ${req.user.tenantId || null}::uuid
        ) OR EXISTS (
          SELECT 1 FROM "User" u WHERE u.id = "CommunityReport"."userId" AND u."tenantId" = ${req.user.tenantId || null}::uuid
        ))
      RETURNING id, "userId", "districtId", "waterLevel", description, "photoUrl", source, status, "createdAt",
        ST_AsGeoJSON(location)::json AS location
    `;
    if (!report) return res.status(404).json({ error: "Report not found" });
    await prisma.reportModeration.create({
      data: { reportId: report.id, moderatorId: req.user.id, action: "VERIFIED", notes: req.body?.notes }
    });
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
      where: { role: { in: ["field_agent", "community_user"] }, ...(req.tenantId ? { tenantId: req.tenantId } : {}) },
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
    const provider = String(req.query.provider || req.body.provider || "generic");
    if (!verifyInboundSignature(req, provider)) return res.status(401).json({ error: "Invalid webhook signature" });
    if (req.body.phone || req.body.latitude) {
      const input = voiceReportSchema.parse(req.body);
      const report = await createExternalReport({ ...input, source: "IVR", tenantId: req.tenantId });
      await sendIvrAcknowledgement({ to: input.phone, message: "Your water level report was received." });
      return res.status(201).json({ report, message: "IVR water level report accepted" });
    }
    const inbound = parseIvrInbound(req.body, provider);
    const result = await advanceReportConversation({ channel: "IVR", provider, inbound, tenantId: req.tenantId });
    const response = ivrResponse(provider, result.message, { gather: !result.done });
    res.type(response.type).status(200).send(response.body);
  } catch (err) {
    next(err);
  }
});

router.post("/voice/whatsapp", async (req, res, next) => {
  try {
    const provider = String(req.query.provider || req.body.provider || "generic");
    if (!verifyInboundSignature(req, provider)) return res.status(401).json({ error: "Invalid webhook signature" });
    if (req.body.latitude && req.body.longitude) {
      const input = voiceReportSchema.parse(req.body);
      const report = await createExternalReport({ ...input, source: "WHATSAPP", tenantId: req.tenantId });
      await sendWhatsAppMessage({ to: input.phone, message: "Your water level report was received." });
      return res.status(201).json({ report, message: "WhatsApp water level report accepted" });
    }
    const inbound = parseWhatsAppInbound(req.body, provider);
    const result = await advanceReportConversation({ channel: "WHATSAPP", provider, inbound, tenantId: req.tenantId });
    await sendWhatsAppMessage({ to: inbound.phone, message: result.message });
    res.status(200).json({ message: result.message, state: result.conversation.state, report: result.report || null });
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
  await assertDistrictAccess(input.districtId, input.tenantId);
  const systemEmail = input.tenantId ? `voice-reports-${input.tenantId}@smartwater.local` : "voice-reports@smartwater.local";
  const systemUser = await prisma.user.upsert({
    where: { email: systemEmail },
    update: {},
    create: {
      tenantId: input.tenantId || null,
      name: "Voice Reports",
      email: systemEmail,
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

async function assertDistrictAccess(districtId, tenantId) {
  if (!districtId) return;
  const district = await prisma.district.findFirst({
    where: { id: districtId, ...(tenantId ? { tenantId } : {}) },
    select: { id: true }
  });
  if (!district) {
    const err = new Error("District not found");
    err.status = 404;
    throw err;
  }
}

function severityColor(waterLevel, status) {
  if (status === "REJECTED") return "gray";
  if (waterLevel <= 20) return "red";
  if (waterLevel <= 45) return "orange";
  return "yellow";
}

export default router;
