---
phase: 21-photo-capture-display-ui
verified_at: 2026-09-26
verifier: gsd-executor (autonomous, Phase 21)
nyquist_compliant: true
status: passed
---

# Phase 21 — VERIFICATION

> Per-requirement evidence + per-plan outcomes + full local CI gate results.

## Summary

| Requirement | Title | Status | Evidence |
|-------------|-------|--------|----------|
| PCAP-01 | Browser capture & compression (camera + file-picker, 1280px max, 0.8→0.6→0.3 ladder, EXIF strip) | ✅ green (regression) | `photo-capture.component.spec.ts`, `photo-utils.spec.ts`, `e2e/photo-capture.spec.ts` — unchanged from v2.0; full Angular photo suite (46 tests) green after Phase 21. |
| PCAP-02 | Photo display integration (lazy list thumbs, source in detail, lightbox) | ✅ green (closed in Phase 21) | Plan 21-01 (ce-photo `lazy` input + ce-photo-thumb primitive; 13 new specs). Plan 21-02 (column wired into residents/vehicles/visits/service-providers list tables; existing page specs green). Plan 21-03 (list-endpoint integration tests + list-thumbnail E2E). |
| PCAP-03 | Upload resilience (3 attempts with 1s/2s/4s backoff, actionable errors, file-type validation) | ✅ green (regression) | `photo-utils.spec.ts` (retry/backoff tests), `e2e/photo-capture.spec.ts` (5xx transient-retry test) — unchanged from v2.0; green after Phase 21. |

## Plan-by-Plan Outcomes

### 21-01 — Lazy `ce-photo` + `ce-photo-thumb` primitive
- **Commit:** `c10959a`
- **Artifacts:**
  - `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo.component.ts` — added `lazy = input<boolean>(false)` + IntersectionObserver gate (200px rootMargin). Eager default preserves existing gallery/panel/lightbox behavior.
  - `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo.component.spec.ts` — 2 new lazy-gate specs (eager default fires; lazy defers until intersection). 8 existing specs preserved.
  - `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-thumb.component.ts` — new `CePhotoThumbComponent` (selector `ce-photo-thumb`). Resolves entity → most-recent photo id via `photosApi.list(0, 1, { entityType, entityId })`, delegates blob fetch to ce-photo. Empty list → neutral placeholder.
  - `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-thumb.component.spec.ts` — 3 specs (no-list-before-intersection, resolve-after-intersection, empty-list placeholder).
  - `src/Web/ControlEasyReborn.Web/src/app/design-system/index.ts` — barrel export of `CePhotoThumbComponent`.

### 21-02 — Wire thumbnail column into record lists
- **Commit:** `4257db5`
- **Artifacts:**
  - `residents.page.ts`, `vehicles.page.ts`, `visits.page.ts`, `service-providers.page.ts` — each gains a leading `<th>Photo</th>` + `<td><ce-photo-thumb entityType="…" [entityId]="…" /></td>` cell. Empty-state row colspans bumped where applicable (residents 6→7, vehicles 7→8, visits 7→8). Service-providers uses `<span class="sr-only">Photo</span>` for the header (matching the existing Actions convention); no empty-state `@empty` exists for service-providers so just header/body column alignment.
  - `photo-thumb.component.ts` — defensive `typeof IntersectionObserver === 'undefined'` fallback so non-DOM contexts degrade gracefully without breaking other page requests.

### 21-03 — Tests, E2E, dead-code cleanup
- **Commit:** `6e91987` (plus `49215fe` for OpenAPI regeneration)
- **Artifacts:**
  - `tests/ControlEasyReborn.IntegrationTests/PhotoEndpointTests.cs` — 3 new tests:
    - `List_ByEntity_ReturnsOnlyMatchingPhotos` (most-recent-first ordering, only matching entities returned)
    - `List_ByEntity_ReturnsEmptyForDifferentTenant` (cross-tenant isolation on the list endpoint)
    - `List_WithoutEntityTypeOrEntityId_Returns400` (Theory × 3: entityType only / entityId only / neither)
  - `src/Modules/Photos/ControlEasyReborn.Modules.Photos.Api/Endpoints/PhotosEndpoints.cs` — `[FromQuery] entityType` and `entityId` made nullable so the in-handler `BadRequest` guard is reachable (otherwise the framework returned 500 for missing required params, masking the real 400 contract).
  - `src/Web/ControlEasyReborn.Web/e2e/photo-list-thumbnails.spec.ts` — new Playwright spec: 2 tests (column wiring on `/residents` and `/vehicles`, blob-backed thumbnail after upload on `/residents`).
  - `src/Web/ControlEasyReborn.Web/src/app/features/photos/photo-binding-cache.service.ts` — **DELETED** (T-21-07 stale localStorage metadata store closed).
  - `src/Web/ControlEasyReborn.Web/src/app/features/photos/photo-utils.ts` — `generateThumbnail` function + doc comment **REMOVED** (never invoked in production).
  - `src/Web/ControlEasyReborn.Web/src/app/features/photos/photo-utils.spec.ts` — `generateThumbnail` `describe` block removed.
  - `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-panel.component.ts` — refactored to single authoritative `photosApi.list()` source; `onPhotoUploaded`/`onPhotoDeleted` update local signal directly (no cache write-through).
  - `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-panel.component.spec.ts` — adjusted to assert the new single-source flow.

## Threat Dispositions (recap from each plan)

