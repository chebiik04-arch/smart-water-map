import dotenv from "dotenv";

dotenv.config();

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "development-secret-change-me",
  port: Number(process.env.PORT || 4000),
  africasTalkingApiKey: process.env.AFRICASTALKING_API_KEY || "",
  africasTalkingUsername: process.env.AFRICASTALKING_USERNAME || "sandbox"
};

