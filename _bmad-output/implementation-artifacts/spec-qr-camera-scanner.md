---
title: 'Camera-based QR scanning for gatehouse'
type: 'feature'
created: '2026-09-17'
status: 'done'
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The gatehouse QR scan page (`/gatehouse/qr`) is a text-paste form. Portaria staff cannot use it operationally because they must transcribe the credential value by hand instead of scanning the resident's QR with the device camera.

**Approach:** Add a live camera-based QR scanner using `@zxing/browser` to the existing `QrScanPage`. The scanner auto-starts on page load, auto-stops on first successful decode, and submits the decoded value through the existing `GatewayControlService.recordScan(...)` flow (no backend change). The text-paste input stays visible as a manual fallback and is the only input when camera permission is denied or no camera is available.

## Boundaries & Constraints

**Always:**
- Reuse the existing `GatewayControlService.recordScan({ qrPayload, direction, scanAttemptId })` contract — no backend changes; the scanner produces the same `qrPayload` string the paste input does.
- The QR scanner runs in the browser only (`@zxing/browser` is a client-side WASM-free reader that uses `BarcodeDetector` when available and falls back to its own decoder).
- Camera lifecycle MUST be torn down on component destroy and after each successful decode (no orphaned streams or active `MediaStreamTrack`s).
- Each scanned submit MUST use a fresh `scanAttemptId` so server-side idempotency dedupes accidental double-scans at the same code.
- The text-paste input remains visible and fully functional at all times as a keyboard / no-camera fallback.
- After a successful scan, the camera auto-rearms so the next visitor can be scanned without a manual reset (a fresh `scanAttemptId` is generated).
- Permissions UX: on `NotAllowedError` / `NotFoundError` / `NotReadableError`, show an inline error explaining the cause and keep the text-paste input enabled.

**Ask First:**
- Browser camera permission UX copy (currently not specified beyond "grant permission").

**Never:**
- Do NOT add a new endpoint, modify the backend, or change the `RecordAccessScanRequest` shape — the existing opaque-token contract is sufficient.
- Do NOT auto-submit continuously — auto-stop on first decode (prevents flood).
- Do NOT persist the camera stream, decoded payloads, or `MediaStream` to anywhere.
- Do NOT block the page render on camera availability — if the camera is not ready or fails, the page must still render and the paste input must work.
- Do NOT install any QR library other than `@zxing/browser` (Angular 18 compatible, MIT, no native deps). `@zxing/library` is a transitive peer — declared but not imported directly.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_CAMERA | Camera granted, valid QR in frame | Camera auto-stops on decode; `recordScan` POSTs; `state.result` populates with recorded outcome; camera auto-rearms on next visitor with a fresh `scanAttemptId` | n/a |
| HAPPY_PATH_PASTE | User types into paste input and submits | Same `recordScan` flow as before (unchanged) | n/a |
| PERMISSION_DENIED | `getUserMedia` rejects with `NotAllowedError` | Inline `role="alert"` message: "Camera permission denied. Use the text input below to paste the QR value." Camera panel hidden, paste input remains enabled | Show error inline; do not throw |
| NO_CAMERA | `enumerateDevices` returns no videoinput | Camera panel hidden, hint "No camera detected — paste the QR value below." Paste input remains enabled | Show hint inline; do not throw |
| DECODE_WHILE_BUSY | Camera decodes a code while a previous scan is still in flight | Ignore the decoded value until `state.busy` clears; do NOT enqueue or buffer | Silently drop the frame |
| COMPONENT_DESTROY | User navigates away mid-scan | All `MediaStreamTrack`s stopped; ZXing reader closed; subscription to `recordScan` completed/unsubbed | ngOnDestroy tears down |
| SCAN_REFUSED | Server returns 422 with `failureCode` | Existing refusal UI renders; camera auto-rearms with fresh `scanAttemptId` so the operator can rescan immediately | n/a |
| DOUBLE_DECODE_RACE | Two consecutive frames decode the same value before `state.busy` flips | First wins; second is ignored while busy | n/a |

