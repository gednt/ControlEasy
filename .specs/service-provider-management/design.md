# Service Provider Management Design

## Surface

`/service-providers` is an **Operate** surface. It uses the existing ControlEasy design-system vocabulary and prioritizes quick scanning at the gatehouse or administration desk.

## Interface behavior

- A concise header shows the provider count, refresh action, and an authorized create action.
- A search field and status tabs narrow the locally loaded result set without obscuring inactive records.
- The table uses a responsive wrapper and keeps the most useful details (provider, contact, service/company, state, actions) visible.
- Edit and photo actions use clear text labels. Only active rows expose the destructive disable action.
- Create and edit share a complete, two-column-at-wide / one-column-on-small-screen form.
- Disabling uses a focused confirmation dialog because it changes operational access. The dialog states that the record is retained and cannot be used as active.
- Loading, empty, filtered-empty, form-error, and mutation-in-progress states are represented explicitly.

## API contract

- Existing: `PUT /api/v1/service-providers/{id}` updates provider details.
- Added: `POST /api/v1/service-providers/{id}/deactivate` disables the provider and returns `ServiceProviderResponse`.
- The new endpoint uses the existing tenant-aware repository lookup. A second request is safe and returns the already-inactive provider.

## Accessibility

- Table headers use `scope="col"`; actions have unambiguous labels.
- Form controls have associated labels and inline validation errors.
- Status uses text in addition to color.
- Dialog controls retain the shared modal's focus handling; mutation buttons expose disabled/loading state.