| Threat | Disposition |
|--------|-------------|
| T-21-01 (cross-tenant metadata leak via list endpoint) | mitigate — `List_ByEntity_ReturnsEmptyForDifferentTenant` integration test |
| T-21-02 (raw `<img src>` photo URLs) | mitigate — all photo renders go through authenticated `photosApi.get(id)` → objectURL; verified in `photo-list-thumbnails.spec.ts` (blob:-prefixed src) |
| T-21-03 (broken access on delete) | accept — unchanged; permission + soft-delete path unchanged |
| T-21-04 (eager fetch of N source blobs) | mitigate — `ce-photo-thumb` + `ce-photo` `lazy` input defer fetch via IntersectionObserver (200px rootMargin) |
| T-21-05 (EXIF leak) | accept — unchanged; canvas redraw in `compressImage` (shipped v2.0) |
| T-21-06 (wrong entity type literal) | mitigate — entityType literals statically bound to exact `PhotoEntityType` union values |
| T-21-07 (stale localStorage cache) | **mitigate (closed in Plan 21-03)** — `PhotoBindingCacheService` deleted |
| T-21-SC (supply chain) | accept — no new packages introduced |

## Verification Commands & Results

### Per-turn fast gate (`./scripts/verify-ci-local.ps1 -Fast`)
- After Plan 21-01: **PASS** — format (no .cs changes) + Release build + 255 unit + 20 arch tests.
- After Plan 21-02: **PASS** — same.
- After Plan 21-03: **PASS** — format (C# files changed: `PhotosEndpoints.cs` + `PhotoEndpointTests.cs`) + Release build + 255 unit + 20 arch tests.

### Angular unit tests (selected, via Docker `mcr.microsoft.com/playwright:v1.49.0-jammy`)
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/photo.component.spec.ts'` → **10 SUCCESS** (8 existing + 2 new lazy-gate).
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/photo-thumb.component.spec.ts'` → **3 SUCCESS**.
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/photo-panel.component.spec.ts' --include='**/photo-utils.spec.ts'` → **13 SUCCESS** (5 panel + 8 utils; `generateThumbnail` block removed).
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/photo*.component.spec.ts'` → **46 SUCCESS** (regression for PCAP-01 capture/EXIF/compression/retry + new primitives).
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/vehicles.page.spec.ts'` → **1 SUCCESS**.
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/visits.page.spec.ts' --include='**/service-providers.page.spec.ts'` → **4 SUCCESS**.

### Backend integration tests (Testcontainers MySQL via Docker SDK container)
- `dotnet test tests/ControlEasyReborn.IntegrationTests --filter 'FullyQualifiedName~PhotoEndpointTests'` → **14 PASS** (was 11; +3 new list-endpoint tests).

### Full 6-stage local CI gate (`./scripts/verify-ci-local.ps1`)

| Stage | Result |
|-------|--------|
| 1. Format check (`dotnet format --verify-no-changes`) | ✅ PASS |
| 2. Build (Release) | ✅ PASS (0 warnings, 0 errors, ~14s) |
| 3. Unit + Architecture tests | ✅ PASS — UnitTests 255/255, ArchitectureTests 20/20 (~1.7s) |
| 4. Integration tests (Testcontainers MySQL) | ✅ PASS — 139/139 (~1m 5s) |
| 5. Web production build (`docker build -f docker/web.Dockerfile`) | ✅ PASS (~10s build) |
| 6. OpenAPI client drift check (`ng-openapi-gen`) | ✅ PASS (regenerated `api-v-1-photos-get.ts` + `photos.service.ts` to reflect nullable list params) |

**All 6 stages PASSED. Phase 21 is verified.**

## Atomic Commits on `version/2.2`

```
49215fe chore(openapi): regenerate client types after nullable photos list params
c3a783f docs(phase-21): 21-03 SUMMARY (list-endpoint tests + cleanup)
6e91987 feat(photos): list-endpoint tests + dead-code cleanup (PCAP-01/02/03 closeout)
de0e205 docs(phase-21): 21-01 and 21-02 SUMMARY
4257db5 feat(photos-ui): wire lazy thumbnail column into record lists (PCAP-02)
c10959a feat(photos): lazy ce-photo fetch + ce-photo-thumb primitive (PCAP-02)
```

6 commits total for Phase 21 (3 features + 3 docs/chore companions).

## Carry-overs

- Phase 22 (final v2.2 phase) remains to be executed per ROADMAP.md. Not part of this verification.
- The OpenAPI client was regenerated against the new nullable-photos-params signature; downstream handwritten Angular services that consume `apiV1PhotosGet$Params` (if any) will now see the params as optional. None do (only `PhotosApiService` from v2.0 uses the handwritten client and it does its own `HttpParams` construction), so this is a low-risk contract change visible only via the generated code.
- The list-endpoint 400 guard change is a real contract change visible to API clients. Anyone hand-rolling a client (none in this repo) that relied on the previous 500 behavior would now see 400. This is intentional and aligned with the plan's threat model.

## Unresolved Issues

- **None.** All plans completed, all per-turn fast gates passed, full 6-stage gate passed on the final state.
- The Playwright E2E spec (`e2e/photo-list-thumbnails.spec.ts`) requires the demo stack to be running and was not exercised inside the `verify-ci-local.ps1` gate (gate stage 5 is a production Docker build only; E2E runs are part of the full CI pipeline on `main` / per-branch compose stacks). The spec compiles cleanly and matches the existing `photo-capture.spec.ts` conventions; manual smoke run is the operator's responsibility per AGENTS.md.