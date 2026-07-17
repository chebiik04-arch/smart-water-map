import fs from "node:fs";

const secretEnvKeys = [
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "AFRICASTALKING_API_KEY",
  "SENSOR_PROVIDER_API_KEY",
  "WHATSAPP_PROVIDER_TOKEN",
  "WHATSAPP_WEBHOOK_SECRET",
  "TWILIO_AUTH_TOKEN",
  "AFRICASTALKING_WEBHOOK_TOKEN",
  "IVR_PROVIDER_TOKEN",
  "MARKET_PRICE_API_KEY",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "IMAGE_MODERATION_API_KEY",
  "OPERATIONAL_ALERT_WEBHOOK_URL"
];

export function loadSecretFiles() {
  for (const key of secretEnvKeys) {
    const filePath = process.env[`${key}_FILE`];
    if (!filePath || process.env[key]) continue;
    process.env[key] = fs.readFileSync(filePath, "utf8").trim();
  }
}
