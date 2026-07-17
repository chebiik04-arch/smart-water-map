import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { emitOperationalAlert } from "./alerts.js";

const defaultJwtSecret = "development-secret-change-me";

export async function readinessReport() {
  const checks = {
    config: configCheck(),
    database: await databaseCheck()
  };
  const ready = Object.values(checks).every((check) => check.status === "ok");
  if (checks.database.status !== "ok") {
    emitOperationalAlert("db_unavailable", "Database readiness check failed", { error: checks.database.error });
  }
  return { ready, checks };
}

function configCheck() {
  const missing = [];
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (!process.env.JWT_SECRET || env.jwtSecret === defaultJwtSecret) missing.push("JWT_SECRET");
  if (process.env.NODE_ENV === "production" && !process.env.CLIENT_ORIGIN) missing.push("CLIENT_ORIGIN");
  return missing.length ? { status: "fail", missing } : { status: "ok" };
}

async function databaseCheck() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (error) {
    return { status: "fail", error: error.message };
  }
}
