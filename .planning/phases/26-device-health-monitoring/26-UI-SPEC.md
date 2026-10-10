# Phase 26: Device Health Monitoring — UI Spec

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Phase:** 26 — Device Health Monitoring
**Requirements:** DOOR-12, DOOR-13, DOOR-14
**Surfaces:** `/devices` (new page), `/gatehouse-panel` (toast injection)

---

## Surface 1: `/devices` — Device Health Dashboard

### Page context

- **Route:** `/devices` (new)
- **Guard:** TenantAdmin OR Porteiro role (any authenticated tenant user)
- **Page-level info:** New `<ce-page-header>` at the top. No existing nav for this page — added to the nav (see Nav Updates below).

### Layout (desktop, ≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Device health                                            [⟳ Refresh]  │
│  Last refreshed: 14s ago · Auto-refresh every 30s                       │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌─ ce-card ────────────────────────────────────────────────────────┐   │
│  │  Vendor      Type      Gatehouse    Status      Last hb    …      │   │
│  │  ──────────────────────────────────────────────────────────────   │   │
│  │  Control iD  reader    Portaria A   ● Online    2s ago     cfg    │   │
│  │  Control iD  reader    Portaria B   ⚠ Degraded  4s ago     cfg    │   │
│  │  Intelbras   control   Portaria A   ○ Offline   2m ago     cfg    │   │
│  │  ──────────────────────────────────────────────────────────────   │   │
│  │  (table ends — empty state if no devices)                          │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

- The page header sits in a `<ce-page-header>` with the title `Device health`, an optional subtitle "Devices currently registered to your condominium", and a `<ce-button variant="secondary" size="sm">Refresh</ce-button>` that triggers a manual reload.
- Below the header is a small `<p class="text-secondary text-sm">Last refreshed: {relativeTime} · Auto-refresh every 30s</p>` line so the user knows the polling cadence.
- The card uses `<ce-table>` with the columns: `Vendor`, `Type`, `Gatehouse`, `Status`, `Last heartbeat`, `Error rate`, `Offline threshold`, `Actions`.
- `Status` is rendered as `<ce-badge>` with text always included:
  - `online` → `<ce-badge tone="success" size="sm">Online</ce-badge>`
  - `degraded` → `<ce-badge tone="warning" size="sm">Degraded</ce-badge>` (verify `warning` tone exists; add to `CeBadgeTone` if missing — design-system extension, not a new component)
  - `offline` → `<ce-badge tone="danger" size="sm">Offline</ce-badge>`
- `Last heartbeat` shows a `<ce-tooltip>` with the absolute UTC timestamp + relative time. Example: `<span title="2026-10-10 14:23:11 UTC">2s ago</span>`.
- `Error rate` shows `{errorCount} / {events} = {pct}%`. If `events=0`, renders a `—` placeholder.
- `Offline threshold` shows `{offlineAfterSeconds}s`.
- `Actions` column has `<ce-button variant="ghost" size="sm" [disabled]="true" [attr.aria-label]="'Configure thresholds for {vendor} device'">Configure</ce-button>`. Disabled with `<ce-tooltip>Per-device threshold override ships in a future phase.</ce-tooltip>` — visible but inert.
- The table rows zebra-stripe on hover (`ce-table` built-in).

### Empty state

