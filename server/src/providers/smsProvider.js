import { env } from "../config/env.js";

const AFRICAS_TALKING_SMS_URL = "https://api.africastalking.com/version1/messaging";

export async function sendSms({ recipients, message }) {
  const to = Array.isArray(recipients) ? recipients.filter(Boolean) : [recipients].filter(Boolean);
  if (!to.length) return { provider: "africas_talking", status: "skipped", reason: "no_recipients", count: 0 };
  if (!env.africasTalkingApiKey) {
    return { provider: "africas_talking", status: "skipped", reason: "missing_api_key", count: to.length };
  }

  const body = new URLSearchParams({
    username: env.africasTalkingUsername,
    to: to.join(","),
    message
  });
  if (env.smsSenderId) body.set("from", env.smsSenderId);

  const response = await fetch(AFRICAS_TALKING_SMS_URL, {
    method: "POST",
    headers: {
      apiKey: env.africasTalkingApiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Africa's Talking SMS failed with ${response.status}`);
  }
  return { provider: "africas_talking", status: "sent", count: to.length, response: payload };
}
