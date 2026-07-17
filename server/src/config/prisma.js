import { PrismaClient } from "@prisma/client";
import { loadSecretFiles } from "./loadSecrets.js";

loadSecretFiles();

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"]
});
