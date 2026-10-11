-- Fresh-schema mirror of migrations/0022-gatehouse-lifecycle.sql.
-- Guarded because 05-security-schema.sql already creates the column.

SET @s = (SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Gatehouses' AND COLUMN_NAME = 'Active');
SET @sql = IF(@s IS NULL, 'ALTER TABLE Gatehouses ADD COLUMN Active TINYINT(1) NOT NULL DEFAULT 1 AFTER Location', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE Gatehouses MODIFY COLUMN Active TINYINT(1) NOT NULL DEFAULT 1;

SET @idx = (SELECT MAX(INDEX_NAME) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Gatehouses' AND INDEX_NAME = 'IX_Gatehouses_tenant_active');
SET @sql = IF(@idx IS NULL, 'CREATE INDEX IX_Gatehouses_tenant_active ON Gatehouses (tenant_id, Active)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
