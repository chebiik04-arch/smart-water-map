import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.info(`Seed skipped: database already has ${userCount} user(s).`);
    await prisma.$disconnect();
    process.exit(0);
  }

  console.info("No users found. Seeding demo data...");
  await prisma.$disconnect();

  const seed = spawn(process.execPath, ["prisma/seed.js"], { stdio: "inherit" });
  seed.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
  seed.on("exit", (code, signal) => {
    if (signal) {
      console.error(`Seed process terminated with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 1);
  });
} catch (error) {
  console.error(error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
}
