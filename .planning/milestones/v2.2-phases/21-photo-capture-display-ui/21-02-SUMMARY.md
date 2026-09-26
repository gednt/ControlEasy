---
phase: 21-photo-capture-display-ui
plan: 02
completed_at: 2026-09-26
status: complete
---

# 21-02 SUMMARY — Wire lazy thumbnail column into record lists

## Outcome

Phase 21 Wave 2 delivered. All four record-list tables (residents / vehicles /
visits / service-providers) now render a leading lazy thumbnail column using
`ce-photo-thumb`. PCAP-02's "thumbnails in record lists (lazy)" clause is now
satisfied across the entire feature surface.

## Artifacts

| Path | Change |
|------|--------|
| `src/Web/ControlEasyReborn.Web/src/app/features/residents/residents.page.ts` | Imports + `imports` array extended with `CePhotoThumbComponent`. `<th scope="col">Photo</th>` as the FIRST column header; `<td><ce-photo-thumb entityType="resident" [entityId]="resident.id" /></td>` as the FIRST cell in each row; empty-state `colspan` 6 → 7. |
| `src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.ts` | Same pattern: leading `<th>Photo</th>` + `<td><ce-photo-thumb entityType="vehicle" [entityId]="vehicle.id" /></td>`; empty-state `colspan` 7 → 8. |
| `src/Web/ControlEasyReborn.Web/src/app/features/visits/visits.page.ts` | Same pattern: `<th>Photo</th>` + `<td><ce-photo-thumb entityType="visitor" [entityId]="visit.id" /></td>`; empty-state `colspan` 7 → 8. |
| `src/Web/ControlEasyReborn.Web/src/app/features/service-providers/service-providers.page.ts` | Same pattern with the existing `sr-only` header convention: `<th scope="col"><span class="sr-only">Photo</span></th>` + `<td><ce-photo-thumb entityType="service-provider" [entityId]="provider.id" /></td>`. No empty-state `@empty` here — service-providers handles empty list above the table, so header/body column counts just stay aligned (5 → 6). |
| `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-thumb.component.ts` | Defensive `typeof IntersectionObserver === 'undefined'` branch — falls back to `runResolve()` so non-DOM test contexts (or older browsers without IntersectionObserver) degrade gracefully without breaking other page requests. |

## Decisions Surfaced

- **Header row order**: Photo is the FIRST column on every page so the
  eye scans left-to-right "photo → name → details" which is consistent
  with the existing detail modals and the rest of the SPA's visual rhythm.
- **Header style**: `Photo` is the visible text on three pages; service-providers uses `<span class="sr-only">Photo</span>` to match its existing convention for the Actions column (visually hidden, screen-reader readable).
- **`entityType` literals match `PhotoEntityType` exactly**: `'resident' | 'visitor' | 'vehicle' | 'service-provider'` — the same union typed in `photos-api.service.ts`. A row can only request photos of its own entity; the backend rejects unknown types via the validator.
- **No new HTTP requests on page load beyond what `ce-photo-thumb` already does**: each row only triggers `photosApi.list(0, 1, …)` after the IntersectionObserver fires (200px rootMargin prefetch). Off-screen rows still don't issue the call.
- **Defensive IntersectionObserver fallback**: when the browser/test env lacks `IntersectionObserver`, we skip the wait and resolve immediately. This keeps `ce-photo-thumb` working in non-DOM contexts and avoids silent data-display loss in legacy browsers.

## Verification

- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/vehicles.page.spec.ts'` → **1 SUCCESS**.
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/visits.page.spec.ts' --include='**/service-providers.page.spec.ts'` → **4 SUCCESS** (2 + 2).
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/photo*.component.spec.ts'` → **46 SUCCESS** (regression-safe).
- `scripts/verify-ci-local.ps1 -Fast` → format + Release build + 255 unit + 20 architecture tests, all green.

## Commit

- `4257db5` — `feat(photos-ui): wire lazy thumbnail column into record lists (PCAP-02)`

## Carry-overs

- Plan 21-03 will (a) add backend integration tests for the list endpoint
  (matching, cross-tenant empty, missing-param 400), (b) add a Playwright
  E2E spec asserting the column wiring, and (c) delete the now-dead
  `PhotoBindingCacheService` localStorage cache + `generateThumbnail` shim.
- The `<ce-photo-thumb>` cell is the single integration point for the list
  thumbnail column; future variants (e.g. round avatars, multi-photo
  mosaic) should branch from this component rather than re-implement
  the list + fetch lazy chain.