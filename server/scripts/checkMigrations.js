import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { emitOperationalAlert } from "../src/services/alerts.js";

const requiredIndexes = [
  "SensorDevice_tenantId_externalId_key",
  "User_tenantId_status_createdAt_idx",
  "District_tenantId_createdAt_idx",
  "Sensor_districtId_status_lastPing_idx",
  "Sensor_districtId_createdAt_idx",
  "SensorDevice_tenantId_createdAt_idx",
  "MaintenanceTicket_districtId_status_createdAt_idx",
  "ApiKey_tenantId_status_createdAt_idx",
  "WaterSource_districtId_status_createdAt_idx",
  "DroughtAlert_districtId_severity_triggeredAt_idx",
  "CommunityReport_districtId_status_createdAt_idx"
];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must point to an empty test database.");
  process.exit(1);
}

try {
  await run("npx", ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]);
} catch (error) {
  emitOperationalAlert("migration_failure", "Migration check failed during deploy", { error: error.message });
  throw error;
}

const prisma = new PrismaClient();

try {
  const indexes = await prisma.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
  `;
  const found = new Set(indexes.map((row) => row.indexname));
  const missing = requiredIndexes.filter((name) => !found.has(name));
  if (missing.length) {
    console.error(`Missing migration indexes: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.info(`Migration check passed: ${requiredIndexes.length} hardening indexes found.`);
  }
} finally {
  await prisma.$disconnect();
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}
