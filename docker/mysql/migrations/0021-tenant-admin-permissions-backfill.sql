-- 0021-tenant-admin-permissions-backfill.sql
-- Idempotent live-migration: v2.3 hotfix.
--
-- Existing AttendantProfiles rows for both TenantAdmin (role TenantAdmin,
-- permissions leading token `Visits.CheckIn`) and Porteiro (role
-- AttendantProfile, leading token `Visits.Read`) were seeded before Phase 23
-- /24/26 added the v2.3 device permission tokens. Without these on the JWT
-- `permissions` claim, multiple v2.3 surfaces break:
--   * TenantAdmin on /administration hits access-denied because
--     `GET /api/v1/tenants/current/door-integration` requires
--     Permission_devices.read (TenantEndpoints.cs).
--   * Porteiro cannot trigger unlock from the gatehouse (Permission_devices.unlock)
--     nor view the device-health dashboard (Permission_devices.read_health).
--
-- Self-healing: the in-app `EnsureAttendantProfileAsync` handler already
-- reconciles missing defaults on next login
-- (TenantAdminRepository.cs:385-401). This migration closes the gap for users
-- who cannot log out yet, and covers Porteiro profiles whose Ensure path
-- only reconciles to the TenantAdmin default set.
--
-- Decision matrix (per v2.3 CONTEXT.md / ROADMAP.md):
--   * `devices.unlock`              — both TenantAdmin and Porteiro
--   * `devices.read`                — both
--   * `devices.write`               — TenantAdmin only (NOT granted to Porteiro)
--   * `tenants.toggle_door_integration` — TenantAdmin only (NOT granted to Porteiro)
--   * `devices.read_health`         — both
--
-- Safe to re-run (idempotent — gated by `NOT LIKE '%devices.read%'`),
-- safe on UTF-8 collations used by the rest of the schema (utf8mb4_unicode_ci
-- — LIKE is case-insensitive).

UPDATE AttendantProfiles
SET Permissions = TRIM(BOTH ',' FROM CONCAT(
        COALESCE(Permissions, ''),
        IF(LOCATE('devices.unlock', COALESCE(Permissions, '')) > 0, '', ',devices.unlock'),
        IF(LOCATE('devices.read', COALESCE(Permissions, '')) > 0, '', ',devices.read'),
        IF(LOCATE('devices.read_health', COALESCE(Permissions, '')) > 0,
           '', ',devices.read_health')
    ))
WHERE Permissions LIKE 'Visits.Read,%'
  AND Permissions NOT LIKE '%devices.read%';

UPDATE AttendantProfiles
SET Permissions = TRIM(BOTH ',' FROM CONCAT(
        COALESCE(Permissions, ''),
        IF(LOCATE('devices.unlock', COALESCE(Permissions, '')) > 0, '', ',devices.unlock'),
        IF(LOCATE('devices.read', COALESCE(Permissions, '')) > 0, '', ',devices.read'),
        IF(LOCATE('devices.write', COALESCE(Permissions, '')) > 0, '', ',devices.write'),
        IF(LOCATE('tenants.toggle_door_integration', COALESCE(Permissions, '')) > 0,
           '', ',tenants.toggle_door_integration'),
        IF(LOCATE('devices.read_health', COALESCE(Permissions, '')) > 0,
           '', ',devices.read_health')
    ))
WHERE Permissions LIKE 'Visits.CheckIn,%'
  AND Permissions NOT LIKE '%devices.read%';
