# Phase 21: Photo Capture & Display UI — Research

**Researched:** 2026-09-24
**Domain:** Browser photo capture/compression/display (Angular 18 client-side only) + gap-analysis closeout against shipped v2.0 Phase 12
**Confidence:** HIGH (current state verified by direct codebase inspection)

## Summary

This phase is a **gap-analysis closeout, not a greenfield build.** The overwhelming majority of Phase 21 was already shipped as v2.0 Phase 12 (commit range `5be2a19..21f879e`, verified by `12-VERIFICATION.md` and `12-01-SUMMARY.md`), and the backend has since grown further (entity binding + list endpoint now exist, closing two of the three v2.0 "forward-compatible shim" deviations). Direct inspection of `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/`, `src/app/features/photos/`, `src/Modules/Photos/`, the four entity pages, the E2E spec, and `docker/mysql/init/09a-photos-schema.sql` confirms that PCAP-01 (capture + compression ladder + EXIF strip) and PCAP-03 (retry + error states + type validation) are **already fully implemented and tested**. PCAP-02 is **mostly** met — lightbox, source-in-detail, and 4-page integration all exist — but its first clause ("thumbnails in record lists (lazy)") is **NOT implemented**: no list table renders a thumbnail column, and the `ce-photo` component's lazy-load is browser-decode-lazy only, not fetch-lazy.

**Primary recommendation:** Plan ONLY the PCAP-02 list-thumbnail gap (wire a lazy thumbnail column into the residents/visits/vehicles/service-providers list tables), plus a small Nyquist-validation closeout (list-endpoint integration test + list-thumbnail E2E), plus optional dead-code cleanup of the now-redundant `PhotoBindingCacheService` and the never-invoked `generateThumbnail`. Do **not** rebuild `ce-photo-capture`, the compression ladder, retry, or the lightbox — they work and are tested.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera capture (`getUserMedia`) | Browser / Client | — | `navigator.mediaDevices` exists only in the browser; no server involvement |
| Compression ladder + EXIF strip (canvas redraw) | Browser / Client | — | Deferred-idea constraint: all image processing is client-side, no server-side compression/EXIF |
| Thumbnail generation | Browser / Client | — | `generateThumbnail` is client-side; backend `ThumbnailPath` remains null (deferred server thumbnailing) |
| Upload with retry/backoff | Browser / Client | API / Backend (receiver) | Retry logic is client-side; backend `POST /api/v1/photos` is the target |
| Photo persistence & soft-delete | API / Backend | Database / Storage | `Photos` module + `IStorageProvider` + MySQL `Photos` table |
| Photo list/retrieve (auth'd) | API / Backend | Browser (object-URL render) | `GET /api/v1/photos/{id}` returns blob; `ce-photo` fetches via authenticated HttpClient (bearer can't ride a plain `<img src>`) |
| Lightbox / gallery UI state | Browser / Client | — | `ce-photo-lightbox` / `ce-photo-gallery` signals-only components |
| List-table lazy thumbnails | Browser / Client | API / Backend | **GAP** — no list column exists; if added, `ce-photo` must be extended for true fetch-laziness (IntersectionObserver) |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **PCAP-01 — `ce-photo-capture` component**: Camera mode (`getUserMedia`) + file-picker mode. Client-side compression ladder: resize longest dimension ≤1280px → `canvas.toBlob('image/jpeg', 0.8)` → size check → retry 0.6 if >500KB → floor 0.3. EXIF strip via canvas redraw (no GPS/camera-model/timestamp survives). 128×128 thumbnail generated client-side.
- **PCAP-02 — Photo display integration**: Thumbnails in record lists (lazy), source in detail view, click-to-enlarge lightbox. Integrated across resident / visitor / vehicle / service-provider record pages.
- **PCAP-03 — Upload resilience**: 3 attempts with 1s/2s/4s backoff. Clear error states: camera-denied, file-too-large, retries-exhausted. File-type validation: `image/jpeg`, `image/png`, `image/heic`.

### the agent's Discretion

- Whether v2.0 shipped `ce-photo-capture`/`ce-photo-gallery`/`ce-photo-lightbox` components are reused as-is, extended, or re-aligned to the v2.0 PHOTO-02 spec. Research must verify current state before planning — do not rebuild what already works.

### Deferred Ideas (OUT OF SCOPE)

- Server-side image processing (compression/thumbnailing/EXIF) — client-side only.
- AI facial recognition, ALPR, video storage.
- Hardware camera integration / NVR.
- Biometrics.

<phase_requirements>
## Phase Requirements

