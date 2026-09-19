-- 13-backfill-tenant-admin-permissions.sql
-- Backfill Access.* permissions for TenantAdmin attendant profiles.

UPDATE AttendantProfiles ap
JOIN Users u ON u.Id = ap.UserId
SET ap.Permissions = CONCAT(
    ap.Permissions,
    IF(ap.Permissions NOT LIKE '%Access.Read%', ',Access.Read', ''),
    IF(ap.Permissions NOT LIKE '%Access.Access.Operate%', ',Access.Access.Operate', ''),
    IF(ap.Permissions NOT LIKE '%Access.Control.Issue%', ',Access.Control.Issue', ''),
    IF(ap.Permissions NOT LIKE '%Access.Control.Replace%', ',Access.Control.Replace', ''),
    IF(ap.Permissions NOT LIKE '%Access.Control.Revoke%', ',Access.Control.Revoke', '')
)
WHERE u.Roles LIKE '%TenantAdmin%'
  AND (
      ap.Permissions NOT LIKE '%Access.Control.Issue%'
   OR ap.Permissions NOT LIKE '%Access.Control.Replace%'
   OR ap.Permissions NOT LIKE '%Access.Control.Revoke%'
   OR ap.Permissions NOT LIKE '%Access.Read%'
   OR ap.Permissions NOT LIKE '%Access.Access.Operate%'
  );
