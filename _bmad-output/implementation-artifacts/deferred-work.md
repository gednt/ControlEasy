
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-bootstrap-healthcheck-race.md`
  summary: DemoSeederService ignores InsertAsync/UpdateAsync bool results throughout; partial demo seed failure is silent (less severe due to seed-version self-heal on next boot).
  evidence: DemoSeederService.cs SeedUsersAsync/InsertUserAsync/WriteSeedVersionAsync all discard bool returns; audit-only per spec.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-bootstrap-healthcheck-race.md`
  summary: API container has no restart policy; a DB outage longer than the ~46s retry window kills the stack until manual intervention.
  evidence: docker/docker-compose.yml api service lacks restart policy; bootstrap throws after exhaustion (fail-fast is intentional).
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-bootstrap-healthcheck-race.md`
  summary: Seeded plaintext admin password logged at WRN to Console JSON + Seq on every first boot (pre-existing); GenerateRandomString has modulo bias (pre-existing).
  evidence: PlatformAdminBootstrapService.cs LogWarning(Password) unchanged; chars.Length=70 not power-of-2 vs RandomNumberGenerator.GetBytes.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-system-audit-records.md`
  summary: Add an executable, cross-tenant AuditLog integration test that proves the tenant interceptor excludes foreign rows.
  evidence: The repository test asserts generated tenant predicates, but its fake client does not execute SQL; the Dockerized Testcontainers integration suite cannot start in the current Windows Docker-socket environment.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-system-audit-records.md`
  summary: Move AuditLog sorting and pagination back to database-side execution once tenant-filter-safe DBTools ordering is available.
  evidence: The current repair must sort and page mapped rows in memory because the interceptor appends predicates after DBTools `whereClause` text; a large audit ledger can therefore load more rows than the requested page size.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-manual-lookup-403-permissions.md`
  summary: Refresh-error path in errorInterceptor (401 with refreshAuth throwing) is asserted via `logout` side-effect but the catchError branch is not isolated in tests.
  evidence: `src/Web/ControlEasyReborn.Web/src/app/core/interceptors/error.interceptor.spec.ts` exercises `refreshAuth.and.returnValue(of(null))` (switchMap null-token branch), not `throwError(() => new Error(...))` (catchError branch).
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-manual-lookup-403-permissions.md`
  summary: DemoSeederService should reuse PorteiroDefaults.Permissions + a MoradorDefaults.Permissions constant for the seeder permission strings, instead of duplicating the comma-joined strings in the seeder.
  evidence: `DemoSeederService.cs` allPerms/readPerms/moradorPerms are hand-maintained string literals that must be kept in sync with `PorteiroDefaults.Permissions` and a future `MoradorDefaults.Permissions`.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-manual-lookup-403-permissions.md`
  summary: AttendantProfiles.Permissions column is VARCHAR(2000); the backfill appends tokens without length-check, risking silent MySQL truncation if a future operator hand-crafts a long row.
  evidence: `docker/mysql/init/05-security-schema.sql` declares `Permissions VARCHAR(2000) NOT NULL DEFAULT ''`. Demo + spec values are well under the limit, but no guard.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-manual-lookup-403-permissions.md`
  summary: AccessDeniedPage does not surface a Sign Out button; a user with a stale but still-valid token who lands on /access-denied cannot recover without manually clearing localStorage.
  evidence: `src/Web/ControlEasyReborn.Web/src/app/features/auth/access-denied.page.ts` Back button only navigates to a role-default route, never clears the session.

## Deferred from: code review of spec-qr-camera-scanner + spec-fix-manual-lookup-403-permissions (2026-09-18)

- No visibilitychange handling on the QR scanner: hidden-tab track suspension triggers the NotReadableError retry loop while the page is hidden (qr-scan.page.ts:319-329).
- Backfill UPDATE writes string.Join(",") without a length guard against AttendantProfiles.Permissions VARCHAR(2000) truncation (DemoSeederService.cs:310-316).
- Stop-hook .ps1 uses PS7-only Get-Date -AsUTC but can be dispatched to Windows PowerShell 5.1; error is swallowed by SilentlyContinue, stamping an empty timestamp (scripts/hooks/verify-ci-agent-stop.ps1:189).
- verify-ci-local.ps1 comment claims PIPESTATUS-based pipefail that the inner dash script does not implement (verify-ci-local.ps1:116-118).

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-vehicle-create-500.md`
  summary: Validate create and update vehicle type values before persisting them.
  evidence: The request validators do not call `IsInEnum`, so a direct API request can persist an undefined numeric enum value.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-vehicle-create-500.md`
  summary: Make the access-control migration tolerant of databases that lack the Vehicles table.
  evidence: `0009-access-control.sql` conditionally alters `Vehicles` but does not first create it, so a nonstandard legacy schema without that table makes `db-migrate` fail before the API starts.

## Deferred from: split of spec-devices-per-device-configure (2026-10-14)

- source_spec: `_bmad-output/implementation-artifacts/spec-devices-per-device-configure.md`
  summary: Simulator usability trio — auto-bind gatehouse at virtual-device creation (with disabled-create guard when no gatehouse), admin deep-link from the Virtual door "no gatehouse binding" error to /devices, and a visible rotate chevron on the Device-simulator <details> disclosure.
  evidence: Carved to bring the Configure dialog + thresholds endpoint spec under the 1600-token ceiling; trio is frontend-only, small, and independently reviewable via a fresh bmad-build run.

- source_spec: `_bmad-output/implementation-artifacts/spec-operational-gatehouse-simulator.md`
  summary: Consider an ExternalEventId-level replay precheck in device-event ingestion (same external event with a different SequenceNumber currently writes one extra device_events row reporting the re-run outcome).
  evidence: Idempotency precheck keys on the (tenant, device, sequence, externalEventId) tuple (pre-existing contract); the canonical ScanAttemptId guard dedupes visit/access/refusal rows, so only the device-events row is duplicated and the matrix requirement (no duplicated ledger rows) still holds. Settling it needs a contract decision on ExternalEventId semantics; verify with a same-external-id/different-sequence integration test if pursued.
- source_spec: `_bmad-output/implementation-artifacts/spec-operational-gatehouse-simulator.md`
  summary: Extract a shared Playwright helper for the simulator-inspector availability probe (SIMULATOR_PROBE_PATH GUID + isInspectorAvailable duplicated across e2e specs).
  evidence: device-simulator-ui.spec.ts established the copy-pasted pattern; virtual-door-ui.spec.ts continued it. Shared e2e helper refactor, not caused by this story.
