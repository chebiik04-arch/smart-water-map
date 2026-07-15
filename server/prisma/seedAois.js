import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadCountyAoisFromShapefile } from "../src/services/shapefileParser.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

async function main() {
  const countyAois = await loadCountyAoisFromShapefile({
    shpPath: path.join(projectRoot, "counties", "County.shp"),
    dbfPath: path.join(projectRoot, "counties", "County.dbf")
  });

  for (const county of countyAois) {
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM "aois" WHERE LOWER("name") = LOWER(${county.name}) LIMIT 1
    `;

    if (existing) {
      await prisma.$executeRaw`
        UPDATE "aois"
        SET "type" = 'county', "geometry" = ${JSON.stringify(county.geometry)}::jsonb
        WHERE id = ${existing.id}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "aois" ("name", "type", "geometry")
        VALUES (${county.name}, 'county', ${JSON.stringify(county.geometry)}::jsonb)
      `;
    }
  }

  console.info(`Seeded ${countyAois.length} county AOIs`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
