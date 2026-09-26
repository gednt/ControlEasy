# Phase 21: Photo Capture & Display UI — Context

**Gathered:** 2026-09-24
**Status:** Ready for planning
**Source:** Party-mode planning session + v2.2 requirements + `.specs/photo-capture/` (PHOTO-02)

<domain>
## Phase Boundary

Gatehouse staff and admins can capture, view, and enlarge photos for residents, visitors, vehicles, and service providers entirely in the browser, with resilient uploads. Backend storage & API already shipped in v2.0 Phase 11 (commit `d895c01`). This phase delivers the browser capture + display integration (renamed PCAP-01..03 to avoid colliding with validated v2.0 PHOTO-01 storage requirement).

All image processing is client-side (no server-side compression/thumbnailing/EXIF). The camera is the browser's (`getUserMedia`).
</domain>

<decisions>
## Implementation Decisions

### PCAP-01 — ce-photo-capture component
- Camera mode (`getUserMedia`) + file-picker mode.
- Client-side compression ladder: resize longest dimension ≤1280px → `canvas.toBlob('image/jpeg', 0.8)` → size check → retry 0.6 if >500KB → floor 0.3.
- EXIF strip via canvas redraw (no GPS/camera-model/timestamp survives).
- 128×128 thumbnail generated client-side.

### PCAP-02 — Photo display integration
- Thumbnails in record lists (lazy), source in detail view, click-to-enlarge lightbox.
- Integrated across resident / visitor / vehicle / service-provider record pages.

### PCAP-03 — Upload resilience
- 3 attempts with 1s/2s/4s backoff.
- Clear error states: camera-denied, file-too-large, retries-exhausted.
- File-type validation: `image/jpeg`, `image/png`, `image/heic`.

### the agent's Discretion
- Whether v2.0 shipped `ce-photo-capture`/`ce-photo-gallery`/`ce-photo-lightbox` components (`.planning/codebase` + `src/Web/.../design-system/components/photo/` shows they exist) are reused as-is, extended, or re-aligned to the v2.0 PHOTO-02 spec. Research must verify current state before planning — do not rebuild what already works.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (verify current state during research)
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/` — `photo-capture.component.ts`, `photo-gallery.component.ts`, `photo.component.ts`, `photo-lightbox.component.ts`, `photo-panel.component.ts` (already present).
- `src/Web/ControlEasyReborn.Web/src/app/features/photos/` — `photo-utils.ts` (compressImage 0.8→0.6→0.3 ladder, generateThumbnail, uploadWithRetry 3× backoff), `photos-api.service.ts`, `photo-binding-cache.service.ts`.
- `src/Web/ControlEasyReborn.Web/src/app/api/services/photos.service.ts` — generated OpenAPI photos client.
- Backend: `src/Modules/Photos/...` — `POST /api/v1/photos`, `GET /api/v1/photos/{id}`, soft-delete (shipped v2.0 Phase 11).

### Established Patterns
- Client-side only image processing (no server-side compression).
- Angular standalone components, OnPush, signals, `ce-` prefix.
- Playwright E2E + Jasmine/Karma unit tests for photo flows (v2.0 had `photo-capture.spec.ts`, `photo-utils.spec.ts`).

</code_context>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/milestones/v2.2-REQUIREMENTS.md` — PCAP-01/02/03
- `.planning/ROADMAP.md` — Phase 21 goal + success criteria

### Spec
- `.specs/photo-capture/requirements.md` — PHOTO-02 (Browser Capture & Compression) user stories + requirements

### Prior phase evidence
- `.planning/milestones/v2.0-phases/12-photo-capture-display/` (read SUMMARY/VERIFICATION if present) — what v2.0 already shipped

### Source of truth
- `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/TESTING.md`
- `AGENTS.md`

</canonical_refs>

<deferred>
## Deferred Ideas

- Server-side image processing (compression/thumbnailing/EXIF) — client-side only.
- AI facial recognition, ALPR, video storage.
- Hardware camera integration / NVR.
- Biometrics.

</deferred>

---

*Phase: 21-photo-capture-display-ui*
*Context gathered: 2026-09-24 via party-mode planning + v2.2 requirements*
