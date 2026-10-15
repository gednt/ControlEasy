# Tasks: Device Simulator UI

**Spec**: `.specs/device-simulator-ui/spec.md`
**Plan**: `.specs/device-simulator-ui/plan.md`
**Branch**: `feat/device-simulator-ui`

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["T1", "T2", "T3"] },
    { "wave": 2, "tasks": ["T4"] },
    { "wave": 3, "tasks": ["T5"] },
    { "wave": 4, "tasks": ["T6"] }
  ]
}
```

## Orchestrator-budget notes

Wave 1 was dispatched as three parallel sub-agents on the
`general` subagent-type. T1 and T2 sub-agents reported they had no
file-read/write/shell tools available in their harness and stopped
without producing any change; T3 succeeded. T1 is re-dispatched in
this turn (the next subagent call), and T2 follows in series because
it depends on T1's new types landing on disk. The subagent budget
remains within Principle VII (≤3 in flight). If the re-dispatched T1
also fails for the same reason, the orchestrator records the
deviation in this file and falls back to main-session edits with an
explicit rationale.

T1, T2, T3 are independent and may run in parallel as separate
sub-agent dispatches (3-sub-agent budget). T4 depends on T1–T3.
T5 depends on T4. T6 depends on T5.

## Tasks

### T1 — Type additions and DevicesApiService wrappers

Extend `src/Web/ControlEasyReborn.Web/src/app/features/devices/door-unlock.types.ts`
with:

- `SimulatedAttempt` (mirrors C# `SimulatedAttempt`).
- `SimulatorFailureModeLabel` map (0..3 → human-readable labels).
- `EnqueueOfflineResult` (`{ queued: number }`).
- `SimulatorQueueItem` (mirrors C# `DeviceEventPayload`).

Extend
`src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-api.service.ts`
with six thin wrappers:

- `getSimulatorAttempts(deviceId)` — direct `HttpClient.get`,
  `responseType: 'json'`, returns the body array. Path
  `/api/v1/_internal/devices/{deviceId}/simulator`.
- `setSimulatorFailureMode(deviceId, mode)` — generated
  `DevicesInternalService.apiV1InternalDevicesDeviceIdSimulatorFailureModePost`.
- `setSimulatorOffline(deviceId, untilUtc)` — generated
  `DevicesInternalService.apiV1InternalDevicesDeviceIdSimulatorOfflinePost`
  (sends `{ untilUtc: untilUtc.toISOString() }`).
- `resetSimulator(deviceId)` — generated
  `DevicesInternalService.apiV1InternalDevicesDeviceIdSimulatorResetPost`.
- `enqueueSimulatorOfflineEvents(deviceId, count, fromSequence)` —
  generated
  `DevicesInternalService.apiV1InternalDevicesDeviceIdSimulatorEnqueueOfflinePost`.
- `drainSimulatorQueue(deviceId)` — direct `HttpClient.get`, returns
  the body array. Path
  `/api/v1/_internal/devices/{deviceId}/simulator/queue`.

Maps **FR-002, FR-003, FR-004, FR-005, FR-006, FR-009**.

### T2 — `DeviceSimulatorService`

Create
`src/Web/ControlEasyReborn.Web/src/app/features/devices/device-simulator.service.ts`
(root-provided) with:

- `inspectorAvailable: WritableSignal<boolean | null>` (initial `null`).
- `selectedDeviceId: WritableSignal<string | null>`.
- `recordedAttempts: WritableSignal<SimulatedAttempt[]>` (clamped to
  200 newest-first on every load).
- `pendingAction: WritableSignal<SimulatorAction | null>` where
  `SimulatorAction = 'probe' | 'load' | 'failureMode' | 'offline' | 'reset' | 'enqueue' | 'drain'`.
- `lastError: WritableSignal<string | null>`.
- `probeInspector()` — single GET
  `/api/v1/_internal/devices/00000000-0000-0000-0000-000000000001/simulator`;
  sets `inspectorAvailable` to `true` on 2xx, `false` on non-2xx.
- `loadAttempts(deviceId)` — calls `api.getSimulatorAttempts`; clamps
  to 200 newest-first by `occurredAtUtc` descending.
- `setFailureMode(deviceId, mode)` — POST; on 2xx calls
  `loadAttempts(deviceId)`.
- `setOfflineUntil(deviceId, untilUtc)` — POST; on 2xx calls
  `loadAttempts(deviceId)`.
- `reset(deviceId)` — POST; on 2xx clears `recordedAttempts` and
  re-calls `loadAttempts`.
- `enqueueOffline(deviceId, count, fromSequence)` — POST; returns the
  `{ queued: number }` body.
- `drainQueue(deviceId)` — GET; returns the drained list.
- 5-second timeout on every action via
  `firstValueFrom(Promise.race([op, timeoutAfter(5_000)]))`; on timeout
  sets `lastError` to "Action timed out — retry" and rethrows.
- Uses `getApiErrorMessage` from `core/utils/api-error.util` for
  ProblemDetails rendering.

Add `device-simulator.service.spec.ts` with unit tests for:

- initial state: `inspectorAvailable === null`, `recordedAttempts === []`.
- probe sets `inspectorAvailable` to `true` on 2xx, `false` on 404.
- probe sets `inspectorAvailable` to `false` on a thrown error.
- `loadAttempts` clamps to 200 newest-first when 250 are returned.
- `loadAttempts` sets `lastError` to the ProblemDetails text on HTTP error.
- `setFailureMode` flips `pendingAction` to `'failureMode'`, then back
  to `null` after the POST resolves.
- 5-second timeout sets `lastError` to "Action timed out — retry" and
  throws.

Maps **FR-002, FR-007, FR-009, FR-010**.

### T3 — `DeviceSimulatorSectionComponent`

Create
`src/Web/ControlEasyReborn.Web/src/app/features/devices/components/device-simulator-section.component.ts`
(standalone, OnPush, signals, `ce-device-simulator-section` selector)
with:

- A page-level `<details>` disclosure; default `open` = `false`. The
  `<summary>` text is "Device simulator". The disclosure has a
  `data-testid="device-simulator-disclosure"`.
- A `select` (`data-testid="simulator-device-select"`) populated from
  the page-provided `@Input() devices: DeviceHealthDto[]`. Default
  selection: the first device id; on change, the page re-renders
  the controls and `loadAttempts(deviceId)` runs.
- A "Failure mode" `<select>` (4 options) +
  `data-testid="simulator-failure-mode-apply"` button. On click:
  `window.confirm("Set failure mode to <label> for this device?")`,
  then `setFailureMode`. The selector is bound to a local signal.
- An "Offline until" `<input type="datetime-local">` (defaulting to
  `now + 60s` formatted as `YYYY-MM-DDTHH:mm`) + Apply button
  (`data-testid="simulator-offline-apply"`). On click:
  `window.confirm("Mark this device offline until <UTC>?")`, then
  `setOfflineUntil`.
- A "Reset simulator" button
  (`data-testid="simulator-reset"`). On click:
  `window.confirm("Reset simulator state for this device?")`, then
  `reset`.
- A "Recorded attempts" list (`data-testid="simulator-attempts-list"`).
  Renders the first 200 attempts newest-first. If
  `recordedAttempts.length === 200` AND the underlying list was
  truncated (service exposes a `hasMore: boolean` signal that becomes
  `true` when more than 200 are returned), show a single
  `<p class="muted">Showing most recent 200</p>` footer.
- An "Enqueue offline events" form: two `<input type="number">` (count,
  fromSequence) + Enqueue button
  (`data-testid="simulator-enqueue"`). On click:
  `window.confirm("Pre-load <count> events from sequence <seq>?")`,
  then `enqueueOffline`. On success, a `ToastService.success` shows
  the queued count.
- A "Drain queue" button (`data-testid="simulator-drain"`). On click:
  `drainQueue`. On success, a `ToastService.info` shows "Drained N
  events".
- Every action: shows a `CeSpinnerComponent` next to the active
  button (driven by `pendingAction`); on success `toast.success` or
  `toast.info`; on failure `toast.error` with the ProblemDetails text
  (or "Action failed" fallback).
- A loading state (`ce-spinner` + "Loading simulator state…") while
  `pendingAction() === 'load'`.
- An error banner (role="alert") when `lastError()` is non-null and
  the action is not in flight.
- The component MUST NOT log JWTs, tenant keys, HMAC nonces, or any
  material from `DeviceUnlockAudit`. (FR-010)
- Synthetic ids only: the test fixtures use
  `00000000-0000-0000-0000-000000000001` etc. (FR-011)

Add `device-simulator-section.component.spec.ts` with unit tests for:

- renders nothing when `devices.length === 0` (the empty state is the
  page's responsibility, but the section should still render the
  disclosure + an empty list).
- defaults the failure mode selector to "None".
- defaults the offline-until input to "now + 60 s" (within 5 s tolerance).
- clicking "Apply" on the failure mode without confirming does not
  call `setFailureMode`.
- the per-button spinner is visible while `pendingAction() === 'failureMode'`.
- the recorded-attempts list shows "Showing most recent 200" when
  `hasMore() === true`.
- the toast is invoked on success and on failure.

Maps **FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-009, FR-011,
FR-012**.

### T4 — Page integration

Extend `src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-health.page.ts`:

- Import `DeviceSimulatorSectionComponent` and `DeviceSimulatorService`.
- Inject `DeviceSimulatorService`.
- After the device-health table card, render
  `<ce-device-simulator-section [devices]="devices()">…</ce-device-simulator-section>`
  **only when** `simulatorService.inspectorAvailable() === true`. When
  `null` or `false`, render nothing (no placeholder — FR-007).
- On `ngOnInit` after the first health snapshot arrives, call
  `simulatorService.probeInspector()`. If the probe succeeds, also
  pre-select the first device id.

Extend `src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-health.page.spec.ts`:

- Add a `FakeDeviceSimulatorService` (analogous to the
  `FakeDeviceHealthService` already in the spec) with
  `inspectorAvailable: signal<boolean | null>(null)`, `setInspector(value)`,
  `probe()`, and stubs for the action methods.
- New test: "does NOT render the simulator section when
  `inspectorAvailable()` is `null`".
- New test: "does NOT render the simulator section when
  `inspectorAvailable()` is `false`".
- New test: "renders the simulator section when
  `inspectorAvailable()` is `true`".
- New test: "calls `probe()` once on init, after the first health
  snapshot arrives".

Maps **FR-001, FR-007, FR-008, FR-009**.

### T5 — Playwright E2E

Create
`src/Web/ControlEasyReborn.Web/e2e/device-simulator-ui.spec.ts` with:

- `test.describe('Device simulator UI')`.
- `test.beforeEach`: `loginAsDemoUser(page, demoAdminEmail,
  demoAdminPassword)`.
- Test (a): "renders the simulator section in dev" — goto `/devices`,
  expand the disclosure, assert
  `data-testid="simulator-device-select"` is visible. **Skip the
  whole describe with `test.skip(!simulatorAvailable,
  'inspector flag is off in this environment')` when the section is
  not visible after a 3 s wait.**
- Test (b): "toggling Always AuthFailed produces a 401 from a real
  unlock" — select a registered device, set failure mode to
  `Always AuthFailed`, confirm, await the toast. Then via
  `page.request.post(/api/v1/devices/{id}/unlock, { … })` with the
  HMAC-signed body (or via the inspector's recorded attempts if the
  E2E suite cannot sign requests), assert a recorded attempt with
  outcome `AuthFailed` appears. (Falls back to "the toggle action
  returned 204" if signing is out of scope — see comment in the test
  for which branch ran.)
- Test (c): "resetting clears the recorded attempts" — after test
  (b), click "Reset simulator", confirm, assert the attempts list is
  empty.
- Test (d): "the section does NOT render when the inspector flag is
  disabled" — runs at the top of the describe; if the section is
  not in the DOM, `test.skip` is applied; otherwise the test asserts
  the section is visible. (The spec demands the panel is hidden in
  production; this test asserts the panel is hidden in this dev run
  when the flag is off — which is the dev-stack default.)
- Test (e): "Porteiro can see and operate the panel" —
  `loginAsDemoUser(page, demoPorteiroEmail, demoPorteiroPassword)`,
  goto `/devices`, assert the section is visible. Reuses
  `demo-auth.ts`.

Use `demoPorteiroEmail`/`demoPorteiroPassword` and
`demoAdminEmail`/`demoAdminPassword` from `e2e/helpers/demo-auth.ts`.

The spec's FR-012 is covered by (a), (b), (c), (d), (e). Test (d) is
the "production-mirroring" assertion; (a) is the "dev visibility"
assertion. The two combine to satisfy FR-007 (hidden in prod, visible
in dev).

Maps **FR-007, FR-008, FR-012, SC-001, SC-002, SC-003, SC-005**.

### T6 — Final verification

- Run `bash scripts/verify-ci-local.sh --fast` from inside the
  `mcr.microsoft.com/dotnet/sdk:8.0` container, mount the repo, and
  copy `docker` from the `docker:27-cli` image into the SDK container
  (the host has no working bash, so the script must be run from
  inside a Linux container that has both `bash` and `docker`).
- Run the canonical Web SPA gate (per `AGENTS.POLICY.md`):
  ```
  docker run --rm \
    -v "$PWD:/workspace" \
    docker.gitea.com/runner-images:ubuntu-latest \
    bash -c "cd /workspace/src/Web/ControlEasyReborn.Web && \
             npm ci --legacy-peer-deps && \
             npm run lint && \
             npx playwright install --with-deps chromium && \
             CHROME_BIN=\"$(node -e 'console.log(require(\"@playwright/test\").chromium.executablePath())')\" && \
             npm test -- --no-watch --browsers=ChromeHeadlessNoSandbox"
  ```
  Pass condition: `TOTAL: N SUCCESS`, no `FAILED`.
- If the Playwright E2E suite can be reached (`make up` and the
  dev stack is healthy on this host), run it. Otherwise report
  "Playwright E2E not executed on this host — run
  `make up && npm run e2e`".
- Atomic commits per task (T1, T2, T3 can each be a commit; T4
  depends on T1–T3 so commits T1–T3 are pushed first, then T4 in a
  separate commit, then T5, then T6 if it produced fixes).
- Push to `origin/feat/device-simulator-ui`. Do not merge on `main`.

Maps **all of Verification Plan §1–§7**.
