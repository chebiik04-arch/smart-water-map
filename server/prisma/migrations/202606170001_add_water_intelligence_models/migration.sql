-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'field_agent', 'community_user');

-- CreateEnum
CREATE TYPE "SensorType" AS ENUM ('GROUNDWATER', 'SOIL_MOISTURE', 'RAINFALL', 'WEATHER');

-- CreateEnum
CREATE TYPE "SensorStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "DroughtRiskLevel" AS ENUM ('NORMAL', 'WATCH', 'WARNING', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "SatelliteIndexType" AS ENUM ('NDVI', 'LST', 'SMAP', 'ET');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('WATCH', 'WARNING', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "BoreholeStatus" AS ENUM ('FUNCTIONAL', 'DRY', 'ABANDONED');

-- CreateEnum
CREATE TYPE "HydroEventType" AS ENUM ('FLASH_FLOOD', 'DROUGHT');

-- CreateEnum
CREATE TYPE "ReportSource" AS ENUM ('MOBILE_APP', 'OFFLINE_SYNC', 'IVR', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MaintenanceTicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "CropWaterDemand" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MarketTrend" AS ENUM ('RISING', 'STABLE', 'FALLING');

-- CreateEnum
CREATE TYPE "WaterPointStatus" AS ENUM ('RELIABLE', 'STRESSED', 'DRY', 'CONTAMINATED');

-- CreateEnum
CREATE TYPE "WaterSourceType" AS ENUM ('BOREHOLE', 'WATER_POINT', 'RIVER', 'RESERVOIR');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'DRY', 'UNDER_REPAIR', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('HIGH_DROUGHT_RISK', 'LOW_WATER_LEVELS', 'RAINFALL_DEFICIT', 'SENSOR_OFFLINE', 'COMMUNITY_REPORT');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'community_user',
    "district" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "name" TEXT NOT NULL,
    "geometry" geometry(Polygon, 4326) NOT NULL,
    "droughtRiskLevel" "DroughtRiskLevel" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrrigationSchedule" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "cropName" TEXT NOT NULL,
    "soilMoisturePercent" DOUBLE PRECISION NOT NULL,
    "evapotranspirationMmDay" DOUBLE PRECISION NOT NULL,
    "recommendedDate" TIMESTAMP(3) NOT NULL,
    "waterMm" DOUBLE PRECISION NOT NULL,
    "litersPerHectare" DOUBLE PRECISION NOT NULL,
    "priority" "AlertSeverity" NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrrigationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropVariety" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "cropName" TEXT NOT NULL,
    "varietyName" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "waterDemand" "CropWaterDemand" NOT NULL,
    "droughtTolerance" INTEGER NOT NULL,
    "maturityDays" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "CropVariety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropRecommendation" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "cropVarietyId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "commodity" TEXT NOT NULL,
    "marketName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "observedAt" TIMESTAMP(3) NOT NULL,
    "trend" "MarketTrend" NOT NULL DEFAULT 'STABLE',
    "source" TEXT NOT NULL,
    "decisionHint" TEXT NOT NULL,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockWaterPoint" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "status" "WaterPointStatus" NOT NULL,
    "waterVolumeLiters" DOUBLE PRECISION NOT NULL,
    "dailyDemandLiters" DOUBLE PRECISION NOT NULL,
    "daysRemaining" DOUBLE PRECISION NOT NULL,
    "supportedLivestock" INTEGER NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivestockWaterPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastureCondition" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "pastureIndex" DOUBLE PRECISION NOT NULL,
    "grazingPressure" DOUBLE PRECISION NOT NULL,
    "stressLevel" "DroughtRiskLevel" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "PastureCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DroughtSnapshot" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "severityScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" "DroughtRiskLevel" NOT NULL,
    "groundwaterDepthMeters" DOUBLE PRECISION NOT NULL,
    "rainfallAnomalyPercent" DOUBLE PRECISION NOT NULL,
    "ndvi" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DroughtSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Borehole" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "districtId" UUID NOT NULL,
    "depthMeters" DOUBLE PRECISION NOT NULL,
    "yieldLitersPerHour" DOUBLE PRECISION NOT NULL,
    "status" "BoreholeStatus" NOT NULL,
    "lastInspectedAt" TIMESTAMP(3),

    CONSTRAINT "Borehole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictRiskArea" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "name" TEXT NOT NULL,
    "geometry" geometry(Polygon, 4326) NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "incidentsLastYear" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictRiskArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HydroEvent" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "eventType" "HydroEventType" NOT NULL,
    "severity" "DroughtRiskLevel" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "geometry" geometry(Polygon, 4326) NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "HydroEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" UUID NOT NULL,
    "type" "SensorType" NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "districtId" UUID NOT NULL,
    "status" "SensorStatus" NOT NULL DEFAULT 'ONLINE',
    "lastPing" TIMESTAMP(3),

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTicket" (
    "id" UUID NOT NULL,
    "sensorId" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MaintenanceTicketStatus" NOT NULL DEFAULT 'OPEN',
    "staleHours" DOUBLE PRECISION NOT NULL,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalTwinSimulation" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "districtId" UUID NOT NULL,
    "scenarioName" TEXT NOT NULL,
    "rainfallDropPercent" DOUBLE PRECISION NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "baselineGroundwater" DOUBLE PRECISION NOT NULL,
    "projectedGroundwater" DOUBLE PRECISION NOT NULL,
    "projectedSeverityScore" DOUBLE PRECISION NOT NULL,
    "projectedRiskLevel" "DroughtRiskLevel" NOT NULL,
    "assumptions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalTwinSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "quotaPerHour" INTEGER NOT NULL DEFAULT 100,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" UUID NOT NULL,
    "apiKeyId" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" UUID NOT NULL,
    "sensorId" UUID NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterSource" (
    "id" UUID NOT NULL,
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

-- CreateTable
CREATE TABLE "WaterSourceReading" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "waterLevel" DOUBLE PRECISION NOT NULL,
    "turbidity" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterSourceReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NDVIReading" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Sentinel-2',

    CONSTRAINT "NDVIReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RainfallRecord" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "mmTotal" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CHIRPS',

    CONSTRAINT "RainfallRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatelliteIndex" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "indexType" "SatelliteIndexType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "geoTiff" TEXT,

    CONSTRAINT "SatelliteIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DroughtAlert" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "alertType" "AlertType" NOT NULL DEFAULT 'HIGH_DROUGHT_RISK',
    "severity" "AlertSeverity" NOT NULL,
    "subDistrict" TEXT,
    "message" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DroughtAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "districtId" UUID,
    "location" geometry(Point, 4326) NOT NULL,
    "waterLevel" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "photoMetadata" JSONB,
    "gpsAccuracyMeters" DOUBLE PRECISION,
    "source" "ReportSource" NOT NULL DEFAULT 'MOBILE_APP',
    "externalReporterPhone" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportModeration" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "moderatorId" UUID,
    "action" "ReportStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportModeration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DroughtForecast" (
    "id" UUID NOT NULL,
    "districtId" UUID NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "predictedSeverity" "DroughtRiskLevel" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "riskLabel" TEXT NOT NULL DEFAULT 'Moderate',
    "recommendation" JSONB,
    "modelVersion" TEXT NOT NULL,

    CONSTRAINT "DroughtForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DroughtForecastDriver" (
    "id" UUID NOT NULL,
    "forecastId" UUID NOT NULL,
    "factor" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "impact" TEXT NOT NULL,

    CONSTRAINT "DroughtForecastDriver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_district_idx" ON "User"("district");

-- CreateIndex
CREATE UNIQUE INDEX "District_name_key" ON "District"("name");

-- CreateIndex
CREATE INDEX "District_tenantId_idx" ON "District"("tenantId");

-- CreateIndex
CREATE INDEX "District_droughtRiskLevel_idx" ON "District"("droughtRiskLevel");

-- CreateIndex
CREATE INDEX "IrrigationSchedule_districtId_recommendedDate_idx" ON "IrrigationSchedule"("districtId", "recommendedDate");

-- CreateIndex
CREATE INDEX "CropVariety_tenantId_cropName_idx" ON "CropVariety"("tenantId", "cropName");

-- CreateIndex
CREATE INDEX "CropVariety_waterDemand_droughtTolerance_idx" ON "CropVariety"("waterDemand", "droughtTolerance");

-- CreateIndex
CREATE INDEX "CropRecommendation_districtId_score_idx" ON "CropRecommendation"("districtId", "score");

-- CreateIndex
CREATE INDEX "MarketPrice_tenantId_commodity_observedAt_idx" ON "MarketPrice"("tenantId", "commodity", "observedAt");

-- CreateIndex
CREATE INDEX "LivestockWaterPoint_districtId_status_idx" ON "LivestockWaterPoint"("districtId", "status");

-- CreateIndex
CREATE INDEX "PastureCondition_districtId_observedAt_idx" ON "PastureCondition"("districtId", "observedAt");

-- CreateIndex
CREATE INDEX "DroughtSnapshot_districtId_weekStart_idx" ON "DroughtSnapshot"("districtId", "weekStart");

-- CreateIndex
CREATE INDEX "DroughtSnapshot_riskLevel_idx" ON "DroughtSnapshot"("riskLevel");

-- CreateIndex
CREATE INDEX "Borehole_districtId_status_idx" ON "Borehole"("districtId", "status");

-- CreateIndex
CREATE INDEX "ConflictRiskArea_tenantId_idx" ON "ConflictRiskArea"("tenantId");

-- CreateIndex
CREATE INDEX "ConflictRiskArea_riskScore_idx" ON "ConflictRiskArea"("riskScore");

-- CreateIndex
CREATE INDEX "HydroEvent_districtId_eventType_eventDate_idx" ON "HydroEvent"("districtId", "eventType", "eventDate");

-- CreateIndex
CREATE INDEX "Sensor_type_idx" ON "Sensor"("type");

-- CreateIndex
CREATE INDEX "Sensor_districtId_idx" ON "Sensor"("districtId");

-- CreateIndex
CREATE INDEX "Sensor_status_idx" ON "Sensor"("status");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_sensorId_status_idx" ON "MaintenanceTicket"("sensorId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_districtId_status_idx" ON "MaintenanceTicket"("districtId", "status");

-- CreateIndex
CREATE INDEX "DigitalTwinSimulation_tenantId_districtId_createdAt_idx" ON "DigitalTwinSimulation"("tenantId", "districtId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_tenantId_status_idx" ON "ApiKey"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ApiUsage_apiKeyId_usedAt_idx" ON "ApiUsage"("apiKeyId", "usedAt");

-- CreateIndex
CREATE INDEX "SensorReading_sensorId_timestamp_idx" ON "SensorReading"("sensorId", "timestamp");

-- CreateIndex
CREATE INDEX "WaterSource_districtId_type_idx" ON "WaterSource"("districtId", "type");

-- CreateIndex
CREATE INDEX "WaterSource_status_idx" ON "WaterSource"("status");

-- CreateIndex
CREATE INDEX "WaterSourceReading_sourceId_timestamp_idx" ON "WaterSourceReading"("sourceId", "timestamp");

-- CreateIndex
CREATE INDEX "NDVIReading_districtId_capturedAt_idx" ON "NDVIReading"("districtId", "capturedAt");

-- CreateIndex
CREATE INDEX "RainfallRecord_districtId_month_idx" ON "RainfallRecord"("districtId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "RainfallRecord_districtId_month_source_key" ON "RainfallRecord"("districtId", "month", "source");

-- CreateIndex
CREATE INDEX "SatelliteIndex_districtId_indexType_capturedAt_idx" ON "SatelliteIndex"("districtId", "indexType", "capturedAt");

-- CreateIndex
CREATE INDEX "DroughtAlert_districtId_resolvedAt_idx" ON "DroughtAlert"("districtId", "resolvedAt");

-- CreateIndex
CREATE INDEX "DroughtAlert_alertType_idx" ON "DroughtAlert"("alertType");

-- CreateIndex
CREATE INDEX "DroughtAlert_severity_idx" ON "DroughtAlert"("severity");

-- CreateIndex
CREATE INDEX "CommunityReport_userId_idx" ON "CommunityReport"("userId");

-- CreateIndex
CREATE INDEX "CommunityReport_districtId_status_idx" ON "CommunityReport"("districtId", "status");

-- CreateIndex
CREATE INDEX "ReportModeration_reportId_createdAt_idx" ON "ReportModeration"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "DroughtForecast_districtId_forecastDate_idx" ON "DroughtForecast"("districtId", "forecastDate");

-- CreateIndex
CREATE INDEX "DroughtForecastDriver_forecastId_idx" ON "DroughtForecastDriver"("forecastId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationSchedule" ADD CONSTRAINT "IrrigationSchedule_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropVariety" ADD CONSTRAINT "CropVariety_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropRecommendation" ADD CONSTRAINT "CropRecommendation_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropRecommendation" ADD CONSTRAINT "CropRecommendation_cropVarietyId_fkey" FOREIGN KEY ("cropVarietyId") REFERENCES "CropVariety"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockWaterPoint" ADD CONSTRAINT "LivestockWaterPoint_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastureCondition" ADD CONSTRAINT "PastureCondition_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroughtSnapshot" ADD CONSTRAINT "DroughtSnapshot_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Borehole" ADD CONSTRAINT "Borehole_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictRiskArea" ADD CONSTRAINT "ConflictRiskArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HydroEvent" ADD CONSTRAINT "HydroEvent_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalTwinSimulation" ADD CONSTRAINT "DigitalTwinSimulation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterSource" ADD CONSTRAINT "WaterSource_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterSourceReading" ADD CONSTRAINT "WaterSourceReading_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WaterSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NDVIReading" ADD CONSTRAINT "NDVIReading_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RainfallRecord" ADD CONSTRAINT "RainfallRecord_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatelliteIndex" ADD CONSTRAINT "SatelliteIndex_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroughtAlert" ADD CONSTRAINT "DroughtAlert_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportModeration" ADD CONSTRAINT "ReportModeration_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CommunityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroughtForecast" ADD CONSTRAINT "DroughtForecast_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroughtForecastDriver" ADD CONSTRAINT "DroughtForecastDriver_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "DroughtForecast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
