-- Apply once to existing MySQL 8 databases created before entity-bound photos.
-- Fresh databases receive the same columns from init/09a-photos-schema.sql.
-- Some existing worktree volumes predate that init script entirely, so create
-- the base table before attempting the idempotent column/index additions.
CREATE TABLE IF NOT EXISTS Photos (
    Id CHAR(36) NOT NULL PRIMARY KEY,
    TenantId CHAR(36) NOT NULL,
    FilePath VARCHAR(500) NOT NULL,
    ThumbnailPath VARCHAR(500) NULL,
    MimeType VARCHAR(100) NOT NULL,
    SizeBytes BIGINT NOT NULL,
    CapturedAtUtc DATETIME NULL,
    EntityType VARCHAR(40) NULL,
    EntityId VARCHAR(100) NULL,
    CreatedAtUtc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    DeletedAtUtc DATETIME NULL,
    tenant_id CHAR(36) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    INDEX IX_Photos_TenantId (TenantId),
    INDEX IX_Photos_tenant_id (tenant_id),
    INDEX IX_Photos_DeletedAtUtc (DeletedAtUtc),
    INDEX IX_Photos_Entity (EntityType, EntityId),
    INDEX IX_Photos_CreatedAtUtc (CreatedAtUtc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();

SET @has_entity_type = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @schema_name AND table_name = 'Photos' AND column_name = 'EntityType'
);
SET @statement = IF(@has_entity_type = 0, 'ALTER TABLE Photos ADD COLUMN EntityType VARCHAR(40) NULL', 'SELECT 1');
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @has_entity_id = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @schema_name AND table_name = 'Photos' AND column_name = 'EntityId'
);
SET @statement = IF(@has_entity_id = 0, 'ALTER TABLE Photos ADD COLUMN EntityId VARCHAR(100) NULL', 'SELECT 1');
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @has_entity_index = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @schema_name AND table_name = 'Photos' AND index_name = 'IX_Photos_Entity'
);
SET @statement = IF(@has_entity_index = 0, 'CREATE INDEX IX_Photos_Entity ON Photos (EntityType, EntityId)', 'SELECT 1');
PREPARE migration_statement FROM @statement;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
