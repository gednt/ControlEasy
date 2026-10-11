-- 21-tenant-admin-permissions-backfill.sql
-- Idempotent: v2.3 hotfix. Appends the Phase 23/24/26 v2.3 device permission
-- tokens to existing AttendantProfiles rows (TenantAdmin + Porteiro) that
-- were seeded before those permissions existed. See
-- 0021-tenant-admin-permissions-backfill.sql for the migration equivalent; this
-- init script is the fresh-schema mirror run on container bootstrap.
--
-- See 0021-.../sql for the per-role permission matrix and predicate details.

UPDATE AttendantProfiles ap
JOIN Users u ON u.Id = ap.UserId
SET ap.Permissions = CONCAT(
    ap.Permissions,
    IF(ap.Permissions NOT LIKE '%devices.unlock%',   ',devices.unlock',   ''),
    IF(ap.Permissions NOT LIKE '%devices.read%',     ',devices.read',     ''),
    IF(ap.Permissions NOT LIKE '%devices.read_health%', ',devices.read_health', '')
)
WHERE u.Roles = 'AttendantProfile'
  AND (
      ap.Permissions NOT LIKE '%devices.unlock%'
   OR ap.Permissions NOT LIKE '%devices.read%'
   OR ap.Permissions NOT LIKE '%devices.read_health%'
  );

UPDATE AttendantProfiles ap
JOIN Users u ON u.Id = ap.UserId
SET ap.Permissions = CONCAT(
    ap.Permissions,
    IF(ap.Permissions NOT LIKE '%devices.unlock%',                ',devices.unlock',                ''),
    IF(ap.Permissions NOT LIKE '%devices.read%',                  ',devices.read',                  ''),
    IF(ap.Permissions NOT LIKE '%devices.write%',                 ',devices.write',                 ''),
    IF(ap.Permissions NOT LIKE '%tenants.toggle_door_integration%', ',tenants.toggle_door_integration', ''),
    IF(ap.Permissions NOT LIKE '%devices.read_health%',            ',devices.read_health',           '')
)
WHERE u.Roles LIKE '%TenantAdmin%'
  AND (
      ap.Permissions NOT LIKE '%devices.unlock%'
   OR ap.Permissions NOT LIKE '%devices.read%'
   OR ap.Permissions NOT LIKE '%devices.write%'
   OR ap.Permissions NOT LIKE '%tenants.toggle_door_integration%'
   OR ap.Permissions NOT LIKE '%devices.read_health%'
  );
