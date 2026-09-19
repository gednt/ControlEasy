---
phase: 17
reviewed_at: 2026-09-19
status: resolved
depth: standard
files_reviewed: 18
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
---

# Phase 17 Code Review

Reviewed changes for Phase 17: Gatehouse Panel + Reports Page across all frontend components, routing, services, configuration, and unit tests.

## Review Analysis

1. **Gatehouse Panel (`gatehouse-panel.page.ts`)**:
   - Clean tabbed interface composing QR scan, manual lookup, walk-in registration, and open visits list.
   - Synchronizes query parameter `?tab=qr|manual|walkin|visits` while preserving `/gatehouse/qr` and `/gatehouse/manual` route parity.
   - Walk-in form uses `checkInNow: true` for immediate check-in at arrival.
   - Responsive layout aligns with Shift Ledger design tokens.

2. **Camera Orientation (`qr-scan.page.ts`)**:
   - `localStorage` persistence with `CAMERA_FACING_MODE_STORAGE_KEY = 'ce_qr_facing_mode'`.
   - `facingMode` signal and computed `isMirrored` properly handle video transformation and stream constraints.
   - Graceful fallback for non-supported or overconstrained device settings.

3. **Reports Page & CSV Export (`reports.page.ts`)**:
   - Consumes `ReportsService` OpenAPI methods for visit counts by day, residents per apartment, and unified history ledger.
   - Robust date range preset handling (`today`, `7d`, `30d`, `custom`).
   - Server-side filtering by search query (`q`), native status, and carrier code.
   - Millisecond-precision CSV export (`yyyy-MM-dd HH:mm:ss.fff`) with standard RFC 4180 escaping.
   - Dashboard handover link `/reports` properly resolved.

4. **Build & Type Safety (`ng-openapi-gen.json`, `tsconfig.json`)**:
   - Configured `ng-openapi-gen.json` with `"services": true`, `"promises": false` ensuring typed Observable services and generated `BaseService`.
   - Tuned `exactOptionalPropertyTypes: false` in `tsconfig.json` to prevent property mismatch on optional HTTP context types.

## Summary

Zero critical, warning, or info findings. Full verification suite (all 6 stages including format, build, unit + arch tests, integration tests, Angular production docker build, and openapi drift check) passed cleanly.
