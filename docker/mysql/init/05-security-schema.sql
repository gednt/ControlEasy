-- 05-security-schema.sql
-- Security module tables: AttendantProfiles, Shifts, Gatehouses, RefreshTokens.

CREATE TABLE IF NOT EXISTS AttendantProfiles (
    Id CHAR(36) NOT NULL PRIMARY KEY,
    TenantId CHAR(36) NOT NULL,
    UserId CHAR(36) NOT NULL,
    DisplayName VARCHAR(200) NULL,
    ShiftId CHAR(36) NULL,
    GatehouseId CHAR(36) NULL,
    Permissions VARCHAR(2000) NOT NULL DEFAULT '',
    Active BIT NOT NULL DEFAULT 1,
    CreatedAtUtc DATETIME(6) NOT NULL,
    UpdatedAtUtc DATETIME(6) NULL,
    tenant_id CHAR(36) NOT NULL,
    INDEX IX_AttendantProfiles_TenantId (TenantId),
    INDEX IX_AttendantProfiles_UserId (UserId),
    INDEX IX_AttendantProfiles_tenant_id (tenant_id),
    INDEX IX_AttendantProfiles_TenantId_UserId (TenantId, UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Shifts (
    Id CHAR(36) NOT NULL PRIMARY KEY,
    TenantId CHAR(36) NOT NULL,
    Name VARCHAR(120) NOT NULL,
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,
    CrossesMidnight BIT NOT NULL DEFAULT 0,
    tenant_id CHAR(36) NOT NULL,
    INDEX IX_Shifts_TenantId (TenantId),
    INDEX IX_Shifts_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Gatehouses (
    Id CHAR(36) NOT NULL,
    TenantId CHAR(36) NOT NULL,
    Name VARCHAR(120) NOT NULL,
    Location VARCHAR(500) NULL,
    Active TINYINT(1) NOT NULL DEFAULT 1,
    tenant_id CHAR(36) NOT NULL,
    PRIMARY KEY (Id),
    INDEX IX_Gatehouses_TenantId (TenantId),
    INDEX IX_Gatehouses_tenant_id (tenant_id),
    INDEX IX_Gatehouses_tenant_active (tenant_id, Active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS RefreshTokens (
    Id CHAR(36) NOT NULL PRIMARY KEY,
    UserId CHAR(36) NOT NULL,
    Token VARCHAR(256) NOT NULL UNIQUE,
    ExpiresAtUtc DATETIME(6) NOT NULL,
    RevokedAtUtc DATETIME(6) NULL,
    CreatedAtUtc DATETIME(6) NOT NULL,
    INDEX IX_RefreshTokens_UserId (UserId),
    INDEX IX_RefreshTokens_Token (Token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
