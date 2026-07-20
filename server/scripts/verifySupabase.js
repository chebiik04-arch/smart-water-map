import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DIRECT_URL or DATABASE_URL is required.");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

try {
  await prisma.$queryRaw`SELECT 1`;
  const [postgis] = await prisma.$queryRaw`
    SELECT extname, extversion
    FROM pg_extension
    WHERE extname = 'postgis'
  `;

  if (!postgis) {
    console.error("Supabase connection works, but the postgis extension is not enabled.");
    console.error("Enable postgis in Supabase Database > Extensions before running migrations.");
    process.exit(1);
  }

  await prisma.$queryRaw`SELECT 'POINT(0 0)'::geometry::text`;

  console.log(`Supabase database is reachable. postgis ${postgis.extversion} is enabled.`);
} catch (error) {
  console.error(`Supabase verification failed: ${error.message}`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
