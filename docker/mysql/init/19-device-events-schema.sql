-- 19-device-events-schema.sql
-- Devices module reader-event log. Append-only table that records every
-- event a registered device emits to the platform — card reads, refusals,
-- tamper alerts, reconnects. The single-write-path doctrine from Phase 25
-- means this table is the ledger marker: a row here exists IFF the matching
-- Visit / AccessEvent / RefusedScanAttempt rows exist (written by the
-- existing VisitorArrivalHandler / RecordAccessScanHandler /
-- RecordRefusedScanHandler write paths).
--
-- Mirrors docker/mysql/migrations/0019-device-events.sql for fresh MySQL
-- databases. There are NO triggers for UPDATE/DELETE — the table is
-- append-only by API contract (no endpoints expose update or delete).
-- The IDeviceEventRepository surface exposes only InsertAsync +
-- GetByIdempotencyKeyAsync + GetByIdAsync + ListAsync — the absence of
-- update/delete on the abstraction is intentional (DOOR-09).

CREATE TABLE IF NOT EXISTS device_events (
    Id CHAR(36) NOT NULL,
    TenantId CHAR(36) NOT NULL,
    DeviceId CHAR(36) NOT NULL,
    EventType VARCHAR(40) NOT NULL,
    PayloadJson JSON NOT NULL,
    OccurredAtUtc DATETIME(6) NOT NULL,
    ProcessedAtUtc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    SequenceNumber BIGINT NOT NULL,
    ExternalEventId CHAR(36) NULL,
    ResultCode VARCHAR(40) NOT NULL,
    FailureCode VARCHAR(60) NULL,
    VisitId CHAR(36) NULL,
    AccessEventId CHAR(36) NULL,
    RefusedScanAttemptId CHAR(36) NULL,
    CorrelationId CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    PRIMARY KEY (Id),
    KEY ix_device_events_tenant_device_time (tenant_id, DeviceId, OccurredAtUtc),
    KEY ix_device_events_visit (tenant_id, VisitId),
    KEY ix_device_events_access_event (tenant_id, AccessEventId),
    KEY ix_device_events_refused_scan (tenant_id, RefusedScanAttemptId),
    -- The idempotency key: a redelivered event with the same
    -- (tenant_id, device_id, sequence_number, external_event_id) tuple is
    -- a no-op (Phase 25 DOOR-11 + plan §"Card-match resolution").
    -- MySQL treats NULLs as distinct in UNIQUE indexes, which is the
    -- desired behavior for the rare case where ExternalEventId is NULL
    -- (sequence-only uniqueness still holds for non-null rows).
    UNIQUE KEY uq_device_events_idempotent (tenant_id, DeviceId, SequenceNumber, ExternalEventId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