</frozen-after-approval>

## Code Map

- `src/Web/ControlEasyReborn.Web/package.json` -- add `@zxing/browser` runtime dep + `@zxing/library` peer.
- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts` -- replace static camera stub with `@zxing/browser` `BrowserMultiFormatReader`, wire device selection, lifecycle, error states, auto-restart on result.
- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.spec.ts` -- cover the new behavior: camera decode success path (mock ZXing), permission-denied fallback, busy-guard, rearm, ngOnDestroy teardown.
- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.html` -- (split out for clarity, optional) OR keep inline template; conditional render of `<video>` + reticle overlay + inline error.
- `_bmad-output/implementation-artifacts/spec-qr-camera-scanner.md` -- this file.

## Tasks & Acceptance

**Execution:**
- [x] `src/Web/ControlEasyReborn.Web/package.json` -- add `@zxing/browser` to `dependencies` and `@zxing/library` to `dependencies` -- camera scanning library + decoder peer.
- [x] `src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts` -- implement camera scanner:
  - inject and use `BrowserMultiFormatReader` from `@zxing/browser`,
  - call `decodeFromVideoDevice(undefined, videoEl, (result, err, controls) => ...)` on init,
  - on successful decode: set `qrPayload` to `result.getText()`, call existing `submit()`, then rearm with a fresh `scanAttemptId`,
  - on busy: drop the decoded frame,
  - on `NotAllowedError` / `NotFoundError` / `NotReadableError`: set `state.error` to a clear inline message; do not throw,
  - on `ngOnDestroy`: call `controls.stop()` (or track and stop tracks manually) to release the `MediaStream`,
  - keep the paste input + Direction select + submit button unchanged and always visible.
- [x] `src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts` -- template: render a `<video>` element behind the form when camera is active; render an inline alert when error; keep the existing paste input as the fallback.
- [x] `src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.spec.ts` -- add tests:
  - renders the QR form (existing — keep green),
  - records a successful scan from a decoded QR value (existing — keep green),
  - surfaces refusal with the safe failure code (existing — keep green),
  - **NEW:** shows inline permission-denied error when `BrowserMultiFormatReader.decodeFromVideoDevice` rejects with `NotAllowedError`, and paste input remains available,
  - **NEW:** ignores decode events while `state.busy` is true (no extra HTTP requests),
  - **NEW:** tears down the scanner on destroy (no leaked MediaStreamTracks).

**Acceptance Criteria:**
- Given the gatehouse QR page is loaded with camera permission granted, when a valid QR is placed in front of the camera, then the page submits exactly one `POST /api/v1/access-events/scans` with the decoded text as `qrPayload` and a fresh `scanAttemptId`, then the camera auto-rearms with another fresh `scanAttemptId`.
- Given camera permission is denied, when the page loads, then an inline alert with `role="alert"` explains the denial, the text-paste input is visible and enabled, and no HTTP requests are made until the user types and submits.
- Given a scan is in flight (`state.busy === true`), when a second QR is decoded by the camera, then no additional `POST` is sent and the in-flight request completes normally.
- Given the user navigates away from the QR page mid-scan, when the component is destroyed, then the camera stream's `MediaStreamTrack`s have `readyState === 'ended'` and no further decode callbacks fire.
- Given the camera fails to start (no camera, permission denied, or device busy), when the page is rendered, then the existing paste-and-submit path continues to work identically to the pre-change behavior.

## Spec Change Log

- **finding:** Adversarial + edge-case review (run during step 4) identified 18 findings: 5 high (no CSS, Node 24 vs Node 20, transient errors permanently brick camera, paste-submit silently dropped, post-destroy callback → phantom scan), 7 medium, 6 low.
- **amended:** Component gained a `styles:` block with video/reticle/error CSS; package.json pinned to `@zxing/browser@0.1.5` + `@zxing/library@0.21.3` (Node 20-compatible); added `destroyed` flag guarding every state mutation; `handleCameraError` distinguishes terminal (`NotAllowedError`/`NotFoundError`/`PermissionDeniedError`) from transient (`NotReadableError`) — only terminal sets `cameraStatus: 'unavailable'` permanently; transient errors schedule a 1500ms retry; `stopScanner` clears `videoEl.srcObject`, stops `MediaStreamTrack`s, and `videoEl.load()`s; `cryptoRandom` uses `crypto.getRandomValues` when available; payload validated for length (8..1024) and trimmed before submit; QR decoded texts now go through minimum-length check before triggering HTTP; `aria-live="polite"` added to result panel and busy-hint; duplicate `role="alert"` removed; busy hint shown while a request is in flight so a paste-Enter during camera scan is no longer silent.
- **known-bad state avoided:** A portaria operator on a phone in sunlight would otherwise see an invisible camera viewport, an install failure on the Node 20 CI, and a permanently bricked page if another tab briefly held the camera.
- **KEEP:** Auto-stop on first decode + auto-rearm with fresh `scanAttemptId` + paste-input fallback; reuse of the existing `GatewayControlService.recordScan(...)` contract; `NotAllowedError` shows the paste-fallback message; inline `role="alert"` for camera errors.

## Design Notes

**Why `@zxing/browser`:** It is the maintained Angular-friendly wrapper around the original ZXing project, supports `BarcodeDetector` when available (modern browsers), falls back to its own WASM-free decoder, and ships first-class TypeScript types. `@zxing/library` is its decoder peer; we declare it explicitly even though `@zxing/browser` re-exports from it, because `@zxing/browser` 0.1.5 lists it as a peer.

**Lifecycle model:** ZXing's `BrowserMultiFormatReader.decodeFromVideoDevice(...)` returns a `IScannerControls` object exposing `stop()`. We hold this handle on the component instance and call `stop()` from `ngOnDestroy` AND immediately after a successful decode (then re-call `decodeFromVideoDevice` on the next animation frame so the UI re-arms without flicker). We never call `decodeFromVideoDevice` again while `state.busy` is true — we set `busy` synchronously before kicking the HTTP request so any decode arriving between the call and the response is dropped.

**Why auto-rearm:** Portaria scans one visitor after another; a manual "scan next" button would add a tap per visitor. Auto-rearm with a fresh UUID `scanAttemptId` keeps the operator flow single-tap-per-arrival and the server's idempotency keys remain unique.

## Verification

**Commands:**
- `cd src/Web/ControlEasyReborn.Web && npm install` -- expected: clean install, no peer-dep warnings about `@zxing/library`.
- `cd src/Web/ControlEasyReborn.Web && npm run lint` -- expected: 0 errors.
- `cd src/Web/ControlEasyReborn.Web && npm test -- --no-watch --browsers=ChromeHeadless` -- expected: all `QrScanPage` specs pass (existing 3 + new ones).
- `./scripts/verify-ci-local.sh --fast` -- expected: format + build + unit/architecture tests pass.

**Manual checks (if no CLI):**
- Open `https://ce-feat-qr-entrance-frontend-routing.localhost/gatehouse/qr` in a Chromium-based browser with a webcam.
- Expected: camera viewport visible, QR detected → form auto-submits once, recorded outcome shown, viewport re-arms.
- Deny camera permission → reload → expected: inline alert "Camera permission denied. Use the text input below to paste the QR value." and the paste input still works.

