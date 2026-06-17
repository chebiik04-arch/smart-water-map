import dotenv from "dotenv";

dotenv.config();

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "development-secret-change-me",
  port: Number(process.env.PORT || 4000),
  africasTalkingApiKey: process.env.AFRICASTALKING_API_KEY || "",
  africasTalkingUsername: process.env.AFRICASTALKING_USERNAME || "sandbox",
  smsSenderId: process.env.SMS_SENDER_ID || "",
  sensorProviderUrl: process.env.SENSOR_PROVIDER_URL || "",
  sensorProviderApiKey: process.env.SENSOR_PROVIDER_API_KEY || "",
  sensorProviderMode: process.env.SENSOR_PROVIDER_MODE || "generic_http",
  whatsappProviderUrl: process.env.WHATSAPP_PROVIDER_URL || "",
  whatsappProviderToken: process.env.WHATSAPP_PROVIDER_TOKEN || "",
  whatsappWebhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  africasTalkingWebhookToken: process.env.AFRICASTALKING_WEBHOOK_TOKEN || "",
  ivrProviderUrl: process.env.IVR_PROVIDER_URL || "",
  ivrProviderToken: process.env.IVR_PROVIDER_TOKEN || "",
  marketPriceApiUrl: process.env.MARKET_PRICE_API_URL || "",
  marketPriceApiKey: process.env.MARKET_PRICE_API_KEY || "",
  marketPriceProvider: process.env.MARKET_PRICE_PROVIDER || "generic",
  uploadProvider: process.env.UPLOAD_PROVIDER || "local",
  uploadDir: process.env.UPLOAD_DIR || "",
  uploadSignedUrlTtlSeconds: Number(process.env.UPLOAD_SIGNED_URL_TTL_SECONDS || 900),
  s3Endpoint: process.env.S3_ENDPOINT || "",
  s3Region: process.env.S3_REGION || "us-east-1",
  s3Bucket: process.env.S3_BUCKET || "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL || "",
  clamavHost: process.env.CLAMAV_HOST || "",
  clamavPort: Number(process.env.CLAMAV_PORT || 3310),
  imageModerationUrl: process.env.IMAGE_MODERATION_URL || "",
  imageModerationApiKey: process.env.IMAGE_MODERATION_API_KEY || ""
};
