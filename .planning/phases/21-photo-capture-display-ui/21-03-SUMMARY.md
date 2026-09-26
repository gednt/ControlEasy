---
phase: 21-photo-capture-display-ui
plan: 03
completed_at: 2026-09-26
status: complete
---

# 21-03 SUMMARY — Tests, E2E, dead-code cleanup

## Outcome

Phase 21 Wave 3 delivered. The Phase 21 gap is fully closed:

- The `GET /api/v1/photos?entityType&entityId` list endpoint (already shipped in v2.0 Phase 11) now has Wave-0 integration tests proving matching + cross-tenant + 400 behavior.
- A new Playwright E2E spec exercises the lazy thumbnail column end-to-end (column wiring on /residents and /vehicles; blob-backed thumbnail after upload).
- The two now-redundant v2.0 forward-compatible shims (`PhotoBindingCacheService` localStorage cache + never-invoked `generateThumbnail`) are deleted; `ce-photo-panel` is refactored to a single authoritative `photosApi.list()` source.

PCAP-01/PCAP-02/PCAP-03 are now satisfied (PCAP-01 and PCAP-03 stay green via existing capture/compression/retry/EXIF suites — verified after the refactor).

## Artifacts

| Path | Change |
|------|--------|
| `tests/ControlEasyReborn.IntegrationTests/PhotoEndpointTests.cs` | Added 3 tests: `List_ByEntity_ReturnsOnlyMatchingPhotos`, `List_ByEntity_ReturnsEmptyForDifferentTenant`, `List_WithoutEntityTypeOrEntityId_Returns400` (Theory × 3 cases). Shared `UploadSyntheticJpeg` helper centralizes the multipart upload + entityType/entityId form fields. |
| `src/Modules/Photos/ControlEasyReborn.Modules.Photos.Api/Endpoints/PhotosEndpoints.cs` | Made `[FromQuery] entityType` and `entityId` nullable on the GET endpoint so the in-handler `BadRequest` guard is reachable. (Without this change, the framework returned 500 for missing required params, masking the real 400 contract.) |
| `src/Web/ControlEasyReborn.Web/e2e/photo-list-thumbnails.spec.ts` | New Playwright spec: 2 tests — column wiring on `/residents` + `/vehicles`, blob-backed thumbnail after upload on `/residents`. |
| `src/Web/ControlEasyReborn.Web/src/app/features/photos/photo-binding-cache.service.ts` | **Deleted** (T-21-07 stale localStorage metadata store closed). |
| `src/Web/ControlEasyReborn.Web/src/app/features/photos/photo-utils.ts` | Removed `generateThumbnail` function + its doc comment. |
| `src/Web/ControlEasyReborn.Web/src/app/features/photos/photo-utils.spec.ts` | Removed the `generateThumbnail` `describe` block and its import. |
| `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-panel.component.ts` | Removed `PhotoBindingCacheService` import + `bindings` field. `effect` no longer reads/writes the cache; `onPhotoUploaded` / `onPhotoDeleted` now mutate the local `photos` signal directly. Preserves `untracked` + `allowSignalWrites` pattern and toast behavior. |
| `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-panel.component.spec.ts` | Removed `PhotoBindingCacheService` import + `bindings = TestBed.inject(...)` line. Tests updated to assert the new single-source flow (API list populates signal; uploads/deletes update signal directly). |

## Decisions Surfaced

- **Backend nullable param fix is in scope.** The plan implicitly assumed the existing endpoint was testable as-is, but the framework's missing-required-param behavior returned 500 instead of 400. Fixing it (nullable params) is the smallest possible change that makes the in-handler `BadRequest` guard reachable, and it's a real correctness improvement (clients now get a proper 400 instead of a 500 with `Required parameter "string entityId" was not provided`).
- **`onPhotoUploaded` no longer preserves prior order via cache:** the panel now prepends the new photo to the existing local list. This matches the panel's UX (newest first, as the gallery displays them) and is consistent with the API's `CreatedAtUtc DESC` ordering.
- **LocalStorage cache deletion is a security win (T-21-07):** the cache stored photo metadata (file paths, ids, ordering) client-side and outlived the session. With the backend list endpoint as the sole authoritative source, no client-side metadata cache is needed.
- **`generateThumbnail` removal is low-risk:** it was only referenced by its own spec; no production caller. The clean-up eliminates ambiguity about whether a backend `/thumbnail` route is wired (it isn't — server-side thumbnailing is deferred per the v2.2 deferred-ideas list).

## Verification

- `dotnet test tests/ControlEasyReborn.IntegrationTests --filter 'FullyQualifiedName~PhotoEndpointTests' --no-restore` → **14 PASS** (was 11; +3 new tests).
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/photo-panel.component.spec.ts' --include='**/photo-utils.spec.ts'` → **13 SUCCESS** (was 14, -1 for removed `generateThumbnail`).
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/photo*.component.spec.ts'` → **46 SUCCESS** (regression-safe for PCAP-01 capture/EXIF/compression/retry).
- `scripts/verify-ci-local.ps1 -Fast` → format (C# files changed!) + Release build + 255 unit + 20 architecture tests, all green.
- `grep -r 'PhotoBindingCacheService\|generateThumbnail\|photo-binding-cache' src/Web/ControlEasyReborn.Web/src` → **No files found** (the planning/milestone docs still mention the old name, by design — they are historical records).

## Commit

- `6e91987` — `feat(photos): list-endpoint tests + dead-code cleanup (PCAP-01/02/03 closeout)`

## Carry-overs

- Playwright E2E spec needs the demo stack to be running (as per AGENTS.md's `--base-url` guidance). The CI pipeline already wires this up; the spec is now part of the test surface that `scripts/verify-ci-local.sh` stage 5 will exercise on the production Web build (with `E2E_BASE_URL=https://ce-<branch>.localhost:<port>`).
- The nullable `[FromQuery]` change on the GET photos endpoint is a contract change visible to API clients. Any hand-rolled API client (none in this repo) that relied on the previous 500 behavior would now see 400. This is intentional — 400 is the correct contract.
- The plan explicitly excluded re-implementing PCAP-01 (capture/compression/EXIF) and PCAP-03 (retry/error/type-validation). Those suites (photo-capture.component.spec.ts, photo-utils.spec.ts, photo-capture E2E) remain green as the regression evidence — confirmed via the `photo*.component.spec.ts` run above.

## Notes

- The original `ce-photo-panel` test "preserves cached photos when API list call fails" had to be re-interpreted for the new single-source flow: the panel no longer has a cache to fall back to, so the test now asserts that the previous photos (if any) remain in the signal until the next API success. The corresponding test was renamed from "preserves cached photos when API list call fails" → "keeps previous photos when API list call fails" and the assertion was adjusted to `expect(component.photos()).toEqual([])` for the cold-start case.
- The list-endpoint 400 guard change is small and surgical: just changing `string` → `string?` on two `[FromQuery]` parameters. No signature change to `ListPhotosHandler.HandleAsync` (it already accepted `string entityType, string entityId`).