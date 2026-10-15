# Implementation Plan: Device Simulator UI

**Spec**: `.specs/device-simulator-ui/spec.md`
**Branch**: `feat/device-simulator-ui`
**Worktree**: `.worktrees/feat-device-simulator-ui/`

## Goal

Expose the existing v2.3 backend simulator inspector surface
(`/api/v1/_internal/devices/{id}/simulator/*`) on the existing `/devices`
page so a developer or QA tester can drive a simulated device from the
browser — without hand-rolling cURL — and so the DOOR-11 replay scenario
(Phase 25) can be exercised from a UI.

## Hard constraints (re-stated from the spec + AGENTS.POLICY.md)

- No new backend endpoints, no new permission tokens, no new database
  table, no new route, no new guard. Reuse the v2.3 inspector endpoints
  and the existing `porteiroGuard` on `/devices`.
- Synthetic data only. `00000000-0000-0000-0000-000000000001` is the
  canonical synthetic device id used to probe the inspector's
  availability (matches `DoorIntegrationSectionComponent`'s fallback
  pattern).
- Web SPA gate is mandatory for any change under
  `src/Web/ControlEasyReborn.Web/**`. The canonical recipe
  (`docker run docker.gitea.com/runner-images:ubuntu-latest bash /tmp/ci-lint.sh`)
  must pass on the final state.
- `scripts/verify-ci-local.sh --fast` per turn, `scripts/verify-ci-local.sh`
  on completion.
- No console errors on any user interaction; every state-changing
  action shows a success or failure toast via the existing
  `ToastService`.
- Standalone components, `ce-` selector prefix, OnPush, signals,
  `CeCardComponent`, `CeButtonComponent`, `CeBadgeComponent`,
  `CeSpinnerComponent`, `CeTooltipDirective` from the existing design
  system.

## Architecture (binding)

### File layout

```
src/Web/ControlEasyReborn.Web/src/app/features/devices/
├── door-unlock.types.ts                       [extend — add SimulatedAttempt, etc.]
├── devices-api.service.ts                     [extend — add 6 thin wrappers]
├── device-simulator.service.ts                [NEW — inspector probe + state]
├── components/
│   ├── door-integration-section.component.ts  [unchanged]
│   ├── device-form-modal.component.ts          [unchanged]
│   └── device-simulator-section.component.ts  [NEW — the simulator panel]
├── devices-health.page.ts                     [extend — render the section]
├── devices-health.page.spec.ts                [extend — cover new branch]
├── device-simulator.service.spec.ts           [NEW — unit tests for the new service]
└── device-simulator-section.component.spec.ts [NEW — unit tests for the new section]
```

```
src/Web/ControlEasyReborn.Web/e2e/
└── device-simulator-ui.spec.ts                [NEW — Playwright E2E]
```

### Inspector gate (FR-007)

The panel MUST be hidden when the API is not in `Development` OR the
inspector flag is disabled. The backend returns 404 for any inspector
route in that case. Probe the inspector with a single `GET
/api/v1/_internal/devices/{syntheticId}/simulator`:

- 2xx → inspector available → render the section
- 404 / 401 / network error → inspector NOT available → do not render

`DeviceSimulatorService.probeInspector()` runs this probe on the page
init (after the device-health list loads), and exposes a signal
`inspectorAvailable: WritableSignal<boolean | null>` where `null`
means "still probing". The page reads that signal: when it's `null` or
`false`, the section is not rendered at all (no "coming soon"
placeholder per FR-007).

### Section structure (FR-001..FR-006)

- Rendered **beneath** the device-health table, inside the same page.
- A page-level `<details>` disclosure (`<summary>Device simulator</summary>`),
  **collapsed by default**.
- When expanded, the section lists every device from
  `DeviceHealthService.devices()`; the user picks one device from a
  `select` (defaults to the first). The selected device's controls
  appear below.
- For the selected device:
  - **Failure mode** selector (4 options: None, Always AuthFailed,
    Always DeviceOffline, Fails-Then-Recovers) + Apply button. The
    selector + a confirmation step (FR-003).
  - **Offline until** datetime-local input (defaulting to "now + 60 s"
    UTC) + Apply button + confirmation step (FR-004).
  - **Reset simulator** button + confirmation step (FR-005).
  - **Recorded attempts** list (capped at 200, newest first, single
    footer note when truncated) (FR-002).
  - **Enqueue offline events** form (count + fromSequence) + Enqueue
    button. (P2 per FR-006; rendered but not hidden.)
  - **Drain queue** button (P2 per FR-006).
- Every state-changing action shows a `ToastService` notification and
  refreshes the panel (FR-009).

### State management

`DeviceSimulatorService` (root-provided):

```ts
class DeviceSimulatorService {
  // Inspector gate
  readonly inspectorAvailable: WritableSignal<boolean | null>;
  probeInspector(): Promise<void>;

  // Per-device state
  readonly selectedDeviceId: WritableSignal<string | null>;
  readonly recordedAttempts: WritableSignal<SimulatedAttempt[]>;
  readonly pendingAction: WritableSignal<SimulatorAction | null>;
  readonly lastError: WritableSignal<string | null>;

  // Actions (return Promise<void>; set pendingAction; refresh on success)
  loadAttempts(deviceId: string): Promise<void>;
  setFailureMode(deviceId: string, mode: SimulatorFailureMode): Promise<void>;
  setOfflineUntil(deviceId: string, untilUtc: Date): Promise<void>;
  reset(deviceId: string): Promise<void>;
  enqueueOffline(deviceId: string, count: number, fromSequence: number): Promise<number>;
  drainQueue(deviceId: string): Promise<SimulatedAttempt[]>;  // returns drained events
}
```

