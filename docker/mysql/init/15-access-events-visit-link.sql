-- Phase 16 hardening: a visitor AccessEvent records the Visit it created or
-- advanced. The ledger uses this durable link rather than a timestamp heuristic
-- when suppressing the audit-context duplicate of an operational Visit row.

SET @visit_id_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AccessEvents'
                          AND COLUMN_NAME = 'VisitId');
SET @sql = IF(@visit_id_exists = 0,
    'ALTER TABLE AccessEvents ADD COLUMN VisitId CHAR(36) NULL, ADD INDEX ix_access_events_tenant_visit (tenant_id, VisitId)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