## Suggested Review Order

**Camera scanner lifecycle (the core change)**

- Component shell, OnPush + signals + `cryptoRandom` UUID generation — entry point.
  [`qr-scan.page.ts:1`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts#L1)
- ZXing wiring: `decodeFromVideoDevice(undefined, videoEl, cb)` + camera-status state machine.
  [`qr-scan.page.ts:240`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts#L240)
- Decode callback: busy guard, length + trim validation, then call `submit()`.
  [`qr-scan.page.ts:265`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts#L265)
- Error handling: terminal vs transient classification (`NotAllowedError`/`NotFoundError` vs `NotReadableError`).
  [`qr-scan.page.ts:325`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts#L325)
- Teardown: `destroyed` flag, `controls.stop()`, `MediaStreamTrack.stop()`, `videoEl.srcObject = null`, `videoEl.load()`.
  [`qr-scan.page.ts:215`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts#L215)
- `submit()` flow: reuses existing `GatewayControlService.recordScan`; auto-rearms with fresh `scanAttemptId` on next/err.
  [`qr-scan.page.ts:222`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts#L222)

**Template + styling**

- `<video>` viewport + reticle + "Starting camera" overlay (always rendered so `@ViewChild` resolves).
  [`qr-scan.page.ts:101`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts#L101)
- Inline `role="alert"` for camera errors + `aria-live` for the result panel + busy hint.
  [`qr-scan.page.ts:120`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts#L120)
- Inline `styles: [...]` block — sized viewport, reticle, error background, busy hint.
  [`qr-scan.page.ts:60`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts#L60)

**Dependency pinning**

- `@zxing/browser@0.1.5` + `@zxing/library@0.21.3` (Node 20-compatible; engines.node >= 10.4.0).
  [`package.json:34`](../../src/Web/ControlEasyReborn.Web/package.json#L34)

**Tests**

- Test bootstrap: spy on `BrowserMultiFormatReader.prototype.decodeFromVideoDevice`, return a controllable Promise.
  [`qr-scan.page.spec.ts:37`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.spec.ts#L37)
- All six specs covering: form render, decode → POST, refusal, permission-denied fallback, busy guard, destroy teardown.
  [`qr-scan.page.spec.ts:60`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.spec.ts#L60)

### Review Findings (code review 2026-09-18)

- [x] [Review][Decision] Auto-rearm re-scans a QR still in frame — unbounded re-record loop. Decode → submit → stopScanner → scheduleRearm(250ms) restarts the camera while the same QR is in front of the lens; it decodes again and POSTs with a fresh scanAttemptId each cycle, so the server-side idempotency the spec relies on never fires (one access event/second until the QR is removed). The frozen constraint "fresh scanAttemptId so idempotency dedupes accidental double-scans" is in tension with auto-rearm. Needs a human call: same-payload suppression window vs. accept behavior. [qr-scan.page.ts:373-386]
- [x] [Review][Patch] Any submit permanently kills the camera (high) [qr-scan.page.ts:288-292, 277, 319-329, 344, 373-398] — three cooperating defects: (1) stopScanner()'s track.stop() makes the stream inactive, which fires the video element's 'ended' listener → handleCameraError sets cameraStatus 'unavailable' + CAMERA_IN_USE and schedules a retry; (2) the HTTP response's scheduleRearm() then clears that retry (shared rearmHandle) and its startScanner() bails on cameraStatus === 'unavailable' → camera dead until reload; (3) late decode callbacks re-assign a stale, already-stopped controls object, which makes the `if (this.scannerControls || ...)` guard bail forever even when recovery paths run.
- [x] [Review][Patch] scheduleRearm() erases error messages 250ms after a failed scan — error handler sets 'Scan service unavailable.' then scheduleRearm() nulls it; also wipes CAMERA_PERMISSION_DENIED on the next submit. [qr-scan.page.ts:255-262, 380-384]
- [x] [Review][Patch] Transient NotReadableError retries forever with no cap and no steady state — 1500ms loop for as long as another app holds the camera. [qr-scan.page.ts:341-348, 389-399]
- [x] [Review][Patch] Teardown test asserts the wrong call site — initialControls.stop is already called by submit()'s stopScanner() before fixture.destroy(), so the spec passes even if ngOnDestroy teardown is deleted. [qr-scan.page.spec.ts:192-209]
- [x] [Review][Patch] Paste path bypasses the 8..1024 length validation the decode path enforces — submit() accepts any non-empty value; input has no maxlength. [qr-scan.page.ts:229-233, 302-305]
- [x] [Review][Patch] Paste submit landing inside the 250ms rearm window reuses the just-consumed scanAttemptId — regenerate the id at submit time, not only in the rearm timer. [qr-scan.page.ts:229-241, 377-386]
- [x] [Review][Patch] 'ended' listener accumulates one {once:true} listener per rearm cycle on the same persistent <video> element. [qr-scan.page.ts:283, 319-329]
- [x] [Review][Defer] No visibilitychange handling — hidden tab suspends tracks, 'ended' fires NotReadableError, retry loop continues while hidden; robustness enhancement. [qr-scan.page.ts:319-329] — deferred, robustness enhancement beyond spec scope

### Review Findings — round 2 (code review 2026-09-18)

Second review pass over the round-1 patches found four regressions/omissions in the camera-death cluster; all fixed in this pass:

- [x] [Review][Patch] Retry cap was defeated by its own reset — scheduleRetry's timer reset retryCount to 0 before startScanner, so the counter oscillated 0↔1 and CAMERA_RETRY_LIMIT never engaged. Reset removed; the cap now counts consecutive NotReadableError retries (5 max, then steady 'unavailable' state).
- [x] [Review][Patch] Refused credentials never armed suppression — a refused QR left in frame re-POSTed every ~250-400ms indefinitely. Refusal responses now arm the same-payload suppression window and clear the paste input.
- [x] [Review][Patch] Intentional stopScanner() still tripped the 'ended' listener → camera dead after first submit. The ended handler now ignores 'ended' while scannerControls is non-null (intentional stop in progress); handler is re-attached per startScanner (replace + removeEventListener, no accumulation).
- [x] [Review][Patch] adoptControls identity guard was a no-op — late/stale decode callbacks re-adopted stopped controls. Replaced with a session counter (currentSessionId): decode callbacks from a superseded session stop their controls and are ignored; stopScanner/handleCameraError bump the session.
- [x] [Review][Patch] Paste path did not trim before the length check — whitespace-padded payloads POSTed raw. submit() now trims and validates 8..1024; input gains maxlength=1024.
- [x] [Review][Patch] UiState.scanAttemptId became dead state after the submit-time-fresh-id change — removed from state; the rearm timer no longer touches it (id is generated fresh per submit).
- [x] [Review][Patch] Interceptor navigation-events subscription had a redundant always-true instanceof branch after the type-guard filter — subscribe body simplified to the reset only.

Remaining accepted tradeoffs (per round-1 decisions):
- Same payload re-presented after the 3s window re-records once — accepted (bounded by physical re-presentation).
- Same payload re-presented within 3s with a different direction is suppressed silently — accepted (operator re-presents after the window; result panel still shows the previous outcome).

### Review Findings — round 3 / pre-commit (code review 2026-09-18)

- [x] [Review][Patch] CRITICAL: the round-2 'ended' guard was inverted — stopScanner() nulls scannerControls synchronously but 'ended' dispatches asynchronously, so the guard passed and the first submit still killed the camera; conversely a genuine mid-scan stream death (scannerControls non-null) was silently swallowed. Replaced with a two-signal discriminator: an intentionalStopInProgress flag set during stopScanner() plus a srcObject === null check (stopScanner detaches the stream synchronously; a genuine stream death always has srcObject attached when 'ended' dispatches). Flag is cleared when the rearm/retry timer restarts the scanner.
- [x] [Review][Patch] retryCount was cumulative for the component lifetime — now reset at each successful startScanner() so the cap counts consecutive failures as documented.
- [x] [Review][Patch] Generic (non-refusal) HTTP failures armed no suppression — a QR left in frame against a failing API re-POSTed every ~300-500ms. Generic errors now arm suppression too (refusal keeps its own arm so the operator can retry a transient refusal via paste).
- [x] [Review][Patch] Decode callback cleared error before resubmitting, making error banners flicker — the clear was removed (submit() already clears error when arming busy).
- [x] [Review][Patch] Teardown test never exercised ngOnDestroy's scanner teardown (controls were only adopted via the decode callback). Now invokes the callback with undefined result before destroy; plus a new spec dispatches a real 'ended' event after a successful submit and asserts the camera is not marked unavailable.
