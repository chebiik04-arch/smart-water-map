import crypto from "node:crypto";
import { env } from "../config/env.js";

export function verifyInboundSignature(req, provider) {
  if (provider === "twilio") return verifyTwilio(req);
  if (provider === "africas_talking") return verifySharedToken(req, env.africasTalkingWebhookToken);
  if (provider === "whatsapp_cloud") return verifyMetaWebhook(req);
  return true;
}

export function parseWhatsAppInbound(body, provider = "generic") {
  if (provider === "twilio") {
    return {
      provider,
      externalId: body.MessageSid || body.SmsMessageSid || body.WaId || body.From,
      phone: normalizePhone(body.From || body.WaId),
      text: body.Body || "",
      raw: body
    };
  }
  if (provider === "whatsapp_cloud") {
    const value = body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    return {
      provider,
      externalId: message?.id || value?.contacts?.[0]?.wa_id,
      phone: normalizePhone(message?.from || value?.contacts?.[0]?.wa_id),
      text: message?.text?.body || message?.button?.text || "",
      raw: body
    };
  }
  return {
    provider,
    externalId: body.id || body.messageId || body.phone,
    phone: normalizePhone(body.phone || body.from),
    text: body.text || body.message || body.description || "",
    raw: body
  };
}

export function parseIvrInbound(body, provider = "generic") {
  if (provider === "twilio") {
    return {
      provider,
      externalId: body.CallSid || body.From,
      phone: normalizePhone(body.From),
      digits: body.Digits || "",
      speech: body.SpeechResult || "",
      raw: body
    };
  }
  if (provider === "africas_talking") {
    return {
      provider,
      externalId: body.sessionId || body.callSessionState || body.callerNumber,
      phone: normalizePhone(body.callerNumber || body.phoneNumber),
      digits: body.dtmfDigits || body.digits || "",
      speech: body.recordingUrl || body.speech || "",
      raw: body
    };
  }
  return {
    provider,
    externalId: body.id || body.sessionId || body.phone,
    phone: normalizePhone(body.phone || body.from),
    digits: body.digits || "",
    speech: body.speech || body.description || "",
    raw: body
  };
}

export function ivrResponse(provider, message, { gather = true } = {}) {
  if (provider === "twilio") {
    const body = gather
      ? `<Response><Gather input="dtmf speech" timeout="8"><Say>${escapeXml(message)}</Say></Gather></Response>`
      : `<Response><Say>${escapeXml(message)}</Say></Response>`;
    return { type: "application/xml", body };
  }
  if (provider === "africas_talking") {
    return { type: "application/json", body: { action: gather ? "CON" : "END", text: message } };
  }
  return { type: "application/json", body: { message, gather } };
}

function verifySharedToken(req, token) {
  if (!token) return true;
  return req.headers["x-webhook-token"] === token || req.query.token === token;
}

function verifyMetaWebhook(req) {
  if (!env.whatsappWebhookSecret) return true;
  const signature = String(req.headers["x-hub-signature-256"] || "");
  const digest = `sha256=${crypto.createHmac("sha256", env.whatsappWebhookSecret).update(JSON.stringify(req.body || {})).digest("hex")}`;
  return safeEqual(signature, digest);
}

function verifyTwilio(req) {
  if (!env.twilioAuthToken) return true;
  const signature = String(req.headers["x-twilio-signature"] || "");
  const publicUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const params = Object.keys(req.body || {}).sort().map((key) => `${key}${req.body[key]}`).join("");
  const digest = crypto.createHmac("sha1", env.twilioAuthToken).update(`${publicUrl}${params}`).digest("base64");
  return safeEqual(signature, digest);
}

function normalizePhone(value = "") {
  return String(value).replace(/^whatsapp:/, "").trim();
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" }[char]));
}
