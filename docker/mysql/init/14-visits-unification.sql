-- 14-visits-unification.sql
-- Phase 16 (Visits Unification Backend):
--   (a) Visits ledger index for the unified ledger day-range scans (INFRA-02).
--   (b) AccessEvents package-drop columns (EventKind, PackageDescription, PackageCarrierCode)
--       plus a kind/time index for the unified ledger branch. EventKind defaults to 0 (Access)
--       so every pre-existing row keeps its current meaning.
-- Condominium-level package drops keep DestinationApartmentId NOT NULL: they store
-- Guid.Empty with destination snapshot Block='GATEHOUSE', Unit='RECEPTION'.

-- (a) Visits: composite index used by the ledger day-range and "today" scans.
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Visits'
                     AND INDEX_NAME = 'ix_visits_tenant_created');
SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE Visits ADD INDEX ix_visits_tenant_created (tenant_id, CreatedAtUtc)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- (b) AccessEvents: package-drop columns (idempotent).
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AccessEvents'
                     AND COLUMN_NAME = 'EventKind');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE AccessEvents ADD COLUMN EventKind TINYINT NOT NULL DEFAULT 0, ADD COLUMN PackageDescription VARCHAR(500) NULL, ADD COLUMN PackageCarrierCode VARCHAR(64) NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- (c) AccessEvents: kind/time index for ledger branch scans (idempotent).
SET @kind_idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AccessEvents'
                          AND INDEX_NAME = 'ix_access_events_tenant_kind_time');
SET @sql = IF(@kind_idx_exists = 0,
    'ALTER TABLE AccessEvents ADD INDEX ix_access_events_tenant_kind_time (tenant_id, EventKind, OccurredAtUtc)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;