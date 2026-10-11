-- 0020-device-heartbeats.sql
-- Idempotent live-migration: device_heartbeats table for DOOR-12 + DOOR-13.
-- Mirrors 20-device-heartbeats-schema.sql for existing MySQL databases that
-- already have the Phase 23/24/25 Devices schema.

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