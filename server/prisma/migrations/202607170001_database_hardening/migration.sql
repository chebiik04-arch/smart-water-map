-- Sensor lifecycle auditability and common filter indexes.
ALTER TABLE "Sensor"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Sensor external IDs are unique within a tenant, not globally. This allows
-- different tenants/providers to reuse the same external device identifier.
DROP INDEX IF EXISTS "SensorDevice_externalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SensorDevice_tenantId_externalId_key"
  ON "SensorDevice"("tenantId", "externalId");

-- Common tenant/district/status/time filtering indexes used by dashboards,
-- API list endpoints, and operations views.
CREATE INDEX IF NOT EXISTS "User_tenantId_status_createdAt_idx"
  ON "User"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "District_tenantId_createdAt_idx"
  ON "District"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Sensor_districtId_status_lastPing_idx"
  ON "Sensor"("districtId", "status", "lastPing");
CREATE INDEX IF NOT EXISTS "Sensor_districtId_createdAt_idx"
  ON "Sensor"("districtId", "createdAt");
CREATE INDEX IF NOT EXISTS "SensorDevice_tenantId_createdAt_idx"
  ON "SensorDevice"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "MaintenanceTicket_districtId_status_createdAt_idx"
  ON "MaintenanceTicket"("districtId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ApiKey_tenantId_status_createdAt_idx"
  ON "ApiKey"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "WaterSource_districtId_status_createdAt_idx"
  ON "WaterSource"("districtId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "DroughtAlert_districtId_severity_triggeredAt_idx"
  ON "DroughtAlert"("districtId", "severity", "triggeredAt");
CREATE INDEX IF NOT EXISTS "CommunityReport_districtId_status_createdAt_idx"
  ON "CommunityReport"("districtId", "status", "createdAt");