| ID | Description | Status vs. Current State | Research Support |
|----|-------------|--------------------------|------------------|
| PCAP-01 | `ce-photo-capture` component: camera mode + file-picker, compression ladder (≤1280px, 0.8→0.6→0.3), EXIF strip via canvas redraw | **ALREADY MET** — fully implemented + unit-tested + E2E-tested | `photo-capture.component.ts` (getUserMedia + drag/drop + `captureFrame`), `photo-utils.ts` (`compressImage` 0.8→0.6→0.3, `FILE_TOO_LARGE_AFTER_COMPRESSION`), `photo-capture.component.spec.ts` (9 tests), `photo-capture.spec.ts` EXIF test via `exifr` |
| PCAP-02 | Photo display: lazy thumbnails in lists, source in detail, click-to-enlarge lightbox, integrated across 4 record pages | **PARTIALLY MET** — lightbox ✅, source-in-detail ✅, 4-page integration ✅; **lazy list thumbnails ❌ GAP** | `ce-photo-lightbox.component.ts`, `ce-photo-gallery.component.ts`, `ce-photo-panel` wired into residents/visits/vehicles/service-providers pages; NO list table renders a thumbnail column; `ce-photo` fetch is eager (not fetch-lazy) |
| PCAP-03 | Upload resilience: 3 attempts 1s/2s/4s backoff; error states camera-denied/file-too-large/retries-exhausted; type validation jpeg/png/heic | **ALREADY MET** — implemented + unit-tested + E2E-tested | `photo-utils.ts` (`uploadWithRetry`, `DEFAULT_RETRY` [1000,2000,4000], `isTransientUploadError`), `photo-capture.component.ts` (`acceptFile` 8MB reject + `isValidType` + toast paths), `photo-capture.component.spec.ts` (9 tests), E2E retry test (503→503→success) |
</phase_requirements>

## Project Constraints (from AGENTS.md)

Binding directives the planner must not violate (extracted from `./AGENTS.md` and `.opencode/rules/local-ci-verification.md`):

1. **Platform-aware command execution (Constitution Principle VIII).** Detect host OS/shell before any terminal command; no POSIX-only syntax on a Windows host; prefer `docker compose` (platform-neutral). This host is Linux/bash (verified).
2. **Mandatory Local CI Verification Gate.** Per-turn `scripts/verify-ci-local.sh --fast` (format + Release build + unit/architecture tests, zero Docker downloads) and task-completion `scripts/verify-ci-local.sh` full 6-stage suite. No task checkbox `[X]` until full gate passes.
3. **Angular conventions:** standalone components (`standalone: true`), `OnPush`, signals, `ce-` prefix, kebab-case selectors, TypeScript strict, Prettier single-quotes 120 cols, ESLint `@angular-eslint/recommended`. No shared domain models between FE/BE (DTOs via `ng-openapi-gen`).
4. **Data access:** DBTools 1.4.3 only — **no EF Core**; all tenant-scoped reads/writes via `ITenantAwareLinqFactory`; no MediatR; no MVC controllers (minimal API endpoints only).
5. **Error handling:** `ProblemDetails` (RFC 7807) everywhere; domain exceptions `NotFoundException`/`ValidationException`/`ConflictException`.
6. **Synthetic test data only** — never copy real document numbers/names/photos into tests/snapshots/seeders.
7. **Secrets never in `App.config`** — env vars or Docker secrets only.
8. **No new external packages expected** for this phase (camera is browser-native `getUserMedia`). The one existing external dep, `exifr ^7.1.3`, is a devDependency used only by the E2E EXIF assertion.
9. **Git worktree rule:** all work in a worktree (this one is `.worktrees/version2.2` on branch `version/2.2`); never merge on `main`.

## Standard Stack

No new libraries are required — this phase reuses the already-shipped component set. The "stack" is the existing Angular 18 + Signals + OnPush design-system surface.

