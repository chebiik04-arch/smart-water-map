-- CreateEnum
CREATE TYPE "MessagingChannel" AS ENUM ('WHATSAPP', 'IVR');

-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('STARTED', 'AWAITING_WATER_LEVEL', 'AWAITING_DESCRIPTION', 'AWAITING_LOCATION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UploadProvider" AS ENUM ('LOCAL', 'S3', 'GCS', 'AZURE');

-- CreateEnum
CREATE TYPE "UploadScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MarketImportStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingPlan" TEXT NOT NULL DEFAULT 'starter',
ADD COLUMN     "config" JSONB;

-- CreateTable
CREATE TABLE "SensorDevice" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "sensorId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "authTokenHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'generic_http',
    "pollUrl" TEXT,
    "metadata" JSONB,
    "lastAuthenticated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingConversation" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "channel" "MessagingChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" "ConversationState" NOT NULL DEFAULT 'STARTED',
    "payload" JSONB,
    "reportId" UUID,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadAsset" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "reportId" UUID,
    "provider" "UploadProvider" NOT NULL,
    "bucket" TEXT,
    "objectKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "signedUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "scanStatus" "UploadScanStatus" NOT NULL DEFAULT 'PENDING',
    "moderationLabel" TEXT,
    "moderationScore" DOUBLE PRECISION,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketImportRun" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "provider" TEXT NOT NULL,
    "status" "MarketImportStatus" NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MarketImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SensorDevice_sensorId_key" ON "SensorDevice"("sensorId");

-- CreateIndex
CREATE UNIQUE INDEX "SensorDevice_externalId_key" ON "SensorDevice"("externalId");

-- CreateIndex
CREATE INDEX "SensorDevice_tenantId_idx" ON "SensorDevice"("tenantId");

-- CreateIndex
CREATE INDEX "SensorDevice_provider_idx" ON "SensorDevice"("provider");

-- CreateIndex
CREATE INDEX "MessagingConversation_tenantId_channel_state_idx" ON "MessagingConversation"("tenantId", "channel", "state");

-- CreateIndex
CREATE INDEX "MessagingConversation_phone_lastMessageAt_idx" ON "MessagingConversation"("phone", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingConversation_channel_provider_externalId_key" ON "MessagingConversation"("channel", "provider", "externalId");

-- CreateIndex
CREATE INDEX "UploadAsset_tenantId_createdAt_idx" ON "UploadAsset"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadAsset_reportId_idx" ON "UploadAsset"("reportId");

-- CreateIndex
CREATE INDEX "UploadAsset_scanStatus_idx" ON "UploadAsset"("scanStatus");

-- CreateIndex
CREATE INDEX "MarketImportRun_tenantId_provider_startedAt_idx" ON "MarketImportRun"("tenantId", "provider", "startedAt");

-- AddForeignKey
ALTER TABLE "SensorDevice" ADD CONSTRAINT "SensorDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorDevice" ADD CONSTRAINT "SensorDevice_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingConversation" ADD CONSTRAINT "MessagingConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadAsset" ADD CONSTRAINT "UploadAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadAsset" ADD CONSTRAINT "UploadAsset_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CommunityReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketImportRun" ADD CONSTRAINT "MarketImportRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant row-level security foundation. Application code still scopes queries,
-- while these policies support stricter DB roles that set app.tenant_id.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "District" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalTwinSimulation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CropVariety" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConflictRiskArea" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SensorDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessagingConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UploadAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketImportRun" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_user_isolation ON "User"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_district_isolation ON "District"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_apikey_isolation ON "ApiKey"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_simulation_isolation ON "DigitalTwinSimulation"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_crop_isolation ON "CropVariety"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_market_isolation ON "MarketPrice"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_conflict_isolation ON "ConflictRiskArea"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_sensor_device_isolation ON "SensorDevice"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_conversation_isolation ON "MessagingConversation"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_upload_asset_isolation ON "UploadAsset"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_market_import_isolation ON "MarketImportRun"
  USING (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_id', true) IS NULL OR "tenantId"::text = current_setting('app.tenant_id', true));
