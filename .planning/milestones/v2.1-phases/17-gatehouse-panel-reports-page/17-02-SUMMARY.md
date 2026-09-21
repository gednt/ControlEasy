---
phase: 17
plan: 02
subsystem: AccessControl / Gatehouse / QR
tags: [camera-orientation, localstorage, qr-scan, facing-mode, mirroring]
requires:
  - QrScanPage component
provides:
  - Camera facingMode persistence in localStorage under ce_qr_facing_mode
  - Automatic restore of environment vs user camera on reopen
  - Video stream mirroring toggle computed from facingMode
  - Flip camera button with accessible aria attributes and device constraint restart
  - Fallback error handling for overconstrained camera devices
affects:
  - 17-01 (Embedded QR scan tab in GatehousePanelPage)
tech-stack:
  added: []
  patterns:
    - Angular 18 Signals (facingMode, isMirrored)
    - Browser LocalStorage persistence key
key-files:
  modified:
    - src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.spec.ts
decisions:
  - "Storage key defined as CAMERA_FACING_MODE_STORAGE_KEY = 'ce_qr_facing_mode'"
  - "Default orientation prefers 'environment' on rear-camera devices and falls back gracefully to 'user'"
  - "Mirrored state is computed: user facingMode is mirrored, environment facingMode is not mirrored"
  - "Flip camera updates localStorage, triggers scanner restart with updated ideal constraints"
metrics:
  duration: ~15 min
  completed: 2026-09-19
status: complete
actuals:
  tasks: 2
  commits: 1
---

# Plan 17-02 Summary: QR Scanner Camera Orientation Persistence

Implemented device-level camera orientation persistence in `QrScanPage` using browser `localStorage` key `ce_qr_facing_mode`. The scanner automatically restores the last-selected orientation upon opening at any gate, properly flips mirroring, and restarts the video constraints dynamically.

## Implementation Details

1. **State & LocalStorage Persistence (`qr-scan.page.ts`)**:
   - Stored in `localStorage` under `ce_qr_facing_mode`.
   - `facingMode` signal tracks `'environment' | 'user'`.
   - `isMirrored` computed signal ensures the video element is horizontally mirrored (`transform: scaleX(-1)`) only when using the front (`'user'`) camera.
   - `startScanner()` passes `{ video: { facingMode: { ideal: mode } } }` to ZXing `decodeFromConstraints`.
2. **Dynamic Camera Toggling**:
   - `toggleCameraFacing()` switches between `'environment'` and `'user'`, writes to `localStorage`, and calls `startScanner()` to rebind the video stream.
3. **Unit Tests (`qr-scan.page.spec.ts`)**:
   - Verified that `localStorage` is queried on init and stored values are respected.
   - Verified that toggling camera orientation writes to `localStorage` and triggers scanner re-initialization.
