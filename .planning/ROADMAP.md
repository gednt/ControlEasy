# Roadmap: ControlEasy Reborn

## Milestones

- ✅ **v2.1 — Integrated Visits & Account Operations** — Phases 16-18 (shipped 2026-09-20)
- ✅ **v2.0 — Gatehouse Photo & Consent Ledger** — Phases 11-13 (shipped 2026-09-13)
- ✅ **v1.1 — UI & Dashboard** — Phases 9-10 (shipped 2026-09-12, no GSD artifacts)
- ✅ **v1.0 — Modular Monolith MVP** — Phases 1-8 (shipped 2026-07-13)

## Phases

<details>
<summary>✅ v2.1 Integrated Visits & Account Operations (Phases 16-18) — SHIPPED 2026-09-20</summary>

- [x] Phase 16: Visits Unification Backend (3/3 plans) — completed 2026-09-19
- [x] Phase 17: Gatehouse Panel + Reports Page (3/3 plans) — completed 2026-09-19
- [x] Phase 18: Password Management (3/3 plans) — completed 2026-09-19

Full details: [milestones/v2.1-ROADMAP.md](milestones/v2.1-ROADMAP.md) · [requirements](milestones/v2.1-REQUIREMENTS.md) · [audit](milestones/v2.1-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v2.0 Gatehouse Photo & Consent Ledger (Phases 11-13) — SHIPPED 2026-09-13</summary>

- [x] Phase 11: Photos & Consent Schema Infrastructure (1/1 plan) — completed 2026-08-30
- [x] Phase 12: Photo Capture & Display — shipped via `.specs/photo-capture/`
- [x] Phase 13: Consent Policy & Gatehouse Workflow — backend shipped with Phase 11; UI via `.specs/consent-gatehouse/`

Full details: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) · [requirements](milestones/v2.0-REQUIREMENTS.md) · [audit](milestones/v2.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.1 UI & Dashboard (Phases 9-10) — SHIPPED 2026-09-12</summary>

- [x] Phase 9: UI Parity & Functional Fixes (residents page) — shipped without GSD artifacts
- [x] Phase 10: Dashboard Live Stats & Vehicle Edit — shipped without GSD artifacts

Included in the v1.0 archive (Phase 9 partial + Phase 10 shipped): [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.0 Modular Monolith MVP (Phases 1-8) — SHIPPED 2026-07-13</summary>

- [x] Phases 1-8: modular monolith foundation, strangler pilot, module migrations, design system, demo mode, continuous engineering baseline

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

## Next Milestone

**v2.2 — UI Parity & Operational Closeout** (started 2026-09-22)

**Goal:** Close out every hardware-independent gap — finish the ledger, complete pending UI surfaces (password reset, consent audit review, photo capture), and advance mockup parity — so the platform is feature-complete for software-only operation while Door Integration waits on hardware.

**Sequencing note (worktrees in flight):** This milestone assumes `feat/unified-visits-flow-cleanup` (commit `2979bec`: entry-log write-path retirement, dead dashboard-widget deletion, `gatehouse_only` remnant cleanup, OpenAPI client regeneration) and `fix/gatehouse-direction-persistence` (commit `0fdee5a`: access-control direction persisted in localStorage) land on `main` first. Phases below must NOT re-scope items already fixed on those branches; ledger and consent-audit work in the entry-log area builds on the post-cleanup contract.

- [ ] **Phase 19: Ledger & Reports Polish** - Summary day-bucketing, honest filter vocabulary and search scope, condominium-level package drops, X-Total-Count exposure
- [ ] **Phase 20: Account Operations & Consent Audit UI** - TenantAdmin password-reset surface and consent-audit review with evidence rendering + CSV export
- [ ] **Phase 21: Photo Capture & Display UI** - Browser photo capture (camera/file-picker) with compression, display integration across record pages, resilient uploads
- [ ] **Phase 22: Mockup Parity & Test Closeout** - Mockup parity/functional fixes for high-traffic screens, stale E2E refresh, Nyquist validation coverage

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 19. Ledger & Reports Polish | 0/TBD | Not started | - |
| 20. Account Operations & Consent Audit UI | 0/TBD | Not started | - |
| 21. Photo Capture & Display UI | 0/TBD | Not started | - |
| 22. Mockup Parity & Test Closeout | 0/TBD | Not started | - |

## Phase Details

### Phase 19: Ledger & Reports Polish
**Goal**: The reports surface tells one honest story — the daily summary, status filters, search, pagination, and package-drop entry all match what the unified ledger backend actually serves.
**Depends on**: Nothing within v2.2. External: `feat/unified-visits-flow-cleanup` and `fix/gatehouse-direction-persistence` land on `main` first (entry-log area contract).
**Requirements**: LEDGER-01, LEDGER-02, LEDGER-03, LEDGER-04, LEDGER-05
**Success Criteria** (what must be TRUE):
  1. The daily visit-count summary card agrees with the unified ledger for events near the condominium's day boundary — both bucketed by the tenant day, not raw UTC
  2. Every status-filter option on the ledger maps to a state the backend can actually return; selecting any option shows matching rows or a correct empty state (inert 'Recorded'/'Refused' options gone)
  3. Ledger search returns what its placeholder promises (PackageDescription/SubjectName/Purpose) — placeholder wording and backend `q` scope agree
  4. From the package-drop UI, an admin can register a condominium-level drop (destination apartment omitted) and see it in the ledger alongside apartment-bound drops
  5. Non-same-origin consumers receive the `X-Total-Count` header (exposed via `WithExposedHeaders`) so ledger pagination totals work beyond the SPA origin
**Plans**: TBD
**UI hint**: yes

### Phase 20: Account Operations & Consent Audit UI
**Goal**: Tenant administrators can run credential operations and review consent-audit evidence from their own tenant-reachable screens, without needing a platform-admin login.
**Depends on**: Nothing within v2.2 (backends shipped in v2.0 Phase 11/13 and v2.1 Phase 18). External: cleanup branches land first so audit state vocabulary matches the post-cleanup contract.
**Requirements**: ACCNT-01, ACCNT-02, CONSU-01, CONSU-02, CONSU-03
**Success Criteria** (what must be TRUE):
  1. A TenantAdmin can reset another admin's or porteiro's password directly from the condominium management UI, with no platform-admin step
  2. The reset flow shows delivery feedback (temp password dispatched via SMTP) and the reset user is forced to change password at next login (`MustChangePassword`)
  3. An admin can filter the consent audit by date range, category, entry state, and porteiro, and see only matching rows
  4. Audit rows render state-appropriate evidence: `entered_with_consent` photo thumbnail with lightbox, `entered_override` highlighted with reason + porteiro, `gatehouse_only`/`denied` badges
  5. An admin can export the consent audit as CSV with millisecond-precision `recorded_at` timestamps
**Plans**: TBD
**UI hint**: yes

### Phase 21: Photo Capture & Display UI
**Goal**: Gatehouse staff and admins can capture, view, and enlarge photos for residents, visitors, vehicles, and service providers entirely in the browser, with resilient uploads.
**Depends on**: Nothing within v2.2 (photo storage & API shipped in v2.0 Phase 11, commit `d895c01`).
**Requirements**: PCAP-01, PCAP-02, PCAP-03
**Success Criteria** (what must be TRUE):
  1. From a record page, staff can capture a photo via device camera (`getUserMedia`) or file picker; the stored image is client-side compressed (≤1280px, 0.8→0.6→0.3 ladder) with EXIF metadata stripped
  2. Record lists show lazy photo thumbnails, detail views show the source image, and clicking a photo opens an enlarge lightbox — across resident, visitor, vehicle, and service-provider pages
  3. Uploads retry automatically (3 attempts, 1s/2s/4s backoff) and failures show clear, actionable error states for camera-denied, file-too-large, and retries-exhausted
**Plans**: TBD
**UI hint**: yes

### Phase 22: Mockup Parity & Test Closeout
**Goal**: High-traffic screens visually and functionally match the mockup contract, and the automated test suite reflects the product as actually shipped.
**Depends on**: Phase 19, Phase 20, Phase 21 (E2E refresh and Nyquist validation must cover the final surfaces)
**Requirements**: UI-01, UI-02, TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. The login, dashboard, visits, and vehicles screens visually match the mockup in light and dark themes, continuing the residents-page parity
  2. Login form behavior, toast patterns, and page interactions follow the functional-fixes spec (real error paths, submit spinner, auto-dismissing toasts)
  3. The E2E suite exercises the current gatehouse panel and ledger — no specs testing removed dashboard buttons/tiles; stale specs refreshed or removed
  4. Every v2.2 phase has a `*-VALIDATION.md` (Nyquist validation coverage complete for the milestone)
**Plans**: TBD
**UI hint**: yes

## Future Milestones

- 📋 **v2.3 — Door Integration** (Phases 14, 15 — reserved; renumbered from v2.2 on 2026-09-22; gated on real condominium hardware)
- 📋 Multi-arch Docker/CI (fast-cycle, no milestone)