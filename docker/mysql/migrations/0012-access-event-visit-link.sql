-- 0012-access-event-visit-link.sql
-- Idempotent live-migration matching init/15-access-events-visit-link.sql.
-- A visitor access event is audit context for the Visit it created or advanced.

SET @visit_id_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AccessEvents'
                          AND COLUMN_NAME = 'VisitId');
SET @sql = IF(@visit_id_exists = 0,
    'ALTER TABLE AccessEvents ADD COLUMN VisitId CHAR(36) NULL, ADD INDEX ix_access_events_tenant_visit (tenant_id, VisitId)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill only mutually unique pre-link visitor arrivals. Matching the
-- tenant, destination, attendant, gatehouse and exact arrival time narrows
-- candidates; a link is persisted only when it is one event to one Visit.
-- Contested historical rows intentionally remain unlinked and visible.
CREATE TEMPORARY TABLE AccessEventVisitCandidates (
    AccessEventId CHAR(36) NOT NULL,
    VisitId CHAR(36) NOT NULL,
    PRIMARY KEY (AccessEventId, VisitId)
);

INSERT INTO AccessEventVisitCandidates (AccessEventId, VisitId)
SELECT ae.Id, v.Id
FROM AccessEvents ae
JOIN Visits v
  ON BINARY v.tenant_id = BINARY ae.tenant_id
 AND BINARY v.ApartmentId = BINARY ae.DestinationApartmentId
 AND BINARY v.AttendantProfileId <=> BINARY ae.PerformedByProfileId
 AND BINARY v.GatehouseId <=> BINARY ae.GatehouseId
 AND v.CheckedInAtUtc = ae.OccurredAtUtc
WHERE ae.VisitId IS NULL
  AND ae.EventKind = 0
  AND ae.SubjectType = 2
  AND ae.Direction = 0;

CREATE TEMPORARY TABLE AccessEventVisitBackfill (
    AccessEventId CHAR(36) NOT NULL PRIMARY KEY,
    VisitId CHAR(36) NOT NULL
);

INSERT INTO AccessEventVisitBackfill (AccessEventId, VisitId)
SELECT AccessEventId, VisitId
FROM (
    SELECT AccessEventId,
           VisitId,
           COUNT(*) OVER (PARTITION BY AccessEventId) AS EventCandidateCount,
           COUNT(*) OVER (PARTITION BY VisitId) AS VisitCandidateCount
    FROM AccessEventVisitCandidates
) AS candidates
WHERE EventCandidateCount = 1
  AND VisitCandidateCount = 1;

UPDATE AccessEvents ae
JOIN AccessEventVisitBackfill mapping ON BINARY mapping.AccessEventId = BINARY ae.Id
SET ae.VisitId = mapping.VisitId;

DROP TEMPORARY TABLE AccessEventVisitBackfill;
DROP TEMPORARY TABLE AccessEventVisitCandidates;
