-- 20-device-heartbeats-schema.sql
-- Devices module heartbeat row (DOOR-12 + DOOR-13). One row per device —
-- the table is the rolling window of the most recent heartbeat plus the
-- derived per-device status. NOT append-only: the row is upserted in place
-- by IDeviceHeartbeatRepository.UpsertAsync on each ingestion event.
--
-- Mirrors docker/mysql/migrations/0020-device-heartbeats.sql for fresh MySQL
-- databases. There are NO triggers for UPDATE/DELETE — the row is managed
-- by the heartbeat pipeline (INSERT ... ON DUPLICATE KEY UPDATE); the
-- IDeviceHeartbeatRepository surface exposes only GetAsync + UpsertAsync +
-- ListAsync — no Update/Delete methods (the absence is intentional).
--
-- Per-device thresholds live on the row itself (OfflineAfterSeconds +
-- ErrorRateThresholdPercent) because the spec says "per-device thresholds"
-- and "default 60 / 10%" are the defaults until a TenantAdmin overrides them
-- in a future phase (Phase 26 ships the row with defaults; a future phase
-- adds per-device threshold override UI).

CREATE TABLE IF NOT EXISTS device_heartbeats (
    Id CHAR(36) NOT NULL,
    DeviceId CHAR(36) NOT NULL,
    TenantId CHAR(36) NOT NULL,
    LastHeartbeatAtUtc DATETIME(6) NOT NULL,
    Status TINYINT NOT NULL DEFAULT 0,
    ErrorCount INT NOT NULL DEFAULT 0,
    EventsSinceLastSuccess INT NOT NULL DEFAULT 0,
    OfflineAfterSeconds INT NOT NULL DEFAULT 60,
    ErrorRateThresholdPercent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    UpdatedAtUtc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    tenant_id CHAR(36) NOT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY uq_device_heartbeats_device (DeviceId),
    KEY ix_device_heartbeats_tenant_status (tenant_id, Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;