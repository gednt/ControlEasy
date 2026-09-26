---
phase: 21-photo-capture-display-ui
plan: 01
completed_at: 2026-09-26
status: complete
---

# 21-01 SUMMARY — Lazy ce-photo + ce-photo-thumb primitive

## Outcome

Phase 21 Wave 1 delivered. PCAP-02's "thumbnails in record lists (lazy)"
clause is now backed by a reusable primitive that defers both the entity →
photo-id resolution AND the authenticated blob fetch until the host nears
the viewport.

## Artifacts

| Path | Change |
|------|--------|
| `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo.component.ts` | Added opt-in `lazy` input + IntersectionObserver gate (200px rootMargin) that defers `photosApi.get(id)` until near-viewport. Default behavior unchanged (gallery/panel/lightbox stay eager). |
| `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo.component.spec.ts` | Two new specs: lazy-gate defers the fetch, eager default fires `photosApi.get` immediately. Existing 8 specs preserved. |
| `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-thumb.component.ts` | New `CePhotoThumbComponent` (selector `ce-photo-thumb`). Lazily resolves `entityType` + `entityId` to most-recent photo id via `photosApi.list(0, 1, …)`, then renders `<ce-photo [photoId] [lazy]>`. Renders a neutral placeholder when the list is empty. |
| `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-thumb.component.spec.ts` | 3 specs asserting no-list-before-intersection, entity → photo-id resolution, empty-list placeholder. |
| `src/Web/ControlEasyReborn.Web/src/app/design-system/index.ts` | Added `CePhotoThumbComponent` barrel export. |

## Decisions Surfaced

- **"lazy" = true fetch-laziness, not just decode-laziness.** The honest reading of PCAP-02 — `loading="lazy"` on the inner `<img>` only defers decode, not the authenticated HTTP fetch. The IntersectionObserver gate in `ce-photo` defers the actual `photosApi.get(id)` request, eliminating the ~99% bandwidth waste of eagerly fetching full source blobs for every off-screen list row.
- **Eager behavior preserved.** `lazy` defaults to `false` so `ce-photo-gallery`, `ce-photo-lightbox`, and `ce-photo-panel` are regression-safe (their callers don't change in this plan; plan 21-02 wires the lazy-on path through the new `ce-photo-thumb` wrapper).
- **Entity → photo resolution reuses the API list endpoint.** `ce-photo-thumb` calls `photosApi.list(0, 1, { entityType, entityId })` (which is already ordered most-recent-first per `PhotoRepository.ListByEntityAsync`), avoiding a new "latest photo for entity" endpoint.

## Verification

- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/photo.component.spec.ts'` → **10 SUCCESS** (8 existing + 2 new).
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/photo-thumb.component.spec.ts'` → **3 SUCCESS**.
- `scripts/verify-ci-local.ps1 -Fast` → format (no .cs changes) + Release build + 255 unit + 20 architecture tests, all green.

## Commit

- `c10959a` — `feat(photos): lazy ce-photo fetch + ce-photo-thumb primitive (PCAP-02)`

## Carry-overs

- Plan 21-02 imports `CePhotoThumbComponent` and wires a leading thumbnail column into residents / vehicles / visits / service-providers list tables.
- The `lazy` gate could later be tightened (e.g. honour `prefers-reduced-data`) without touching consumers — `ce-photo-thumb` is the single integration point.
- Empty-entity rendering is a neutral grey square by design; if the product wants an icon (e.g. 👤), it can be added to `ce-photo-thumb` without changing the page consumers.

## Notes

- The `IntersectionObserver` test stub is a plain class assigned to `(globalThis as …).IntersectionObserver` so the constructor in `ce-photo` / `ce-photo-thumb` picks it up synchronously. Each test resets it in `afterEach` to avoid bleeding across cases.
- `ce-photo`'s effect now also runs an explicit `disconnectObserver()` + `unsubscribe()` cleanup chain so toggling `lazy` on/off doesn't leak subscriptions.