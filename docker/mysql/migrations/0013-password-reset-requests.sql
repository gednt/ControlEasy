-- 0013-password-reset-requests.sql
-- Migration to create PasswordResetRequests table for password management

CREATE TABLE IF NOT EXISTS PasswordResetRequests (
    Id CHAR(36) NOT NULL,
    TenantId CHAR(36) NOT NULL,
    UserId CHAR(36) NOT NULL,
    NormalizedEmail VARCHAR(256) NOT NULL,
    HashedTempPassword VARCHAR(255) NOT NULL,
    DeliveryState VARCHAR(32) NOT NULL DEFAULT 'Pending',
    FailureReason VARCHAR(512) NULL,
    RequestedByUserId CHAR(36) NULL,
    CreatedAtUtc DATETIME(6) NOT NULL,
    DeliveredAtUtc DATETIME(6) NULL,
    ExpiresAtUtc DATETIME(6) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    PRIMARY KEY (Id),
    INDEX idx_pwreset_tenant_user (tenant_id, UserId),
    INDEX idx_pwreset_email_created (NormalizedEmail, CreatedAtUtc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
