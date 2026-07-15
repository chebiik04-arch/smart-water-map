CREATE TABLE IF NOT EXISTS "aois" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR NOT NULL,
  "type" VARCHAR NOT NULL CHECK ("type" IN ('county', 'custom')),
  "geometry" JSONB NOT NULL,
  "created_by" UUID,
  "created_at" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "aois_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "aois_lower_name_unique" ON "aois" (LOWER("name"));
CREATE INDEX IF NOT EXISTS "aois_created_by_idx" ON "aois" ("created_by");
