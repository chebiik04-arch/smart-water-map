import { prisma } from "../config/prisma.js";

export async function advanceReportConversation({ channel, provider, inbound, tenantId }) {
  const conversation = await prisma.messagingConversation.upsert({
    where: { channel_provider_externalId: { channel, provider, externalId: inbound.externalId || inbound.phone } },
    update: { lastMessageAt: new Date() },
    create: {
      tenantId,
      channel,
      provider,
      externalId: inbound.externalId || inbound.phone,
      phone: inbound.phone,
      state: "STARTED",
      payload: {}
    }
  });

  const payload = conversation.payload || {};
  const text = String(inbound.text || inbound.speech || inbound.digits || "").trim();

  if (["cancel", "stop", "0"].includes(text.toLowerCase())) {
    const updated = await prisma.messagingConversation.update({
      where: { id: conversation.id },
      data: { state: "CANCELLED", payload: { ...payload, cancelledAt: new Date().toISOString() } }
    });
    return { conversation: updated, done: true, message: "Report cancelled." };
  }

  if (conversation.state === "STARTED") {
    const updated = await prisma.messagingConversation.update({
      where: { id: conversation.id },
      data: { state: "AWAITING_WATER_LEVEL", payload: { ...payload, startedText: text } }
    });
    return { conversation: updated, done: false, message: "Reply with the current water level percentage, for example 35." };
  }

  if (conversation.state === "AWAITING_WATER_LEVEL") {
    const waterLevel = Number(text.match(/\d+(\.\d+)?/)?.[0]);
    if (!Number.isFinite(waterLevel)) {
      return { conversation, done: false, message: "Please send a number for water level percentage." };
    }
    const updated = await prisma.messagingConversation.update({
      where: { id: conversation.id },
      data: { state: "AWAITING_DESCRIPTION", payload: { ...payload, waterLevel } }
    });
    return { conversation: updated, done: false, message: "Reply with a short description of the water point condition." };
  }

  if (conversation.state === "AWAITING_DESCRIPTION") {
    const report = await createConversationReport({
      tenantId,
      phone: inbound.phone,
      waterLevel: Number(payload.waterLevel ?? 0),
      description: text || "Voice channel report",
      source: channel
    });
    const updated = await prisma.messagingConversation.update({
      where: { id: conversation.id },
      data: { state: "COMPLETED", reportId: report.id, payload: { ...payload, description: text, reportId: report.id } }
    });
    return { conversation: updated, report, done: true, message: "Report received. Thank you." };
  }

  return { conversation, done: true, message: "This report is already complete. Send START to begin a new report." };
}

async function createConversationReport({ tenantId, phone, waterLevel, description, source }) {
  const systemEmail = tenantId ? `voice-reports-${tenantId}@smartwater.local` : "voice-reports@smartwater.local";
  const systemUser = await prisma.user.upsert({
    where: { email: systemEmail },
    update: {},
    create: {
      tenantId: tenantId || null,
      name: "Voice Reports",
      email: systemEmail,
      passwordHash: "external-channel-disabled",
      role: "community_user",
      district: "External intake"
    }
  });
  const [report] = await prisma.$queryRaw`
    INSERT INTO "CommunityReport" (id, "userId", location, "waterLevel", description,
      source, "externalReporterPhone", status, "createdAt")
    VALUES (gen_random_uuid(), ${systemUser.id}::uuid,
      ST_SetSRID(ST_MakePoint(37.6, -1.8), 4326),
      ${waterLevel}, ${description}, ${source}::"ReportSource", ${phone}, 'PENDING', NOW())
    RETURNING id, "userId", "waterLevel", description, source, "externalReporterPhone", status, "createdAt",
      ST_AsGeoJSON(location)::json AS location
  `;
  return report;
}