### Core (already shipped, reuse as-is)
| Library / Asset | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| Angular 18.2 standalone + Signals | 18.2 | Component state, `effect`/`computed`/`signal` | Project convention (AGENTS.md); already in use by all photo components |
| `ce-photo-capture` | shipped | Camera (`getUserMedia`) + file-picker + compression ladder + retry | Verified working; 9 unit tests + 2 E2E tests |
| `ce-photo` / `ce-photo-gallery` / `ce-photo-lightbox` / `ce-photo-panel` | shipped | Display, gallery, lightbox, entity wrapper | Verified working; 31 unit tests |
| `photo-utils.ts` (`compressImage`, `generateThumbnail`, `uploadWithRetry`) | shipped | Compression ladder, thumbnail, retry/backoff | Verified working; 9 unit tests |
| `PhotosApiService` (handwritten) + `photos.service.ts` (OpenAPI gen) | shipped | Upload/list/get/delete HTTP | Handwritten service is the v2 pattern; generated client mirrors endpoints |
| `exifr` ^7.1.3 (devDependency) | 7.1.3 | E2E EXIF-strip assertion | Already in `package.json`; `[VERIFIED: npm registry]` OK (1.39M weekly downloads, GitHub `MikeKovarik/exifr`, no postinstall) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ce-table` + custom cell renderers | shipped | Host a thumbnail column | When wiring the PCAP-02 list-thumbnail gap |
| `IntersectionObserver` (browser API, no package) | native | True fetch-lazy thumbnails | When extending `ce-photo` to defer the authenticated fetch until near-viewport (see GAP below) |
| `ce-spinner` / `ce-toast` | shipped | Loading + error surfaces | Already used by capture/panel |

**Installation:** none required. `npm install` only if `package-lock.json` is touched (no new packages expected).

**Version verification:** `exifr` is the only photo-related external package; already pinned at `^7.1.3` in `package.json` (devDependency). `[VERIFIED: npm registry]` — published 2021-08-05, 1,389,566 weekly downloads, not deprecated. No new packages to verify.

## Package Legitimacy Audit

Only one external package is in play, and it is an **existing** devDependency (not newly added by this phase).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| exifr | npm | ~5 yrs (published 2021-08-05) | 1.39M/wk | github.com/MikeKovarik/exifr | [OK] | Already present (devDependency); no action |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No new packages are introduced by this phase. `exifr` was already validated and is used only by the E2E EXIF-strip assertion.*

## Architecture Patterns

### System Architecture Diagram (photo capture → display)

```
                      ┌─────────────────────────────────────────────┐
                      │  Browser (Angular 18 SPA, client-side only)  │
                      │                                             │
  getUserMedia ──────►│  ce-photo-capture                            │
  (camera)            │    │  captureFrame() → canvas.toBlob(jpeg)   │
                      │    ▼                                         │
  file picker /       │  compressImage() ── 0.8 → 0.6 → 0.3 ladder   │
  drag-drop ─────────►│    │  (canvas redraw = EXIF strip)           │
                      │    ▼                                         │
                      │  generateThumbnail() [dead — never invoked]  │
                      │    │                                         │
                      │    ▼                                         │
                      │  uploadWithRetry(3×, 1s/2s/4s)              │
                      │    └── POST /api/v1/photos (multipart)       │
                      └──────────────────┬──────────────────────────┘
                                         ▼
                      ┌─────────────────────────────────────────────┐
                      │  API (ASP.NET Core 8, Photos module)         │
                      │   POST /api/v1/photos   (Photos.Write)        │
                      │   GET  /api/v1/photos/{id} (Photos.Read)      │
                      │   GET  /api/v1/photos?entityType&entityId     │
                      │   DELETE /api/v1/photos/{id} (Photos.Delete)  │
                      │   → IStorageProvider.SaveAsync / OpenReadAsync│
                      └──────────────────┬──────────────────────────┘
                                         ▼
                      ┌─────────────────────────────────────────────┐
                      │  Storage (local FS or S3/MinIO) + MySQL       │
                      │  Photos table: Id, TenantId, FilePath,       │
                      │  ThumbnailPath (NULL), EntityType, EntityId,  │
                      │  CreatedAtUtc, DeletedAtUtc (soft delete)     │
                      └─────────────────────────────────────────────┘
                                         │
                      ┌─────────────────▼───────────────────────────┐
                      │  Browser (display)                            │
                      │  ce-photo-panel → ce-photo-gallery           │
                      │     → ce-photo (auth'd GET → object URL)      │
                      │     → ce-photo-lightbox (source, prev/next)   │
                      │  [GAP] list tables have NO thumbnail column   │
                      └─────────────────────────────────────────────┘
```

### Recommended Project Structure (existing — no new folders)

```
src/Web/ControlEasyReborn.Web/src/app/
├── design-system/components/photo/     # ce-photo, ce-photo-capture, ce-photo-gallery, ce-photo-lightbox, ce-photo-panel (+ *.spec.ts)
├── features/photos/                    # photo-utils.ts, photos-api.service.ts, photo-binding-cache.service.ts, photo-utils.spec.ts
├── features/{residents,visits,vehicles,service-providers}/   # entity pages already host ce-photo-panel
└── api/services/photos.service.ts      # generated OpenAPI client (mirrors endpoints)
src/Modules/Photos/                     # backend: Domain/Application/Infrastructure/Api (Photos, PhotoRepository, handlers, endpoints)
docker/mysql/init/09a-photos-schema.sql # Photos table (EntityType/EntityId columns already present)
tests/ControlEasyReborn.IntegrationTests/PhotoEndpointTests.cs   # upload/get/delete/cross-tenant/permissions (NO list test yet)
tests/ControlEasyReborn.UnitTests/Modules/Photos/               # UploadPhotoHandler, PhotoLifecycle, PhotoRepository, LocalStorageProvider
```

### Pattern 1: Standalone OnPush signals component (existing convention)
All photo components are `standalone: true`, `changeDetection: OnPush`, signals-only. `ce-photo-panel` uses an `effect` with `{ allowSignalWrites: true }` and `untracked()` to avoid re-trigger loops — this pattern caused two prior Karma/Chrome disconnects (`43406e2`, `b2af479`) and is the reference for any panel/list-thumbnail wiring.

### Pattern 2: Authenticated image fetch (not plain `<img src>`)
`ce-photo` fetches the blob through `PhotosApiService.get(id)` (which carries the JWT via `HttpClient` interceptor) and renders an `objectURL`. A plain `<img src="/api/v1/photos/{id}">` would NOT carry the bearer token. Any list-thumbnail implementation **must** reuse `ce-photo`, not raw `<img>` tags. `[VERIFIED: codebase inspection — photo.component.ts constructor effect]`

### Pattern 3: Compression ladder + EXIF strip (client-side)
`compressImage` loads the blob → draws to offscreen canvas at ≤1280px (canvas redraw inherently strips EXIF) → `canvas.toBlob('image/jpeg', 0.8)` → 0.6 → 0.3 → throws `FILE_TOO_LARGE_AFTER_COMPRESSION`. `[VERIFIED: codebase inspection — photo-utils.ts]`

### Anti-Patterns to Avoid
- **Raw `<img src>` for protected photos:** bypasses JWT auth — the image would 401/403. Use `ce-photo`.
- **Re-implementing the compression ladder or retry:** already shipped and tested; duplicating it creates drift.
- **Eager-fetching N full source blobs in a list:** the backend has no `/thumbnail` route, so each `ce-photo` fetches the full source; a 50-row list would be ~99% wasted bandwidth. Fetch-laziness must be a real IntersectionObserver deferral, not the browser `loading="lazy"` decode hint.
- **Writing to `localStorage` binding cache for new code:** `PhotoBindingCacheService` is a v2.0 shim made redundant by the backend `list` endpoint; new code should rely on `photosApi.list()` (which `ce-photo-panel` already calls authoritatively).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera capture | Custom `navigator.mediaDevices` wrapper | `ce-photo-capture` (existing) | Already handles permission-denied fallback, `getUserMedia`, frame capture |
| Image compression | Hand-written resize/encode | `compressImage` in `photo-utils.ts` | Quality ladder + EXIF strip via canvas redraw, already unit-tested |
| Upload retry | Hand-rolled retry loop | `uploadWithRetry` + `isTransientUploadError` | 3× 1s/2s/4s backoff, transient-vs-terminal classification |
| EXIF stripping | Manual EXIF parsing/rewrite | Canvas redraw (already in `compressImage`) | `canvas.toBlob` emits no EXIF header |
| Lightbox/gallery | Custom overlay viewer | `ce-photo-gallery` + `ce-photo-lightbox` | prev/next/Esc/backdrop/delete, already tested |
| Lazy thumbnails | `loading="lazy"` attribute only | IntersectionObserver-based deferred fetch in `ce-photo` | `loading="lazy"` defers decode, not the authenticated HTTP fetch |

**Key insight:** The only genuinely "deceptively complex" sub-problem still open is *true* lazy-loading of authenticated thumbnails (defer the fetch, not just the decode). Everything else is already solved in-repo and must not be re-implemented.

## Runtime State Inventory

*Not a rename/refactor/migration phase — this section is omitted.* (Greenfield-closeout: no stored data, OS state, secrets, or build artifacts carry a renamed identifier. The one relevant "state" artifact — `PhotoBindingCacheService` `localStorage` key `ce.photoBindings.v1` — is a candidate for removal, not a rename.)

## Common Pitfalls

### Pitfall 1: Assuming `loading="lazy"` makes thumbnails cheap
**What goes wrong:** A planner/implementer adds `<ce-photo loading="lazy">` to list rows believing it defers the network fetch. It does not — `ce-photo`'s `effect` fires `photosApi.get(id)` eagerly on init; `loading="lazy"` only defers the browser's decode of the already-fetched blob.
**Why it happens:** Confusing browser-native image lazy decode with application-level fetch laziness.
**How to avoid:** If "lazy" is required (PCAP-02 wording), extend `ce-photo` with an `IntersectionObserver` gate that subscribes to `photosApi.get(id)` only when the host element nears the viewport.
**Warning signs:** Network panel shows 50 `GET /api/v1/photos/*` calls on list render.

### Pitfall 2: Rebuilding shipped components to "align to PHOTO-02"
**What goes wrong:** Treating PCAP-01/03 as open work and re-implementing capture/retry, risking regression of the 247-test green suite.
**Why it happens:** The phase title ("Photo Capture & Display UI") reads like a build phase, not a closeout.
**How to avoid:** Plan only the verified gaps (PCAP-02 list thumbnails + validation closeout). Capture, compression, retry, error states, lightbox are done.
**Warning signs:** Plan tasks that rewrite `photo-utils.ts` or `photo-capture.component.ts`.

### Pitfall 3: Raw `<img>` for protected photos
**What goes wrong:** Using `<img [src]="'/api/v1/photos/' + id">` — the SPA bearer token isn't attached, so the request is unauthenticated (401/403) or, worse, leaks a blob URL without tenant scoping.
**Why it happens:** The pattern is intuitive; the auth nuance is subtle.
**How to avoid:** Always render via `ce-photo` (authenticated HttpClient + object URL). This is already the established pattern.
**Warning signs:** `img[src*="/api/v1/photos"]` appearing in list templates.

### Pitfall 4: Dead `generateThumbnail` / stale `PhotoBindingCacheService`
**What goes wrong:** Leaving `generateThumbnail` (never invoked in the upload path) and the localStorage binding cache (superseded by the backend `list` endpoint) in place creates confusion about the real data flow.
**Why it happens:** Both are v2.0 forward-compatible shims that the backend later made redundant (entity columns + list endpoint now exist).
**How to avoid:** Either (a) wire `generateThumbnail` to a real `/thumbnail` backend route (out of scope — server-side processing is deferred), or (b) delete the dead code and rely on `photosApi.list()`. Flag as an optional cleanup task.
**Warning signs:** `grep generateThumbnail` shows only spec references; `PhotoBindingCacheService` used only as offline fallback in `ce-photo-panel`.

## Code Examples

### Existing upload pipeline (reference, do not rebuild)
```typescript
// Source: src/Web/ControlEasyReborn.Web/src/app/features/photos/photo-utils.ts (verified)
export const DEFAULT_RETRY: RetryOptions = { maxAttempts: 3, delays: [1000, 2000, 4000] };

const photo = await uploadWithRetry(
  () => this.photosApi.upload(compressed, this.fileName(), {
    entityType: this.entityType(), entityId: this.entityId(),
    capturedAtUtc: new Date().toISOString(),
  }),
  DEFAULT_RETRY,
  isTransientUploadError,   // retries only 0/408/429/5xx
);
```

### Authenticated photo render (reference for list-thumbnail wiring)
```typescript
// Source: src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo.component.ts (verified)
effect((onCleanup) => {
  const subscription = this.photosApi.get(this.photoId()).subscribe({
    next: (blob) => {
      this.objectUrl = URL.createObjectURL(blob);
      this.sourceUrl.set(this.objectUrl);
      this.loading.set(false);
    },
    error: () => { this.error.set(true); },
  });
  onCleanup(() => { subscription.unsubscribe(); this.releaseObjectUrl(); });
}, { allowSignalWrites: true });
```

### List-thumbnail gap (target shape — do not hand-roll the fetch; reuse `ce-photo`)
```typescript
// Target: add a thumbnail column to the residents/visits/vehicles/service-providers tables.
// Each row's first (most recent) photo is fetched via ce-photo; true laziness needs an
// IntersectionObserver gate inside ce-photo (see Pitfall 1). Sketch only — implementer
// must follow existing ce-table custom-cell pattern.
@for (photo of rowPhotos(item); track photo.id) {
  <ce-photo [photoId]="photo.id" size="thumbnail" [clickable]="true" (photoClicked)="openLightbox(item)" />
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `PhotoBindingCacheService` (localStorage) as the *only* entity-binding store | Backend `Photos` table has `EntityType`/`EntityId` columns + `GET /api/v1/photos?entityType&entityId` list endpoint; `ce-photo-panel` calls `photosApi.list()` authoritatively, cache is offline fallback only | v2.0 Phase 12 → later backend work (visible in current `PhotoRepository`, `PhotosEndpoints`, `09a-photos-schema.sql`) | Cache is now redundant; list persistence is server-side (cross-device) |
| `ce-photo` renders source blob + CSS `object-fit: cover` (no `/thumbnail` route) | Unchanged — no `/thumbnail` route still | — | List thumbnails would fetch full source blobs (~99% bandwidth waste); a real thumbnail route remains deferred |
| Phase 12 deviation "no list endpoint" | List endpoint now exists (`MapGet("/")` → `ListPhotosHandler`) | post-v2.0 | Closes one v2.0 deviation; the other (thumbnail route) remains open |

**Deprecated/outdated:**
- `PhotoBindingCacheService` — superseded by the backend list endpoint; keep only as offline fallback or remove.
- `generateThumbnail` — never invoked in the production upload path (only referenced in `photo-utils.spec.ts`); dead code until a `/thumbnail` backend route ships.
- `PhotosApiService.list()` passes `skip`/`take`, but `ListPhotosHandler` ignores them (no pagination) — harmless but misleading; note if touched.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HEIC input is "accepted then converted to JPEG" by canvas redraw; browser canvas cannot natively decode HEIC on all platforms, so a real HEIC file may fail `loadImage`/`decode` before compression | PCAP-03 | LOW — HEIC handling is browser-dependent; the frontend accepts HEIC at the picker but the compression path always emits JPEG. If HEIC capture is a hard requirement, it needs a dedicated decoder (e.g., `heic2any`) — currently out of scope. |
| A2 | `getUserMedia` with `facingMode: 'environment'` is the intended camera source and no `imageCapture`/`MediaStreamTrack` still-frame API is required | PCAP-01 | LOW — current `captureFrame` draws the live `<video>` to canvas; acceptable per shipped E2E. |
| A3 | "Lazy" in PCAP-02 means "defer the authenticated fetch until near-viewport," not merely the browser decode hint | PCAP-02 | MEDIUM — if the product owner accepts decode-lazy only, the gap shrinks to "add a thumbnail column" with no IntersectionObserver work. Needs user confirmation. |

**If this table is empty:** N/A — three assumptions logged above.

## Open Questions (RESOLVED)

1. **Does "lazy thumbnails in lists" require true fetch-laziness, or is eager-fetch-with-decode-lazy acceptable?**
   - What we know: no list thumbnail column exists; `ce-photo` fetches eagerly (only decode is lazy via `loading="lazy"`).
   - What's unclear: the performance bar — a 50-row list × full source blob fetch is the cost of the "cheap" path.
   - Recommendation: ask the user; default to IntersectionObserver-based fetch-laziness in `ce-photo` to honor the word "lazy" and avoid bandwidth waste.
   - **RESOLVED:** True fetch-laziness via IntersectionObserver gate in `ce-photo` (Assumption A3). Implemented by plan 21-01 (add `lazy` input to `CePhotoComponent` + `CePhotoThumbComponent`), wired into lists by plan 21-02, E2E-verified by plan 21-03 Task 2.

2. **Should the now-redundant `PhotoBindingCacheService` + dead `generateThumbnail` be removed in this phase?**
   - What we know: both are v2.0 shims; the backend list endpoint makes the cache non-authoritative; `generateThumbnail` is unreferenced in production code.
   - What's unclear: whether removal is in-scope for a UI closeout, or belongs to a backend-thumbnail phase.
   - Recommendation: scope as an optional cleanup task (low risk, improves clarity); do not block the main gap on it.
   - **RESOLVED:** Committed cleanup. Plan 21-03 Task 3 removes `PhotoBindingCacheService` and `generateThumbnail`, refactoring `ce-photo-panel` to a single authoritative `photosApi.list()` source (closes threat T-21-07).

3. **Is server-side thumbnailing (a real `/api/v1/photos/{id}/thumbnail` route) wanted to make list thumbnails cheap?**
   - What we know: explicitly deferred in CONTEXT.md ("Server-side image processing" deferred) and the spec's Out of Scope.
   - What's unclear: whether the list-thumbnail feature can ship acceptably without it.
   - Recommendation: treat as out of scope; ship list thumbnails client-side with fetch-laziness, and note the bandwidth caveat for a future backend phase.
   - **RESOLVED:** Out of scope (deferred). List thumbnails ship client-side with fetch-laziness; a server-side `/thumbnail` route remains a deferred future-backend item (CONTEXT.md Deferred Ideas).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Angular build/test | ✓ | v22.22.1 | — (project pins Node 20 in Docker; 22 works locally) |
| npm | install/scripts | ✓ | 10.9.4 | — |
| Docker | full-stack + CI gate | ✓ | 29.8.1 | — |
| .NET SDK | backend build/test | ✓ | 8.0.131 (host) | SDK 8.0 also available via Docker image |
| Chrome/Chromium | Karma + Playwright | ✓ | (via Playwright install) | `npm run e2e:install` |
| Camera (`getUserMedia`) | PCAP-01 capture | n/a (browser runtime) | — | E2E mocks via `canvas.captureStream` + `addInitScript` |
| `exifr` (devDep) | E2E EXIF assertion | ✓ (package.json) | ^7.1.3 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

*Step 2.6 note: no new external tools or packages are introduced. Existing stack is present and verified.*

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jasmine 5.2 + Karma 6.4 (unit) · Playwright 1.49 (E2E) · xUnit 2.9 (backend) |
| Config file | `src/Web/ControlEasyReborn.Web/angular.json` (test target) · `playwright.config.ts` (testMatch `e2e/**/*.spec.ts`, `tests/**/*.spec.ts`) |
| Quick run command | `npx ng test --no-watch --browsers=ChromeHeadless` (Angular) |
| Full suite command | `scripts/verify-ci-local.sh` (6-stage: format, build, unit+arch, Testcontainers MySQL integration, Angular Docker build, OpenAPI drift) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PCAP-01 (camera) | `getUserMedia` capture → success toast | E2E | `npx playwright test e2e/photo-capture.spec.ts` | ✅ |
| PCAP-01 (compression ladder) | 0.8→0.6→0.3 + `FILE_TOO_LARGE_AFTER_COMPRESSION` | unit | `npx ng test --include='**/photo-utils.spec.ts'` | ✅ |
| PCAP-01 (EXIF strip) | no GPS/Make/Model/DateTimeOriginal after upload | E2E (exifr) | `npx playwright test e2e/photo-capture.spec.ts -g "EXIF"` | ✅ |
| PCAP-02 (lightbox) | open/close/prev/next/delete | unit + E2E | `npx ng test --include='**/photo-lightbox.component.spec.ts'` | ✅ |
| PCAP-02 (4-page integration) | panel on residents/visits/vehicles/service-providers | E2E | `npx playwright test e2e/photo-capture.spec.ts -g "four entity"` | ✅ |
| PCAP-02 (lazy list thumbnails) | thumbnail column in each list table, fetch deferred until near-viewport | unit (ce-photo lazy gate) + E2E | *to be added — Wave 0* | ❌ |
| PCAP-03 (retry/backoff) | 503→503→success, 3 attempts | unit + E2E | `npx ng test --include='**/photo-capture.component.spec.ts'` · E2E retry test | ✅ |
| PCAP-03 (error states) | camera-denied / file-too-large / retries-exhausted toasts | unit | `npx ng test --include='**/photo-capture.component.spec.ts'` | ✅ |
| Backend list endpoint | `GET /api/v1/photos?entityType&entityId` returns bound photos | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter PhotoEndpointTests` | ❌ (no list test) |

### Sampling Rate
- **Per task commit:** `scripts/verify-ci-local.sh --fast`
- **Per wave merge:** `scripts/verify-ci-local.sh` (full)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/ControlEasyReborn.IntegrationTests/PhotoEndpointTests.cs` — add `List_ByEntity_ReturnsOnlyMatchingPhotos` (and a cross-tenant list case) — currently only upload/get/delete/permission tests exist.
- [ ] `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo.component.spec.ts` — add lazy-fetch (IntersectionObserver) tests if PCAP-02 lazy is implemented.
- [ ] `e2e/photo-capture.spec.ts` — add a "list rows render a lazy thumbnail" test (or a new `e2e/photo-list-thumbnails.spec.ts`) once the column is wired.
- [ ] Framework install: none needed (Karma + Playwright already configured).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT bearer (`JwtBearer`); photo GET is behind `Permission_Photos.Read` |
| V3 Session Management | yes | Bearer token via HttpClient interceptor (photos are fetched by authenticated client, not raw `<img>`) |
| V4 Access Control | yes | `Photos.Read`/`Photos.Write`/`Photos.Delete` permission claims + `ITenantAwareLinqFactory` tenant scoping (cross-tenant GET/DELETE returns 404, verified by `CrossTenant_Photo_...` integration test) |
| V5 Input Validation | yes | Client: `isValidType` (jpeg/png/heic/heif/webp) + 8MB cap; Server: `UploadPhotoMetadataValidator` (mime allow-list jpeg/png/webp, entity-type allow-list, entityId length ≤100) + `PhotosEndpoints` 8MB size gate (413) |
| V6 Cryptography | n/a (no crypto in photo path) | — (EXIF GPS/make/model strip is privacy, handled client-side via canvas redraw) |

### Known Threat Patterns for Angular + ASP.NET Photos
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant photo read/delete (guess another tenant's `{id}`) | Information Disclosure / Elevation | `ITenantAwareLinqFactory` scoping + `CrossTenant_Photo_CannotBeAccessedByDifferentTenant` test (verified) |
| Oversized upload / DoS | DoS | Client 8MB cap + server `MaxUploadSizeBytes` 413 (verified in `PhotosEndpoints`) |
| Unsupported MIME / polyglot upload | Tampering | Server `UploadPhotoMetadataValidator` mime allow-list → 415/validation (verified) |
| EXIF metadata leak (GPS/camera-model/timestamp) | Information Disclosure | Client-side canvas redraw strips EXIF; E2E asserts absence via `exifr` (verified) |
| Unauthenticated blob retrieval | Spoofing | `RequireAuthorization("Permission_Photos.Read")` on `GET`; UI uses `ce-photo` (verified) |
| Broken access on delete | Tampering | `RequireAuthorization("Permission_Photos.Delete")` + soft-delete (verified) |

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-capture.component.ts` — camera + file-picker + compression + retry + error states
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/{photo,photo-gallery,photo-lightbox,photo-panel}.component.ts` — display/gallery/lightbox/panel
- `src/Web/ControlEasyReborn.Web/src/app/features/photos/{photo-utils,photos-api,photo-binding-cache}.service.ts` — compression ladder, retry, API client, binding cache
- `src/Web/ControlEasyReborn.Web/src/app/features/{residents,visits,vehicles,service-providers}/*.page.ts` — entity-page integration (all four host `ce-photo-panel`; none render a list thumbnail column)
- `src/Modules/Photos/**` — `PhotosEndpoints.cs`, `UploadPhotoHandler.cs`, `ListPhotosHandler.cs`, `PhotoLifecycleHandlers.cs`, `PhotoRepository.cs`, `UploadPhotoMetadataValidator.cs`, `Photo.cs`, `PhotoDtos.cs`
- `docker/mysql/init/09a-photos-schema.sql` — `Photos` table with `EntityType`/`EntityId` columns (entity binding is NOT missing as v2.0 assumed)
- `src/Web/ControlEasyReborn.Web/e2e/photo-capture.spec.ts` — 5 E2E tests (camera/EXIF/retry/lightbox/4-entity)
- `tests/ControlEasyReborn.IntegrationTests/PhotoEndpointTests.cs` — upload/get/delete/cross-tenant/permission tests (no list test)
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/*.spec.ts` + `photo-utils.spec.ts` — 44 component/util tests

### Secondary (MEDIUM confidence — v2.0 evidence cross-checked against source)
- `.planning/milestones/v2.0-phases/12-photo-capture-display/12-VERIFICATION.md` — PHOTO-02 passed with 2 deviations (no thumbnail route, no list endpoint)
- `.planning/milestones/v2.0-phases/12-photo-capture-display/12-01-SUMMARY.md` — 13 commits, 247 Angular tests, 5 Playwright tests, deviations table
- `.planning/milestones/v2.0-phases/12-photo-capture-display/12-CONTEXT.md` — v2.0 design intent
- `.planning/codebase/{STACK,STRUCTURE,TESTING}.md` — stack/test conventions

### Tertiary (LOW confidence — training knowledge, not verified this session)
- HEIC canvas-decode browser support matrix (Assumption A1)
- `getUserMedia` `facingMode: 'environment'` device-selection semantics (Assumption A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing components verified by direct read.
- Architecture: HIGH — current state (what exists vs gap) verified by grep/read across FE + BE + schema + tests.
- Pitfalls: HIGH — grounded in actual code (eager-fetch `effect`, dead `generateThumbnail`, redundant cache).
- Assumptions (HEIC/lazy semantics): MEDIUM/LOW — flagged in Assumptions Log for user confirmation.

**Research date:** 2026-09-24
**Valid until:** 2026-10-24 (30 days; stable Angular 18 stack, no fast-moving deps)
