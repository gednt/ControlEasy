# Milestones

## v1.0 Reborn MVP (Shipped: 2026-07-13)

**Phases completed:** 11 phases, 11 plans, 0 tasks

**Delivered:** A tenant-isolated ASP.NET Core and Angular access-control platform with core condominium modules, canonical Docker runtime, hardened design system, demo environment, and continuous engineering gates.

**Key accomplishments:**

- Shipped the modular monolith and tenant-aware Residents, Visits, Vehicles, ServiceProviders, Apartments, Security, Administration, and Reports slices.
- Migrated persistence to the official DBTools 1.4.3 NuGet package and added a DBTools-backed runtime health check.
- Hardened the Angular design system with canonical tokens, reusable `ce-*` components, accessibility coverage, and visual regression snapshots.
- Added deterministic demo mode, first-boot administration, and tenant-switching flows.
- Added GitHub Actions, generated OpenAPI artifacts with drift enforcement, tenant-isolation guards, and token contract tests.

**Verification:** 79 unit, 55 integration, 6 architecture, and 203 Angular tests passed; Docker API/web rebuilt and `/health` returned `Healthy`.

**Known debt:** Generated OpenAPI artifacts are drift-checked but handwritten Angular services do not consume them yet.

**What's next:** v1.1 UI parity, dashboard live data, and vehicle editing.

---

## v1.1 UI & Dashboard (Defined: 2026-08-23 — Shipped without GSD artifacts 2026-09-12)

**Phases:** 9, 10
**Status:** Shipped (no GSD artifacts)

**Scope:** Complete the deferred UI parity, functional fixes, dashboard live data, and vehicle editing work from the v1.0-era user experience surface.

**Phases:**
- Phase 9: UI Parity & Functional Fixes (`UI-03`, `UI-04`) — residents page rebuilt with `ce-*` components (commit `0976037`); other pages not yet rebuilt
- Phase 10: Dashboard Live Stats & Vehicle Edit (`DASH-01`, `DASH-02`, `DASH-04`) — shipped: `GET /api/v1/dashboard/stats`, dashboard UI with live stat tiles, vehicle edit modal + `update()` in VehiclesApiService

**Roadmap:** `.planning/ROADMAP.md`
**Note:** Phase 9 and 10 shipped without GSD artifacts (PLAN/SUMMARY/VERIFICATION). Backfill is optional — same pattern as v1.0 Phases 1–6 + 11.

---

## v2.0 Gatehouse Photo & Consent Ledger (Defined: 2026-08-23 — Shipped 2026-09-13)

**Phases:** 11, 12, 13
**Status:** ✅ Shipped (all 3 phases complete)

**Scope:** Browser-based photo capture for residents, visitors, vehicles, and service providers with per-tenant per-category consent policy. The porteiro captures a photo in under 3 seconds. The condominium sets whether photo consent is required per category. Every entry is logged with millisecond-precision timestamps cross-referenceable with the condominium's external CCTV. No hardware framework — the camera is the browser's. No server-side image processing — all compression, EXIF stripping, and thumbnailing is client-side.

**Phases:**
- Phase 11: Photos & Consent Schema Infrastructure (`PHOTO-01`) — ✅ Shipped (commit `d895c01`): `IStorageProvider` (local + S3/MinIO + Amazon S3), `photos` table, `consent_audit_log` table (append-only triggers), `tenant_consent_policy` table, `photos.read/write/delete` permissions, upload/retrieve/soft-delete endpoints, 118 unit + 73 integration tests
- Phase 12: Photo Capture & Display (`PHOTO-02`) — ✅ Shipped (commit range `1e9d2cc`..`21f879e` on `feat/planning-reconcile-v2`): `ce-photo-capture` (camera + upload), `ce-photo`, `ce-photo-gallery`, `ce-photo-lightbox`, `PhotosApiService`, `photo-utils` (compressImage 0.8→0.6→0.3 ladder, generateThumbnail, uploadWithRetry 3× backoff), integration into residents/visits/vehicles/service-providers, 247 Angular unit tests + 5 Playwright E2E tests with exifr EXIF verification
- Phase 13: Consent Policy & Gatehouse Workflow (`CONSENT-01`, `CONSENT-02`, `CONSENT-03`) — ✅ Shipped (backend in commit `d895c01`; UI in commit range `0bbc788`..`b8d94a1` on `feat/planning-reconcile-v2`): `EntryLogService` + `ConsentPolicyService`, `ce-entry-workflow` (4-tile modal with auto-camera), `ce-override-reason` (Emergency/Vouched), `ce-entry-state-badge` (5 states), `ce-audit-filters` + `ce-audit-row` + `/audit` page (filterable + CSV export with ms timestamps), `/admin/consent-policy` page (4 toggles), 3 role guards, 8 unit tests + 12 Playwright E2E tests

