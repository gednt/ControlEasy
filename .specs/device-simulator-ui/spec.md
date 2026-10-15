# Feature Specification: Device Simulator UI

**Feature Branch**: `feat/device-simulator-ui`
**Created**: 2026-10-12
**Status**: Draft
**Input**: User request: "I want to be able to use that [v2.3] simulator on the UI, develop a spec for that and use playwright to validate."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Drive a simulated device from the browser (Priority: P1)

A developer or QA tester working in the ControlEasy dev stack can open a
/devices page and see a "Simulator" panel listing every registered
device. For each device they can: read the recorded unlock attempts,
change the failure-mode toggle (None / Always AuthFailed / Always
DeviceOffline / Fails-Then-Recovers), set an "offline until"
deadline, and reset the simulator back to defaults — all without
leaving the browser or hand-rolling cURL.

**Why this priority**: This is the whole point of the feature.
Without it, the v2.3 backend inspector surface (`/api/v1/_internal/...`)
remains accessible only via cURL / Swagger, which slows integration
work on every later phase that depends on simulated devices.

**Independent Test**: Run the dev stack (`make up`) with the
inspector flag enabled, sign in as a permitted role, navigate to
/devices, click the "Simulator" section for a registered device,
toggle Always AuthFailed, send a real `POST /api/v1/devices/{id}/unlock`,
and observe in the UI that the next attempt appears in the recorded
attempts list with outcome `AuthFailed`.

**Acceptance Scenarios**:

