# Phase 24: Device Administration & Tenant Opt-In — UI Spec

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Phase:** 24 — Device Administration & Tenant Opt-In
**Requirements:** DOOR-05, DOOR-06
**Surfaces:** `/administration` page (extended section)

---

## Surface 1: `/administration` — Door Integration section

### Page context

- **Route:** `/administration` (existing page, extended; no new route)
- **Guard:** TenantAdmin role only (existing guard already enforces; section visibility is conditional, not guard-gated)
- **Page-level info already in place:** Page header (`<ce-page-header>`), "Staff Management" section above, "Tenant settings" section below. The new "Door Integration" section inserts between Staff Management and Tenant settings.

### Section: Door Integration — opt-in toggle

```
┌─ ce-card ──────────────────────────────────────────────────────────────┐
│ Door Integration                                      [status badge]  │
│                                                                      │
│ ControlEasy can trigger door relays and ingest card-reader events     │
│ from physical devices installed at your entrances. When enabled,      │
│ every API-triggered unlock is HMAC-signed, rate-limited, and audited.  │
│                                                                      │
│ ┌─ Toggle row ───────────────────────────────────────────────────┐    │
│ │ Enable door integration            [ ◯  OFF / ●  ON   ]   ⓘ   │    │
│ └────────────────────────────────────────────────────────────────┘    │
│                                                                      │
│ Last changed: 2 days ago by Carlos Souza                               │
└──────────────────────────────────────────────────────────────────┘
```

- `<ce-switch>` (existing primitive in `src/app/design-system/components/switch/`) bound to `doorIntegrationEnabled` signal. The toggle fires `PUT /api/v1/tenants/current/door-integration` on change; on success, an `aria-live="polite"` toast says "Door integration enabled" / "Door integration disabled". On 4xx/5xx, a `<ce-alert-error>` appears below the toggle with the ProblemDetails `detail` message.
- The "Last changed" line is hidden when the flag has never been changed.
- `[status badge]` in the card title shows `Online` (green) when enabled, `Offline` (neutral) when disabled.
- The info ⓘ icon opens a tooltip with the security-bar summary ("HMAC-signed commands, replay-protected, audited").

### Section: Door Integration — device list (visible only when enabled)

```
┌─ ce-card ──────────────────────────────────────────────────────────────┐
│ Devices                                          [+ Register device] │
│                                                                      │
│ Vendor       Type      Gatehouse     Status    Last modified   •••   │
│ ─────────────────────────────────────────────────────────────────────  │
│ Control iD   reader    Portaria A    ● Active  2h ago      [Edit]    │
│ Control iD   reader    Portaria B    ● Active  2h ago      [Edit]    │
│ Intelbras    control   Portaria A    ○ Inactive 3d ago     [Edit]    │
│                                                                      │
│ (table ends — empty state if no devices)                              │
└──────────────────────────────────────────────────────────────────┘
```

- The table uses the existing `<ce-table>` primitive with the columns above. The `Type` column shows a `<ce-badge tone="neutral" size="sm">{{ deviceType | titlecase }}</ce-badge>`. The `Status` column shows `<ce-badge tone="success" size="sm" *ngIf="device.isActive">Active</ce-badge>` / `<ce-badge tone="neutral" size="sm" *ngIf="!device.isActive">Inactive</ce-badge>`. The `•••` overflow menu opens a `<ce-menu>` with `Edit`, `Activate`/`Deactivate`, `Remove` actions.
- The empty state renders a single line: "No devices registered yet. Click **Register device** to add your first door device."
- The "+ Register device" button is `<ce-button variant="primary" size="md">` (existing primitive). It opens `DeviceFormModalComponent` in register mode.
- The `Edit` overflow action opens the same modal in edit mode, pre-populated with the device's current vendor/gatehouse/type, with the connection-params field showing "Re-enter to change" placeholder (NOT a placeholder for the secret — it's a literal instruction).
- The `Activate`/`Deactivate` action calls `PUT /devices/{id}/activation`. On success, the row updates in place; on failure, a `<ce-toast tone="danger">` appears.
- The `Remove` action opens a confirmation modal (existing `<ce-modal>` with `title="Remove this device?"`, body "This will mark the device as removed. Historical unlock events stay on file."). The confirm button is `<ce-button variant="danger">Remove</ce-button>`. On confirm, `DELETE /devices/{id}` fires; the row animates out via the existing list-removal CSS class.

