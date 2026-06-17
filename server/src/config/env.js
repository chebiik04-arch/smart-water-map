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
  whatsappProviderUrl: process.env.WHATSAPP_PROVIDER_URL || "",
  whatsappProviderToken: process.env.WHATSAPP_PROVIDER_TOKEN || "",
  ivrProviderUrl: process.env.IVR_PROVIDER_URL || "",
  ivrProviderToken: process.env.IVR_PROVIDER_TOKEN || "",
  marketPriceApiUrl: process.env.MARKET_PRICE_API_URL || "",
  marketPriceApiKey: process.env.MARKET_PRICE_API_KEY || ""
};
