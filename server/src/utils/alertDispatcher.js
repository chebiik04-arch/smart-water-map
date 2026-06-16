import { env } from "../config/env.js";

export async function dispatchAlert(alert, recipients = []) {
  const payload = {
    username: env.africasTalkingUsername,
    apiKeyConfigured: Boolean(env.africasTalkingApiKey),
    recipients,
    message: alert.message,
    severity: alert.severity
  };

  console.info("Africa's Talking SMS dispatch stub", payload);
  return { provider: "africas_talking", status: "stubbed", count: recipients.length };
}