### Section: Door Integration — disabled state (when flag is OFF)

```
┌─ ce-card ──────────────────────────────────────────────────────────────┐
│ Door Integration                                  [OFFLINE badge]    │
│                                                                      │
│ Door integration is currently disabled for your condominium.          │
│                                                                      │
│ Turn on door integration above to manage devices.                     │
└──────────────────────────────────────────────────────────────────┘
```

- This card replaces both the toggle's effect and the device list. Only the toggle (at the top of the section) and this explanatory card are visible. The toggle IS visible so they can flip the flag on.

### Modal: DeviceFormModalComponent

```
┌─ ce-modal (md width) ──────────────────────────────────────────────────┐
│ Register device                                          [× close]    │
│                                                                      │
│ Type *                                                              │
│ [ Reader  |  Controller ]    (locked when editing)                   │
│                                                                      │
│ Vendor *                                                            │
│ [ Generic                    ▾ ]                                     │
│                                                                      │
│ Gatehouse *                                                         │
│ [ Portaria A — Main entrance ▾ ]                                     │
│                                                                      │
│ Connection parameters *                                             │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │  Enter as JSON.  Entered once. Cannot be retrieved.            │   │
│ │  Re-enter to change.                                          │   │
│ │  ┌──────────────────────────────────────────────────────────┐ │   │
│ │  │ {                                                        │ │   │
│ │  │   "endpoint": "https://device.example.com/api",          │ │   │
│ │  │   "apiKey": "..."                                        │ │   │
│ │  │ }                                                        │ │   │
│ │  └──────────────────────────────────────────────────────────┘ │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ⚠  Connection parameters are encrypted at rest and never shown again.│
│                                                                      │
│                                              [ Cancel ]  [ Register ] │
└──────────────────────────────────────────────────────────────────┘
```

- The vendor field is a `<ce-select>` with the well-known enum literals: `Generic`, `Control iD`, `Intelbras`, `Hikvision`, `Other`. Selecting `Other` reveals a free-text `<ce-input>` for "Vendor name (custom)". The vendor value is normalized server-side to the lowercase enum token.
- The gatehouse field is a `<ce-select>` populated from `GET /api/v1/gatehouses?tenantId=current` (existing endpoint). Required.
- The connection-params field is a `<ce-textarea>` with 6 rows, monospace font, `placeholder='{\n  "endpoint": "..."\n}'`. A live JSON-validity indicator (✓ green / ✗ red) sits below the textarea. Submit is disabled while invalid.
- The `Register` / `Save changes` button is `<ce-button variant="primary" size="md" [loading]="saving()" [disabled]="form.invalid || saving()">`. On submit, the success toast says "Device registered" / "Changes saved". On 4xx/5xx, a `<ce-alert-error>` appears inside the modal with the ProblemDetails `detail`.
- `Cancel` closes the modal without confirmation (no dirty-state guard — the user is in control).

### Permission visibility

| Actor | Door Integration section |
|-------|-------------------------|
| TenantAdmin | Visible. Full CRUD on devices + flag toggle. |
| Porteiro | Visible (read-only). Section shows the toggle (read-only badge) and the device list (no Register/Edit/Remove actions). |
| PlatformAdmin | NOT visible — this is per-tenant configuration, not platform-level. |
| Resident (post-v2.4) | NOT visible — residents don't manage hardware. |

### Empty / Loading / Error states (table)

- **Loading:** A `<ce-spinner size="md">` centered in the card body, with `aria-busy="true"`.
- **Empty:** Single line: "No devices registered yet. Click **Register device** to add your first door device." The `Register device` button is still visible.
- **Error:** `<ce-alert-error>` with the ProblemDetails `detail` + a "Retry" `<ce-button variant="secondary" size="sm">`. Loading state of the table is reset so the retry can re-fire.

