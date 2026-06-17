import { env } from "../config/env.js";

export async function sendWhatsAppMessage({ to, message }) {
  if (!env.whatsappProviderUrl || !env.whatsappProviderToken || !to) {
    return { provider: "whatsapp", status: "skipped" };
  }
  return postProvider(env.whatsappProviderUrl, env.whatsappProviderToken, { to, message });
}

export async function sendIvrAcknowledgement({ to, message }) {
  if (!env.ivrProviderUrl || !env.ivrProviderToken || !to) {
    return { provider: "ivr", status: "skipped" };
  }
  return postProvider(env.ivrProviderUrl, env.ivrProviderToken, { to, message });
}

async function postProvider(url, token, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Messaging provider failed with ${response.status}`);
  return { status: "sent", response: data };
}
