-- System-wide security audit: AccessEvents and scan refusals predate the
-- AuditLog writer. Backfill each source row once so existing gatehouse
-- movements are visible, and keep this safe when db-migrate runs again.

CREATE TABLE IF NOT EXISTS AuditLog (
    Id CHAR(36) NOT NULL PRIMARY KEY,
    TenantId CHAR(36) NOT NULL,
    Category VARCHAR(100) NOT NULL DEFAULT 'System',
    Action VARCHAR(200) NOT NULL,
    EntityType VARCHAR(100) NOT NULL,
    EntityId CHAR(36) NOT NULL,
    Severity INT NOT NULL DEFAULT 0,
    PerformedByUserId CHAR(36) NOT NULL,
    PerformedByName VARCHAR(200) NULL,
    Details VARCHAR(4000) NULL,
    MetadataJson TEXT NULL,
    CreatedAtUtc DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tenant_id CHAR(36) NOT NULL,
    INDEX IX_AuditLog_TenantId (TenantId),
    INDEX IX_AuditLog_EntityType (EntityType),
    INDEX IX_AuditLog_EntityId (EntityId),
    INDEX IX_AuditLog_CreatedAtUtc (CreatedAtUtc),
    INDEX IX_AuditLog_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO AuditLog (
    Id, TenantId, Category, Action, EntityType, EntityId, Severity,
    PerformedByUserId, PerformedByName, Details, MetadataJson, CreatedAtUtc, tenant_id
)
SELECT
    UUID(),
    ae.TenantId,
    CASE WHEN ae.EventKind = 1 THEN 'Gatehouse' ELSE 'Security' END,
    CASE
        WHEN ae.EventKind = 1 THEN 'PackageDropRecorded'
        WHEN ae.AccessMethod = 0 THEN 'QrAccessGranted'
        ELSE 'ManualAccessRecorded'
    END,
    'AccessEvent',
    ae.Id,
    0,
    '00000000-0000-0000-0000-000000000000',
    NULL,
    CASE
        WHEN ae.EventKind = 1 THEN CONCAT('Package drop recorded for ', ae.DestinationBlock, '/', ae.DestinationUnit, '.')
        WHEN ae.AccessMethod = 0 THEN CONCAT('QR access recorded for ', ae.DestinationBlock, '/', ae.DestinationUnit, '.')
        ELSE CONCAT('Manual access recorded for ', ae.DestinationBlock, '/', ae.DestinationUnit, '.')
    END,
    JSON_OBJECT(
        'source', 'AccessEvents',
        'direction', CASE WHEN ae.Direction = 0 THEN 'entrance' ELSE 'exit' END,
        'eventKind', CASE WHEN ae.EventKind = 1 THEN 'package-drop' ELSE 'access' END
    ),
    ae.OccurredAtUtc,
    ae.tenant_id
FROM AccessEvents ae
WHERE NOT EXISTS (
    SELECT 1
    FROM AuditLog existing
    WHERE existing.tenant_id = ae.tenant_id
      AND existing.EntityType = 'AccessEvent'
      AND existing.EntityId = ae.Id
);

INSERT INTO AuditLog (
    Id, TenantId, Category, Action, EntityType, EntityId, Severity,
    PerformedByUserId, PerformedByName, Details, MetadataJson, CreatedAtUtc, tenant_id
)
SELECT
    UUID(),
    refusal.TenantId,
    'Security',
    'QrAccessRefused',
    'RefusedScanAttempt',
    refusal.Id,
    1,
    '00000000-0000-0000-0000-000000000000',
    NULL,
    CONCAT('QR access refused: ', refusal.FailureCode, '.'),
    JSON_OBJECT(
        'source', 'RefusedScanAttempts',
        'direction', CASE WHEN refusal.Direction = 0 THEN 'entrance' WHEN refusal.Direction = 1 THEN 'exit' ELSE NULL END,
        'failureCode', refusal.FailureCode
    ),
    refusal.OccurredAtUtc,
    refusal.tenant_id
FROM RefusedScanAttempts refusal
WHERE NOT EXISTS (
    SELECT 1
    FROM AuditLog existing
    WHERE existing.tenant_id = refusal.tenant_id
      AND existing.EntityType = 'RefusedScanAttempt'
      AND existing.EntityId = refusal.Id
);
