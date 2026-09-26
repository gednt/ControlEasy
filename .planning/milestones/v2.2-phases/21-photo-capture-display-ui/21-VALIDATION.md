---
phase: 21
slug: photo-capture-display-ui
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-24
verified_at: 2026-09-26
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jasmine 5.2 + Karma 6.4 (unit) · Playwright 1.49 (E2E) · xUnit 2.9 (backend) |
| **Config file** | `src/Web/ControlEasyReborn.Web/angular.json` (test) · `playwright.config.ts` |
| **Quick run command** | `npx ng test --no-watch --browsers=ChromeHeadless` |
| **Full suite command** | `scripts/verify-ci-local.sh` (6-stage) |
| **Estimated runtime** | ~30 s (unit) / ~5 min (full) |

---

## Sampling Rate

- **After every task commit:** Run `scripts/verify-ci-local.sh --fast`
- **After every plan wave:** Run `scripts/verify-ci-local.sh` (full)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | PCAP-02 (lazy fetch) | T-21-02 | `ce-photo` defers authenticated blob fetch until near-viewport when `lazy=true` | unit | `npx ng test --include='**/photo.component.spec.ts'` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | PCAP-02 (list thumbs) | T-21-01 | `ce-photo-thumb` resolves entity → most-recent photo lazily via `photosApi.list` | unit | `npx ng test --include='**/photo-thumb.component.spec.ts'` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 2 | PCAP-02 (list thumbs) | T-21-06 | residents/vehicles lists render leading `ce-photo-thumb` cell with exact entityType literal | unit | `npx ng test --include='**/vehicles.page.spec.ts'` | ✅ passing | ⬜ pending |
| 21-02-02 | 02 | 2 | PCAP-02 (list thumbs) | T-21-06 | visits/service-providers lists render leading `ce-photo-thumb` cell with exact entityType literal | unit | `npx ng test --include='**/visits.page.spec.ts' --include='**/service-providers.page.spec.ts'` | ✅ passing | ⬜ pending |
| 21-03-01 | 03 | 3 | PCAP-02 (list endpoint) | T-21-01 | `GET /api/v1/photos?entityType&entityId` returns only caller tenant's bound photos; cross-tenant empty | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter PhotoEndpointTests` | ❌ W0 | ⬜ pending |
| 21-03-02 | 03 | 3 | PCAP-02 (list thumbs) | T-21-02 | list row renders a blob-backed thumbnail end-to-end (no raw `<img src>`) | E2E | `npx playwright test e2e/photo-list-thumbnails.spec.ts` | ❌ W0 | ⬜ pending |
| 21-03-03 | 03 | 3 | PCAP-01/03 (regression) | T-21-07 | dead localStorage cache + `generateThumbnail` removed; `photosApi.list()` sole source | unit | `npx ng test --include='**/photo-panel.component.spec.ts' --include='**/photo-utils.spec.ts'` | ✅ passing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ControlEasyReborn.IntegrationTests/PhotoEndpointTests.cs` — add `List_ByEntity_ReturnsOnlyMatchingPhotos` + cross-tenant list case
- [ ] `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo.component.spec.ts` — lazy-fetch (IntersectionObserver) tests
- [ ] `e2e/photo-capture.spec.ts` (or new `e2e/photo-list-thumbnails.spec.ts`) — "list rows render a lazy thumbnail"
- [ ] Framework install: none needed (Karma + Playwright already configured)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-device camera capture (getUserMedia) | PCAP-01 | Browser camera permission + hardware variance | On a real workstation, open a record page, capture, confirm compressed+stripped upload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