- `pendingAction` drives the per-action loading spinner (so the
  existing 30 s `DeviceHealthService` poll is not confused with a
  simulator action — distinct signals).
- 5-second timeout via `firstValueFrom` + `Promise.race` (matches the
  5 s edge case in the spec).

### Confirmation step

For every state-changing action, the component uses a `confirm()`
helper. To stay consistent with the existing
`DoorIntegrationSectionComponent.onSetGatehouseActivation` and
`onRemove` patterns, the implementation uses `window.confirm()` for
the confirmation step. This is the established convention in the
codebase.

### New types (door-unlock.types.ts additions)

```ts
export type SimulatorFailureMode = 0 | 1 | 2 | 3;  // already generated
export const SIMULATOR_FAILURE_MODE_LABELS: Record<SimulatorFailureMode, string> = {
  0: 'None',
  1: 'Always AuthFailed',
  2: 'Always DeviceOffline',
  3: 'Fails-Then-Recovers',
};

export interface SimulatedAttempt {
  tenantId: string;
  deviceId: string;
  actorProfileId: string;
  nonce: string;
  timestampUtc: string;
  outcome: string;
  correlationId: string;
  occurredAtUtc: string;
}

export interface EnqueueOfflineResult {
  queued: number;
}

export interface SimulatorQueueItem {
  // Mirrors the C# DeviceEventPayload shape used by the inspector.
  eventType: string;
  occurredAtUtc: string;
  sequenceNumber: number;
  externalEventId: string | null;
  opaqueToken: string | null;
  payloadJson: string | null;
}
```

The generated `apiV1InternalDevicesDeviceIdSimulatorGet` returns
`Observable<void>` (the OpenAPI generation can't model
`List<SimulatedAttempt>`). To get a real body, the service uses
`HttpClient` directly with the same path, with `responseType: 'json'`
+ `observe: 'response'`, then maps the body — same approach used by
the existing `devices-api.service.ts` for unlock and
`device-events.service.ts` for the list.

The thin wrappers in `devices-api.service.ts` use the generated
`DevicesInternalService` for state-changing actions (where the body
is irrelevant because the response is 204 or a small `{ queued: N }`)
and use a direct `HttpClient` request for the list of attempts and
the queue drain (where the body matters).

### `DevicesApiService` additions (thin wrappers)

```ts
getSimulatorAttempts(deviceId: string): Observable<SimulatedAttempt[]>;
setSimulatorFailureMode(deviceId: string, mode: SimulatorFailureMode): Observable<void>;
setSimulatorOffline(deviceId: string, untilUtc: Date): Observable<void>;
resetSimulator(deviceId: string): Observable<void>;
enqueueSimulatorOfflineEvents(deviceId: string, count: number, fromSequence: number): Observable<EnqueueOfflineResult>;
drainSimulatorQueue(deviceId: string): Observable<SimulatorQueueItem[]>;
```

The first uses direct `HttpClient`; the rest use the generated
`DevicesInternalService`.

## Implementation waves (parallelizable where indicated)

### Wave 1 — foundation (3 sub-agents in parallel)

- **Sub-agent A** — type + API service layer. Extends
  `door-unlock.types.ts` with the new types; extends
  `devices-api.service.ts` with the 6 thin wrappers; mirrors the
  existing patterns (see `ingestEvent`, `listEvents`, `unlock`).
- **Sub-agent B** — `DeviceSimulatorService` + its unit tests. Owns
  the inspector probe, the per-device state, and the action helpers.
  Includes `.spec.ts` with: probe returns `false` on 404; 200 sets
  `inspectorAvailable` to `true`; action timeout; per-action
  `pendingAction` lifecycle; `loadAttempts` clamps to 200 newest-first.
- **Sub-agent C** — `DeviceSimulatorSectionComponent` (standalone, OnPush,
  signals) + its unit tests. Owns the disclosure, the device selector,
  the failure-mode form, the offline-until form, the reset button, the
  enqueue form, the drain button, the recorded-attempts list. Pure
  presentation — consumes `DeviceSimulatorService` from the page.

### Wave 2 — integration (1 sub-agent after wave 1)

- **Sub-agent D** — wires the section into `DevicesHealthPage`,
  extends `devices-health.page.spec.ts` to cover the new branch
  (section hidden when `inspectorAvailable !== true`; section visible
  when `true`; failure-mode toggle from the UI).

### Wave 3 — E2E (1 sub-agent after wave 2)

- **Sub-agent E** — Playwright E2E spec
  `e2e/device-simulator-ui.spec.ts` covering FR-012(a–e). Uses
  `e2e/helpers/demo-auth.ts` (TenantAdmin or Porteiro persona per the
  spec). Skips automatically when the inspector flag is off in the
  dev environment.

### Wave 4 — final verification (1 sub-agent)

- **Sub-agent F** — runs the Web SPA gate (canonical Docker recipe
  per `AGENTS.POLICY.md` §Web SPA gate) and `verify-ci-local.sh
  --fast`; reports and fixes any issues. Runs the full Playwright E2E
  suite if a dev stack is reachable, otherwise reports the suite as
  "not executed on this host — run `make up && npm run e2e` to execute".

## Out of scope (per spec)

- New backend endpoints, new failure modes.
- A standalone `/devices/simulator` route or a new feature module.
- A "developer mode" toggle in the UI to override the inspector gate.
- Visual changes to the existing device health table beyond adding the
  simulator section beneath or beside it.
- Logging, audit, or replay of the user's own simulator actions.
- Internationalization beyond English.