```
┌─ ce-card ──────────────────────────────────────────────────────────────┐
│                                                                      │
│                No devices registered yet.                             │
│                                                                      │
│   Devices appear here once you register one from                     │
│   administration → Door Integration.                                  │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

- Single centered message. The link to administration is a `<a routerLink="/administration">` styled with the design-system link variant. (Only shown to TenantAdmin; for Porteiro, the message drops the link and just says "No devices registered yet.")

### Loading state

- `<ce-spinner size="md">` centered in the card body, with `aria-busy="true"` on the card and `aria-label="Loading device health"`. No table renders during loading.

### Error state

- `<ce-alert-error>` with the ProblemDetails `detail` message + a `<ce-button variant="secondary" size="sm">Retry</ce-button>` button. The retry button re-fires the request and clears the error state.

### Responsive behavior

- ≥1024px: full table layout as drawn above.
- 768px–1023px: table becomes horizontally scrollable (`overflow-x: auto`) without wrapping.
- <768px: same scroll; the `<ce-page-header>` collapses the subtitle; the auto-refresh hint stays visible.

### Dark theme

- Inherits design-system dark tokens. Status badges stay vivid in dark mode.

### Polling lifecycle

- On page mount, the page kicks off `DeviceHealthService.startPolling()`. The service maintains a `BehaviorSubject<DeviceHealthSnapshot>` with the latest snapshot. The page renders reactively from the observable.
- The service auto-stops on page navigation away (`takeUntilDestroyed(this.destroyer)` Angular pattern).
- Manual `Refresh` calls `service.refreshNow()` which forces an immediate fetch + resets the polling timer.
- On HTTP error, the service keeps the LAST KNOWN snapshot (no flicker) but surfaces the error so the page can show the error state. After 3 consecutive errors, the service pauses polling for 60 seconds (back-off), then resumes.

### Accessibility

- The Status badge's color is paired with text — color is never the sole carrier.
- The table's `<thead>` has `<th scope="col">` for each column.
- The page's `<h1>` is the `<ce-page-header>` title (set via the component's `aria-labelledby`).
- The Refresh button is keyboard-operable. The auto-refresh behavior is announced via an `aria-live="polite"` region: "Device health refreshed at {time}".
- Color contrast for all status badges meets WCAG AA (existing `ce-badge` palette meets this).

---

## Surface 2: `/gatehouse-panel` — Offline Alert Toast

### Inject point

- The gatehouse panel page (`src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts`) is extended with a `DeviceHealthService` injection and a subscription that yields a "transient alert" signal.
- The toast appears at the top of the page, ABOVE the existing `<ce-page-header>`, inside a wrapper `<div data-test="device-offline-toast">`.

### Visual

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ⚠  Device offline — Control iD at Portaria A hasn't checked in for    │
│     2 minutes. Entries should still be created manually until the      │
│     device is online.                                      [Dismiss ×]   │
├──────────────────────────────────────────────────────────────────────────┤
│  (gatehouse panel page content)                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

- The toast uses the existing `<ce-toast tone="warning" [dismissible]="true" auto-dismiss="8000">` primitive (verify the `warning` tone exists on `ce-toast`; if not, add it to the toast component's tone enum).
- The body lists the FIRST offline device only (even if multiple are offline — the toast is a single-item alert; the dashboard is the place to see all). If multiple go offline in the same poll cycle, the toast shows the most recently transitioned one.
- The `Dismiss ×` button closes the toast locally. The toast stays dismissed until a NEW transition fires (a device that was offline returns to online and then goes offline again — the toast fires anew).
- The toast is `aria-live="polite"` so screen readers announce it without interrupting the user.

### Transition detection

- `DeviceHealthService` keeps `currentSnapshot` + `previousSnapshot`. On every poll:
  1. For each device, compare `previous.status` with `current.status`.
  2. If `online → offline` edge: record this device as a new transition in `pendingAlerts$`.
  3. If a device was in `pendingAlerts$` AND `current.status == online`, clear it from pending.
- The page subscribes to `pendingAlerts$` and shows a toast for each entry (one at a time).

### Polling lifecycle

- The gatehouse panel kicks off `DeviceHealthService.startPolling()` on page mount IF the user is a Porteiro (TenantAdmin uses the dashboard page instead). The service is shared across both pages — it deduplicates polling if both pages mount concurrently (Singleton service with a `subscribe()` pattern that maintains one underlying poll).

---

## Nav Updates

The existing nav component (verify — likely in `src/Web/ControlEasyReborn.Web/src/app/layout/sidebar.component.ts` or similar) gets one new entry:

```
<ce-nav-item
  routerLink="/devices"
  iconName="activity"
  label="Device health"
  [visible]="(user | devicesHasRole).matches(['TenantAdmin','Porteiro'])"
/>
```

Placed under the existing "Gatehouse panel" item. Same icon-size treatment as the existing items.

---

## Permission visibility

| Actor | `/devices` page | `/gatehouse-panel` offline toast |
|-------|-----------------|----------------------------------|
| TenantAdmin | Visible | Visible (passive; they see it in the dashboard anyway) |
| Porteiro | Visible | Visible (primary alert mechanism) |
| PlatformAdmin | NOT visible — per-tenant hardware | NOT visible |
| Resident (post-v2.4) | NOT visible | NOT visible |

---

## Design-system conformance

- **No new components invented.** Every primitive used (`ce-page-header`, `ce-card`, `ce-table`, `ce-badge`, `ce-button`, `ce-icon`, `ce-spinner`, `ce-alert-error`, `ce-toast`, `ce-tooltip`) already exists.
- **Two design-system extensions** (NOT new components — extending existing enums):
  - Add `warning` tone to `CeBadgeTone` if not present. (Verify the existing palette; the existing `warning` palette is used for consents — extending is fine.)
  - Add `warning` tone to `CeToastTone` if not present.
- **Page-only CSS** lives in the page's `styles` array. No hand-rolled ce-* CSS.
- **No Unicode decimal-entity glyph icons.** All icons via `<ce-icon>` (Lucide). The `⟳` in the refresh button uses `<ce-icon name="refresh-cw" />`. The `⚠` in the offline toast uses `<ce-icon name="alert-triangle" />`.

---

## File plan

- `src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-health.page.ts` — new standalone page component.
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-health.page.spec.ts` — new spec with 6 cases.
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/device-health.service.ts` — new singleton Angular service (polling + transition detection).
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/device-health.service.spec.ts` — new spec with 8 cases.
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/index.ts` — extend with `devices-health.page` export.
- `src/Web/ControlEasyReborn.Web/src/app/app.routes.ts` — add `/devices` route (verify the routes file).
- `src/Web/ControlEasyReborn.Web/src/app/layout/sidebar.component.ts` (or equivalent) — add the `Device health` nav item.
- `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts` — inject `DeviceHealthService`, render the offline-toast wrapper.
- `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.spec.ts` — extend with 3 cases for the toast behavior.
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/badge/badge.types.ts` (or equivalent) — add `warning` tone if missing.
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/toast/toast.component.ts` — add `warning` tone if missing.
- `src/Web/ControlEasyReborn.Web/src/app/design-system/index.ts` — extend if any new exports needed.
- `src/Web/ControlEasyReborn.Web/tests/visual/devices-health.spec.ts` — Playwright snapshot of `/devices` with devices in mixed statuses (online + degraded + offline), light + dark themes at desktop.
- `src/Web/ControlEasyReborn.Web/tests/visual/gatehouse-offline-toast.spec.ts` — Playwright snapshot of the offline toast appearance (with one device in offline status).
- `src/Web/ControlEasyReborn.Web/tests/a11y/devices-health.spec.ts` — Axe scan of `/devices`.