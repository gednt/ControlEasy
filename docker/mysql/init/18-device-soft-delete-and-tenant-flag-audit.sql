-- 18-device-soft-delete-and-tenant-flag-audit.sql
-- Devices module soft-delete + Tenants door-integration flag audit columns.
-- Mirrors docker/mysql/migrations/0018-device-soft-delete-and-tenant-flag-audit.sql
-- for fresh MySQL databases.

-- Devices.RemovedAtUtc — soft-delete marker. Set by ActivateDeactivateDeviceHandler
-- (when isActive=false) and RemoveDeviceHandler. List endpoint filters
-- WHERE RemovedAtUtc IS NULL; UnlockDeviceHandler (Phase 23) treats
-- RemovedAtUtc IS NOT NULL as not-found.
SET @s = (SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Devices' AND COLUMN_NAME = 'RemovedAtUtc');
SET @sql = IF(@s IS NULL, 'ALTER TABLE Devices ADD COLUMN RemovedAtUtc DATETIME(6) NULL AFTER UpdatedAtUtc', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for the list-endpoint's WHERE RemovedAtUtc IS NULL filter.
SET @idx = (SELECT INDEX_NAME FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Devices' AND INDEX_NAME = 'ix_devices_tenant_removed');
SET @sql = IF(@idx IS NULL, 'CREATE INDEX ix_devices_tenant_removed ON Devices (tenant_id, RemovedAtUtc)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Tenants.DoorIntegrationChangedAtUtc / DoorIntegrationChangedByProfileId —
-- audit-trail columns matching the MustChangePassword audit pattern
-- (mirrors v2.1 Phase 18 conventions). Written by ToggleDoorIntegrationHandler
-- so admins can see when the flag was last flipped and by whom.
SET @s = (SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Tenants' AND COLUMN_NAME = 'DoorIntegrationChangedAtUtc');
SET @sql = IF(@s IS NULL, 'ALTER TABLE Tenants ADD COLUMN DoorIntegrationChangedAtUtc DATETIME(6) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = (SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Tenants' AND COLUMN_NAME = 'DoorIntegrationChangedByProfileId');
SET @sql = IF(@s IS NULL, 'ALTER TABLE Tenants ADD COLUMN DoorIntegrationChangedByProfileId CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;