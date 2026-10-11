-- 0019-device-events.sql
-- Idempotent live-migration: device_events table for reader-event log.
-- Mirrors 19-device-events-schema.sql for existing MySQL databases that
-- already have the Phase 23/24 Devices schema.

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
    UNIQUE KEY uq_device_events_idempotent (tenant_id, DeviceId, SequenceNumber, ExternalEventId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