### Accessibility

- All form fields use `<label for>` linkage (the existing `ce-input`/`ce-select`/`ce-textarea` handle this).
- The toggle is keyboard-operable: `Tab` focuses the switch, `Space` toggles. The `aria-checked` attribute is bound to the flag.
- The modal traps focus (existing `ce-modal` behavior). On open, focus moves to the Type select. On close, focus returns to the trigger button.
- All buttons and links have visible focus outlines matching the design system (`:focus-visible` ring).
- Color is never the sole carrier — Active/Inactive badges always include text. The status badge in the card title always includes text.
- The overflow menu uses `aria-haspopup="menu"` and `aria-expanded`. Keyboard navigation: ↑↓ to move, Enter to activate, Esc to close.

### Responsive behavior

- ≥1024px: section is full width below the existing Staff Management section.
- 768px–1023px: section is full width; the table becomes scrollable horizontally (`overflow-x: auto`) instead of wrapping.
- <768px: same as tablet; the modal becomes full-screen via the existing `<ce-modal size="full">` variant for narrow viewports.

### Dark theme

- The section inherits the design system's dark-theme tokens via `data-theme="dark"` on the root. No component-specific theme overrides needed.
- The status badges' `success` tone stays vivid in dark mode (existing `ce-badge` palette).

### Design-system conformance

- **No new components invented.** Every primitive used (`ce-card`, `ce-switch`, `ce-table`, `ce-badge`, `ce-button`, `ce-modal`, `ce-input`, `ce-select`, `ce-textarea`, `ce-alert-error`, `ce-alert-note`, `ce-spinner`, `ce-menu`, `ce-toast`) already exists in `src/app/design-system/components/`.
- **Page-only CSS lives in the page's `styles` array**, not in the design-system barrel. No `.ce-*` rules duplicated in the page; the residents page is the reference.
- **No Unicode decimal-entity glyph icons.** All icons render via `<ce-icon>` (Lucide). The info ⓘ in the toggle row uses `<ce-icon name="info" />`. The `+` on the Register button uses `<ce-icon name="plus" />`. The overflow trigger uses `<ce-icon name="more-horizontal" />`.
- **Mockup parity** is design-system conformance only — there is no `mockup/administration.html` (and Phase 22's parity work did not add one; see STATE.md decision "No `mockup/administration.html` exists").

### File plan

- `src/Web/ControlEasyReborn.Web/src/app/features/administration/administration.page.ts` — extend with a new `<section data-test="door-integration">` block. Reuses existing imports from `design-system/index.ts`. New additions to the imports list: `CeSwitchComponent`, `CeMenuComponent`.
- `src/Web/ControlEasyReborn.Web/src/app/features/administration/administration.page.spec.ts` — extend existing spec with 4 cases: toggle disabled shows opt-in card only; toggle enabled shows device list; gatehouse dropdown populates from API; register-modal-open emits the right event.
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-api.service.ts` — add `toggleDoorIntegration(enabled)`, `register(request)`, `update(deviceId, request)`, `setActivation(deviceId, isActive)`, `remove(deviceId)` methods (Phase 23 already created the file with `unlock`/`list`/`get` — this phase extends it).
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/components/device-form-modal.component.ts` — new standalone component (no routing in the page; the modal is opened imperatively from the page).
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/components/device-form-modal.component.spec.ts` — 8 unit tests (valid/invalid types, vendor selection, JSON validity, gatehouse required, submit success + error path, cancel closes).
- `src/Web/ControlEasyReborn.Web/tests/visual/administration.spec.ts` — new Playwright visual snapshot (light + dark at desktop).
- `src/Web/ControlEasyReborn.Web/tests/a11y/administration.spec.ts` — new Axe a11y scan of `/administration` (covers the new section's accessibility contract).
- `src/Web/ControlEasyReborn.Web/tests/visual/administration-doors-disabled.spec.ts` — visual snapshot of the section in its disabled state (when `DoorIntegrationEnabled=false`).