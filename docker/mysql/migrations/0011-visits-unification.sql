-- 0011-visits-unification.sql
-- Idempotent live-migration matching init/14-visits-unification.sql.

SET @visits_index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
                           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Visits'
                             AND INDEX_NAME = 'ix_visits_tenant_created');
SET @sql = IF(@visits_index_exists = 0,
    'ALTER TABLE Visits ADD INDEX ix_visits_tenant_created (tenant_id, CreatedAtUtc)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @event_kind_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
                          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AccessEvents'
                            AND COLUMN_NAME = 'EventKind');
SET @sql = IF(@event_kind_exists = 0,
    'ALTER TABLE AccessEvents ADD COLUMN EventKind TINYINT NOT NULL DEFAULT 0, ADD COLUMN PackageDescription VARCHAR(500) NULL, ADD COLUMN PackageCarrierCode VARCHAR(64) NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @kind_index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
                          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AccessEvents'
                            AND INDEX_NAME = 'ix_access_events_tenant_kind_time');
SET @sql = IF(@kind_index_exists = 0,
    'ALTER TABLE AccessEvents ADD INDEX ix_access_events_tenant_kind_time (tenant_id, EventKind, OccurredAtUtc)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
