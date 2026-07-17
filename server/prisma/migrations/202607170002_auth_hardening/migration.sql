CREATE TYPE "AdminScope" AS ENUM ('PLATFORM', 'TENANT');

ALTER TABLE "User"
  ADD COLUMN "adminScope" "AdminScope",
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET "adminScope" = CASE
  WHEN role = 'admin'::"UserRole" AND "tenantId" IS NULL THEN 'PLATFORM'::"AdminScope"
  WHEN role = 'admin'::"UserRole" THEN 'TENANT'::"AdminScope"
  ELSE NULL
END;

CREATE TABLE "RefreshToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_revokedAt_expiresAt_idx" ON "RefreshToken"("userId", "revokedAt", "expiresAt");
CREATE INDEX "User_adminScope_idx" ON "User"("adminScope");

ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
