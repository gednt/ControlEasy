-- 0017-devices.sql
-- Idempotent live-migration: Devices module tables, append-only triggers,
-- and Tenants.DoorIntegrationEnabled opt-in column.
-- Mirrors 17-devices-schema.sql for existing MySQL databases that don't
-- have these tables yet. Apply via the standard migration runner.

CREATE TABLE IF NOT EXISTS Devices (
    Id CHAR(36) NOT NULL,
    TenantId CHAR(36) NOT NULL,
    DeviceType VARCHAR(40) NOT NULL,
    Vendor VARCHAR(64) NOT NULL,
    ConnectionParams VARBINARY(512) NOT NULL,
    GatehouseId CHAR(36) NULL,
    IsActive TINYINT(1) NOT NULL DEFAULT 1,
    CreatedAtUtc DATETIME(6) NOT NULL,
    UpdatedAtUtc DATETIME(6) NULL,
    CreatedByProfileId CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    PRIMARY KEY (Id),
    KEY ix_devices_tenant_active (tenant_id, IsActive),
    KEY ix_devices_gatehouse (tenant_id, GatehouseId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS DeviceUnlockAudit (
    Id CHAR(36) NOT NULL,
    TenantId CHAR(36) NOT NULL,
    DeviceId CHAR(36) NOT NULL,
    ActorProfileId CHAR(36) NOT NULL,
    CommandHash CHAR(64) NOT NULL,
    OccurredAtUtc DATETIME(6) NOT NULL,
    ResponseOutcome VARCHAR(32) NOT NULL,
    CommandNonce CHAR(36) NOT NULL,
    CorrelationId CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    PRIMARY KEY (Id),
    KEY ix_device_unlock_audit_tenant_device_time (tenant_id, DeviceId, OccurredAtUtc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TRIGGER IF EXISTS trg_device_unlock_audit_no_update;

CREATE TRIGGER trg_device_unlock_audit_no_update
BEFORE UPDATE ON DeviceUnlockAudit
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DeviceUnlockAudit is append-only: UPDATE is not permitted';

DROP TRIGGER IF EXISTS trg_device_unlock_audit_no_delete;

CREATE TRIGGER trg_device_unlock_audit_no_delete
BEFORE DELETE ON DeviceUnlockAudit
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DeviceUnlockAudit is append-only: DELETE is not permitted';

-- Per-tenant opt-in flag for door integration. Guarded ALTER — adds the
-- column only if it does not exist (idempotent on top of an older schema).
SET @s = (SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Tenants' AND COLUMN_NAME = 'DoorIntegrationEnabled');
SET @sql = IF(@s IS NULL, 'ALTER TABLE Tenants ADD COLUMN DoorIntegrationEnabled TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;