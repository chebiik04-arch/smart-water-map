import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";
import { metrics } from "./metrics.js";

export function emitOperationalAlert(type, message, fields = {}) {
  metrics.increment("operational_alerts_total", { type });
  const payload = {
    alert: true,
    alertType: type,
    message,
    timestamp: new Date().toISOString(),
    ...fields
  };
  logger.error(message, {
    ...payload
  });
  if (env.operationalAlertWebhookUrl) {
    fetch(env.operationalAlertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch((error) => logger.warn("operational_alert_webhook_failed", { alertType: type, error: error.message }));
  }
}
