-- 0018-device-soft-delete-and-tenant-flag-audit.sql
-- Idempotent live-migration: Devices.RemovedAtUtc + Tenants.DoorIntegrationChangedAtUtc/ByProfileId.
-- Mirrors 18-device-soft-delete-and-tenant-flag-audit.sql for existing MySQL
-- databases that already have the Phase 23 Devices schema.

-- Devices.RemovedAtUtc soft-delete column.
SET @s = (SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Devices' AND COLUMN_NAME = 'RemovedAtUtc');
SET @sql = IF(@s IS NULL, 'ALTER TABLE Devices ADD COLUMN RemovedAtUtc DATETIME(6) NULL AFTER UpdatedAtUtc', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for the list-endpoint's WHERE RemovedAtUtc IS NULL filter.
SET @idx = (SELECT INDEX_NAME FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Devices' AND INDEX_NAME = 'ix_devices_tenant_removed');
SET @sql = IF(@idx IS NULL, 'CREATE INDEX ix_devices_tenant_removed ON Devices (tenant_id, RemovedAtUtc)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Tenants audit-trail columns for the door-integration flag flips.
SET @s = (SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Tenants' AND COLUMN_NAME = 'DoorIntegrationChangedAtUtc');
SET @sql = IF(@s IS NULL, 'ALTER TABLE Tenants ADD COLUMN DoorIntegrationChangedAtUtc DATETIME(6) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Tenants' AND COLUMN_NAME = 'DoorIntegrationChangedByProfileId');
SET @sql = IF(@s IS NULL, 'ALTER TABLE Tenants ADD COLUMN DoorIntegrationChangedByProfileId CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;