1. **Given** I am signed in to a dev tenant with at least one registered device, **when** I navigate to `/devices`, **then** the page renders a "Device simulator" section in addition to the existing health table.
2. **Given** the simulator panel is visible for a device, **when** I select the failure mode `Always AuthFailed` and confirm, **then** the next `POST /api/v1/devices/{id}/unlock` returns 401 ProblemDetails and the panel shows the attempt's outcome `AuthFailed`.
3. **Given** a device is in `None` mode with one recorded attempt, **when** I click "Reset simulator" and confirm, **then** the recorded attempts list is empty, the failure-mode toggle returns to `None`, and the device's offline-until is cleared.
4. **Given** I set "Offline until" to a future UTC timestamp, **when** I issue an unlock before that timestamp, **then** the unlock returns a `DeviceOffline` outcome (visible in the panel's attempts list).
5. **Given** I select `Fails-Then-Recovers`, **when** I issue three unlocks spaced beyond the 3-second rate limit, **then** the panel records `AuthFailed`, `AuthFailed`, `Success` in that order.

### User Story 2 — Use the simulator safely without breaking prod (Priority: P1)

A tester cannot accidentally invoke the simulator controls against a
non-development stack. The simulator panel is hidden (or visibly
disabled with an explanatory banner) whenever the API environment is
not `Development` AND the inspector flag is not enabled.

**Why this priority**: The backend inspector already enforces this
gate (`SimulatorInspectorEndpoints.IsInspectorEnabled`). The UI must
mirror that gate so users don't see buttons that only ever 404. A
visible-but-broken control is worse than no control — it confuses
operators, generates support tickets, and erodes trust.

**Independent Test**: Point the SPA at a Production-like environment
(dev environment flag off, inspector flag false). Open `/devices`.
Assert the simulator section is not in the DOM (or is rendered with
an explicit "disabled — inspector not enabled in this environment"
banner and no interactive controls).

**Acceptance Scenarios**:

1. **Given** the API `Devices:Simulator:EnableInspectorEndpoint` flag is `false` or absent, **when** I open `/devices`, **then** no simulator panel renders.
2. **Given** the API environment is not `Development`, **when** I open `/devices`, **then** no simulator panel renders.
3. **Given** I navigate to a route that exposes simulator controls, **when** the environment is non-dev, **then** every interactive control is absent — there are no disabled buttons that pretend to work.

### User Story 3 — Confirm an event backlog survives a reconnect (Priority: P2)

A developer exercising the DOOR-11 replay scenario (Phase 25) can
pre-load the simulator's event queue from the UI, observe the queued
events, drain them, and watch the device health reconnect — without
hand-rolling POSTs against `/api/v1/_internal/devices/{id}/simulator/enqueue-offline`.

**Why this priority**: The replay scenario is the most fragile part
of Phase 25 verification today; tooling that lets a dev replay it
visually reduces flake and accelerates Phase 26/27 work that depends
on it. P2 because the panel still delivers most of its value without
the queue controls (Stories 1–2 cover the DOOR-15/23 path).

**Independent Test**: With the inspector flag on, open the simulator
panel, set "Pre-load N events from sequence M", click "Enqueue", then
"Drain". Assert the panel reports the queued count, and a separate
ingestion call returns `replay_duplicate` for each when re-posted.

**Acceptance Scenarios**:

1. **Given** the queue section is visible for a device, **when** I set `Count=5, FromSequence=100` and click "Enqueue offline events", **then** the panel shows the synthetic events were accepted and the next "Drain queue" call returns the same five items with their `sequenceNumber` and `externalEventId`.
2. **Given** the queue is empty, **when** I click "Drain queue", **then** the response is an empty array and the panel reports "0 events".

### Edge Cases

- **What happens when the JWT does not carry a tenant?** The backend's `ITenantContextSafe.TryGetTenantId` returns `401`. The UI must surface this as a non-fatal inline error on the panel ("Could not resolve tenant for simulator controls — contact admin"), not a full-page redirect.
- **What happens when a request takes longer than 5 seconds?** The panel shows a per-action loading spinner and times out gracefully with a retry button. The existing 30 s polling in `DeviceHealthService` must not be confused with simulator action loading.
- **What happens when the simulator state is mutated by a different test in parallel?** The UI reflects whatever the backend reports — there is no optimistic locking. The panel must display the live result of the last action, not a stale optimistic value.
- **What happens when the user navigates away mid-action?** The HTTP request completes or fails on the server regardless. In-flight observables are unsubscribed via the existing pattern in `DeviceHealthService`; the page teardown follows the same lifecycle.
- **What happens when the user toggles a mode but the response is `204 No Content`?** The UI must reflect the new mode locally and persist it across panel refreshes by re-fetching the recorded attempts (the inspector endpoints do not expose the current mode; the UI persists the toggle in component state until the next action).
- **What happens when a device is deleted from under the simulator panel?** The `GET /api/v1/_internal/devices/{id}/simulator` returns 404. The panel collapses that device's row and surfaces a single inline notice — does not throw or block the rest of the table.
- **What happens when an attacker manipulates `Devices:Simulator:EnableInspectorEndpoint` to true in a non-dev environment?** Out of scope for this spec — the backend already enforces `IsDevelopment()` first; if both are flipped, the operation succeeds, but that requires write access to the API config and is a platform-admin concern, not a feature concern.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a "Device simulator" section on the existing `/devices` page (Phase 26 DOOR-13 surface) when the API reports the inspector is available, without adding a new top-level route. The section MUST be **collapsed by default** (one disclosure control per page) and expandable; per-device simulator controls appear only when the section is expanded.
- **FR-002**: The simulator section MUST list every device returned by the existing device-health endpoint (`GET /api/v1/devices/health`), grouped or filterable per device, and MUST display the recorded unlock attempts for the selected device (refreshed on demand), capped at the most recent 200 entries with a single footer note when the underlying list exceeds that.
- **FR-003**: The panel MUST provide a "Failure mode" selector with the four enum values `None`, `Always AuthFailed`, `Always DeviceOffline`, `Fails-Then-Recovers`, and a confirmation step before applying.
- **FR-004**: The panel MUST provide an "Offline until" date-time input (defaulting to "now + 60 s", UTC), with a confirmation step before applying.
- **FR-005**: The panel MUST provide a "Reset simulator" button that clears attempts, failure mode, and offline window for the selected device, with a confirmation step before applying.
- **FR-006** (P2 only): The panel MUST provide an "Enqueue offline events" form (count + fromSequence) and a "Drain queue" button for DOOR-11 replay testing.
- **FR-007**: The panel MUST be hidden entirely when the API is not in the `Development` environment OR the inspector flag is disabled. Hiding means "not in the rendered DOM" — no disabled buttons, no "coming soon" placeholders.
- **FR-008**: The system MUST gate visibility by the existing `/devices` route's `porteiroGuard`, which already permits TenantAdmin, Porteiro, and PlatformAdmin via the `DevicesUnlock` / `DevicesRead` permission tokens. No new guard is introduced; no new permission token is added.
- **FR-009**: Every state-changing action MUST show a transient success or failure toast and refresh the affected panel section. Failure responses MUST use ProblemDetails text where the backend provides one and a generic "Action failed" otherwise; never an unhandled console error.
- **FR-010**: The panel MUST NOT log or persist JWTs, tenant keys, HMAC nonces, or any material from `DeviceUnlockAudit`. The existing audit-log immutability invariant (DOOR-03) extends: the simulator panel does not write, mutate, or read raw `DeviceUnlockAudit` rows.
- **FR-011**: Synthetic test data only — any seeded device id, attempt id, or actor profile id used in the panel's own fixtures or its Playwright tests MUST be synthetic (e.g., `00000000-0000-0000-0000-000000000001`). No real CPF, name, phone, or document numbers anywhere in fixtures.
- **FR-012**: Playwright E2E coverage MUST validate that: (a) the panel renders in dev; (b) toggling `Always AuthFailed` produces a 401 from a real unlock; (c) resetting clears the recorded attempts; (d) the panel does NOT render when the inspector flag is disabled; (e) at least one of {TenantAdmin, Porteiro, PlatformAdmin} can see and operate the panel. The full Web SPA gate (`scripts/verify-ci-local.sh` + the canonical Docker recipe in `AGENTS.POLICY.md` §Web SPA gate) MUST pass before this feature is considered done.

### Key Entities

- **SimulatorPanelState** (frontend-only, in-memory): the device id currently selected, the chosen failure mode, the offline-until value, and the last-known list of recorded attempts. Not persisted beyond the page lifecycle.
- **SimulatedAttempt** (existing backend contract, see `SimulatorInspectorEndpoints`): one row per recorded `UnlockAsync` call, returned by `GET /api/v1/_internal/devices/{deviceId}/simulator`. The panel renders the existing fields: tenant, device, actor, nonce, timestamp, outcome, correlation id.
- **SimulatorFailureMode** (existing enum): `None | AlwaysAuthFailed | AlwaysDeviceOffline | FailsThenRecovers`. The panel selects among these strings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer in a fresh `make up` dev environment reaches a controllable simulator panel for any registered device in three or fewer page interactions after login (login → /devices → expand device → use a control).
- **SC-002**: A user can change a device's failure mode and observe the next `POST /api/v1/devices/{id}/unlock` reflect that mode in under 10 seconds (one user click + one real unlock).
- **SC-003**: The simulator panel disappears from `/devices` when either the environment is not Development or the inspector flag is off, with zero rendered buttons that pretend to operate against a 404 endpoint.
- **SC-004**: Playwright E2E coverage passes against the dev stack with the canonical Gitea-runner Docker recipe (`docker run docker.gitea.com/runner-images:ubuntu-latest bash /tmp/ci-lint.sh`) — `TOTAL: N SUCCESS` with no `FAILED`.
- **SC-005**: When a developer toggles `Always AuthFailed` and then issues three unlocks, the panel's recorded-attempts list shows three entries with outcomes `AuthFailed`, `AuthFailed`, `AuthFailed` — matching what the integration test `SimulatorHarnessTests.Simulator_HonorsFailureMode_AuthFailed` would observe.
- **SC-006**: The feature adds no new backend endpoint, no new database table, and no new permission token. (It uses the existing v2.3 inspector surface; the corresponding `Permissions.cs` entry `DevicesUnlock` / `DevicesRead` is sufficient.)

## Assumptions

- The existing Phase 23/24/25/26 backend work is the source of truth for the inspector endpoints and the failure-mode enum. No backend changes are part of this spec.
- The `Angular DevicesInternalService` (generated by `ng-openapi-gen`) already exposes `apiV1InternalDevicesDeviceIdSimulatorGet / FailureModePost / OfflinePost / ResetPost / EnqueueOfflinePost / QueueGet`. The spec assumes these stay stable; if the OpenAPI generation drops one, the panel fails closed.
- The existing `/devices` page (`DevicesHealthPage`) already renders the device list via `DeviceHealthService`. The simulator section is added to the same page, not as a new route or new feature folder split.
- The Web SPA gate (per `AGENTS.POLICY.md`) is mandatory for any change under `src/Web/ControlEasyReborn.Web/**`. This spec inherits that requirement as a hard precondition for "done".
- The local CI gate (per `AGENTS.POLICY.md`) is mandatory: `scripts/verify-ci-local.sh --fast` per turn, `scripts/verify-ci-local.sh` on completion.
- Worktree rule applies: this work lands on `feat/device-simulator-ui` in `.worktrees/feat-device-simulator-ui/`, never on `main` directly.
- Synthetic-data invariant applies: every seed id, fixture value, and Playwright `expect.toHaveText` payload uses synthetic identifiers.
- The integration test in `tests/.../Devices/SimulatorHarnessTests.cs` is the behavioral reference for what the panel must reproduce. Any deviation between panel behavior and that test is treated as a defect.

## Out of Scope

- New backend endpoints or new failure modes.
- A standalone `/devices/simulator` route or a separate feature module.
- A "developer mode" toggle in the UI to override the inspector gate (the backend is already the source of truth; UI mirrors it).
- Visual changes to the existing device health table beyond adding the simulator section beneath or beside it.
- Logging, audit, or replay of the user's own simulator actions (i.e., who toggled `Always AuthFailed` and when). The panel's own actions are not themselves audit-logged.
- Internationalization beyond English; Portuguese copy lives in a later phase.

## Open Questions — Resolved

1. **Role gating (resolved)**: TenantAdmin + Porteiro + PlatformAdmin. The simulator panel reuses the existing `porteiroGuard` on `/devices` (which already permits those three via `DevicesUnlock` / `DevicesRead` permission tokens). No new guard is introduced. Test personas in Playwright MUST cover at least one of these three.
2. **Layout (resolved)**: Inline section beneath the device-health table, **collapsed by default** and expandable per device via a `<details>`-like disclosure. Rationale: in Operate mode the health table is the page's primary content and the simulator is a tool that operates on the table's per-device records; collapsing by default keeps the page calm for visitors who came for the table, and avoids forcing a tab switch when toggling a failure mode and re-reading the table is the natural loop. Tabs on `/devices` would elevate a tool to equal weight with the table, which is the wrong hierarchy. (No new route entry needed; the existing `porteiroGuard` stays in place.)
3. **Pagination (resolved)**: No server-side pagination. The recorded-attempts list is rendered up to a hard cap of **200 entries** (sorted newest-first, dropping the rest with a single "showing most recent 200" footer note). When the in-memory list exceeds 200, the panel truncates client-side. Server-side pagination becomes its own spec if usage grows.

## Architecture Reference *(non-binding — for the implementer)*

This section is informational only. It does not bind requirements; it points the implementer at the patterns already in the codebase so the spec's behavior is implemented in the same style as the rest of the SPA.

- Feature folder: `src/Web/ControlEasyReborn.Web/src/app/features/devices/`. Existing pages: `devices-health.page.ts` (Phase 26 DOOR-13).
- Routing: **no change** to `app.routes.ts`. The simulator section is rendered inside the existing `/devices` route.
- Guard: **reuse** the existing `porteiroGuard` on `/devices`. No new guard.
- Layout: **inline section beneath the device-health table**, collapsed by default via a single page-level disclosure. Per-device controls appear when the section is expanded.
- API wrapper: extend the existing `src/.../features/devices/devices-api.service.ts` with thin methods calling the generated `DevicesInternalService` (`apiV1InternalDevicesDeviceIdSimulatorGet / FailureModePost / OfflinePost / ResetPost / EnqueueOfflinePost / QueueGet`).
- Reactive state: use Angular signals (the page already uses signals for `devices / loading / error / lastRefreshedAtMs`).
- OnPush change detection; standalone components; `ce-` selector prefix; `CeCardComponent`, `CeButtonComponent`, `CeBadgeComponent`, `CeSpinnerComponent`, `CeTooltipDirective` from the existing design system.
- Karma/Jasmine unit tests for the new service and component (mirror the existing `device-health.service.spec.ts` and `devices-health.page.spec.ts`).
- Playwright E2E test under `src/Web/ControlEasyReborn.Web/e2e/device-simulator-ui.spec.ts`, using the existing `e2e/helpers/demo-auth.ts` and the existing dev stack (`baseURL: https://localhost:8443`, `ignoreHTTPSErrors: true`). Test personas MUST cover at least one of {TenantAdmin, Porteiro, PlatformAdmin}.
- Env gate detection: read a single boolean from `environments/environment.ts` (or compute on app boot by issuing a `GET /api/v1/_internal/devices/00000000-0000-0000-0000-000000000001/simulator` — non-2xx means hidden).

## Verification Plan

This spec is considered "done" only when all of the following are true:

1. `scripts/verify-ci-local.sh --fast` exits 0 on every turn during implementation.
2. `scripts/verify-ci-local.sh` exits 0 at completion.
3. The canonical Web SPA gate (per `AGENTS.POLICY.md`) runs the Karma/Jasmine suite plus ESLint inside `docker.gitea.com/runner-images:ubuntu-latest` and reports `TOTAL: N SUCCESS` with no `FAILED`.
4. A new Playwright spec `e2e/device-simulator-ui.spec.ts` covers the four scenarios in FR-012 and passes against the running dev stack.
5. A code-review pass returns zero CRITICAL or HIGH findings (per `AGENTS.POLICY.md` Pre-commit adversarial review).
6. No real user data appears in any new fixture or test (per Hard Prohibitions).
7. All tasks land as atomic commits on `feat/device-simulator-ui`, pushed but not merged on `main` (per `AGENTS.WORKTREES.md`).