**Verification:** Milestone audit `passed` (`.planning/v2.0-MILESTONE-AUDIT.md`); all 3 phases have `*-VERIFICATION.md` with `status: passed`; 5/5 requirements validated (PHOTO-01, PHOTO-02, CONSENT-01, CONSENT-02, CONSENT-03).

**Known tech debt (forward-compatible shims):**
- Photos entity binding via localStorage cache (backend lacks `entity_type`/`entity_id` columns)
- Thumbnails via CSS object-fit cover (backend lacks `/api/v1/photos/{id}/thumbnail` route)
- Consent policy list via 4× parallel category calls (backend lacks `/consent-policy` list endpoint)
- Pagination total via entries.length (backend lacks X-Total-Count header)

All shims are documented inline and in each phase VERIFICATION.md. Future backend work can remove them without component changes.

**Design principles:**
1. Logging is faster than skipping — 3-second workflow is the honesty enforcement
2. CCTV is the external backstop — ControlEasy carries timestamps, not footage
3. ControlEasy enables, doesn't enforce — policy is the condominium's
4. Client-side only for image processing — no server-side compression/thumbnailing/EXIF
5. No approval workflow, no anomaly detection — ship visibility

**Specs:** `.specs/photo-capture/`, `.specs/consent-gatehouse/`
**Roadmap:** `.planning/milestones/v2-ROADMAP.md`
**Origin:** Party-mode design session (2026-08-23)

---

## v2.2 Door Integration — Optional (Defined: 2026-08-23; renumbered from v2.1 on 2026-09-19 — v2.1 reassigned to the Integrated Visits & Account Operations milestone)

**Phases:** 14, 15
**Status:** Defined (gated on real condominium with hardware)

**Scope:** Condominiums that opt in can integrate ControlEasy with their door relay and card/biometric readers. The API triggers the relay with HMAC-signed commands; reader events create entry log records automatically. The door opens independently of ControlEasy — the API is a participant, not a gatekeeper. `IDeviceHandler` abstraction emerges from the second real integration, not speculatively.

**Phases:**
- Phase 14: Door Relay & Unlock Commands (`DOOR-01`) — `IDoorController`, HMAC-SHA256 signed unlock, rate-limited, audit-logged, hardware fallback, threat model
- Phase 15: Reader Events & Device Health (`DOOR-02`, `DOOR-03`) — `IDeviceHandler` (from 2 real integrations), `DeviceEvent` normalization, enforced ledger, device health monitoring

**Design principles:**
1. ControlEasy is a participant, not a gatekeeper — door opens independently; API observes + triggers
2. No speculative abstractions — `IDeviceHandler` from 2nd integration, not before
3. Security-sensitive — remote unlock is a new attack surface; own threat model, own adversarial review
4. Cameras are external — ControlEasy does not deploy/manage/proxy cameras

**Specs:** `.specs/door-integration/`
**Roadmap:** `.planning/milestones/v2-ROADMAP.md`
**Origin:** Party-mode design session (2026-08-23)

---

## Fast-Cycle: Multi-Arch Docker/CI (No Milestone)

**Status:** Defined (~1 week, no ceremony)

**Scope:** Multi-arch Docker builds (linux/amd64 + linux/arm64), GitHub Actions native-runner matrix, GHCR multi-arch manifest with cosign signing, `DOCKER_PLATFORM` opt-in env var. Pulled out of v2 milestones — low-risk DevOps hygiene.

**Specs:** `.specs/1 - modernization-roadmap-arm64/`
**Requirements:** `ARCH-01`, `ARCH-02`

---
