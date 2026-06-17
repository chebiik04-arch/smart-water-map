CREATE TYPE "WaterSourceType" AS ENUM ('BOREHOLE', 'WATER_POINT', 'RIVER', 'RESERVOIR');
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'DRY', 'UNDER_REPAIR', 'ABANDONED');
CREATE TYPE "AlertType" AS ENUM ('HIGH_DROUGHT_RISK', 'LOW_WATER_LEVELS', 'RAINFALL_DEFICIT', 'SENSOR_OFFLINE', 'COMMUNITY_REPORT');

ALTER TABLE "DroughtAlert"
  ADD COLUMN "alertType" "AlertType" NOT NULL DEFAULT 'HIGH_DROUGHT_RISK',
  ADD COLUMN "subDistrict" TEXT;

ALTER TABLE "DroughtForecast"
  ADD COLUMN "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "riskLabel" TEXT NOT NULL DEFAULT 'Moderate',
  ADD COLUMN "recommendation" JSONB;

CREATE TABLE "WaterSource" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "type" "WaterSourceType" NOT NULL,
  "location" geometry(Point, 4326) NOT NULL,
  "districtId" UUID NOT NULL,
  "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "depth" DOUBLE PRECISION,
  "yield" DOUBLE PRECISION,
  "lastInspected" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaterSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WaterSourceReading" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sourceId" UUID NOT NULL,
  "waterLevel" DOUBLE PRECISION NOT NULL,
  "turbidity" DOUBLE PRECISION,
  "ph" DOUBLE PRECISION,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaterSourceReading_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NDVIReading" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "districtId" UUID NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'Sentinel-2',
  CONSTRAINT "NDVIReading_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RainfallRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "districtId" UUID NOT NULL,
  "month" TEXT NOT NULL,
  "mmTotal" DOUBLE PRECISION NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'CHIRPS',
  CONSTRAINT "RainfallRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DroughtForecastDriver" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "forecastId" UUID NOT NULL,
  "factor" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "impact" TEXT NOT NULL,
  CONSTRAINT "DroughtForecastDriver_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DroughtAlert_alertType_idx" ON "DroughtAlert"("alertType");
CREATE INDEX "WaterSource_districtId_type_idx" ON "WaterSource"("districtId", "type");
CREATE INDEX "WaterSource_status_idx" ON "WaterSource"("status");
CREATE INDEX "WaterSourceReading_sourceId_timestamp_idx" ON "WaterSourceReading"("sourceId", "timestamp");
CREATE INDEX "NDVIReading_districtId_capturedAt_idx" ON "NDVIReading"("districtId", "capturedAt");
CREATE UNIQUE INDEX "RainfallRecord_districtId_month_source_key" ON "RainfallRecord"("districtId", "month", "source");
CREATE INDEX "RainfallRecord_districtId_month_idx" ON "RainfallRecord"("districtId", "month");
CREATE INDEX "DroughtForecastDriver_forecastId_idx" ON "DroughtForecastDriver"("forecastId");

ALTER TABLE "WaterSource"
  ADD CONSTRAINT "WaterSource_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WaterSourceReading"
  ADD CONSTRAINT "WaterSourceReading_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WaterSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NDVIReading"
  ADD CONSTRAINT "NDVIReading_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RainfallRecord"
  ADD CONSTRAINT "RainfallRecord_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DroughtForecastDriver"
  ADD CONSTRAINT "DroughtForecastDriver_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "DroughtForecast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
