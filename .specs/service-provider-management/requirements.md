# Service Provider Management Requirements

## Purpose

Make the Service Providers screen a practical day-to-day management surface, allowing authorized staff to find, update, and disable a registered provider without deleting its audit history.

## User scenarios

### Edit a registered provider

1. An authorized staff member opens **Service Providers**.
2. They select **Edit** on a provider row, update one or more details, and save.
3. The row reflects the returned details and the user receives clear feedback if the save cannot be completed.

### Disable an active provider

1. An authorized staff member selects **Disable** on an active provider.
2. The interface explains that the provider will remain in the records but become inactive.
3. After confirmation, the provider is marked inactive and remains visible in the list.

### Find a provider

1. A staff member filters the list by name, document, company, or service type.
2. They can switch between all, active, and inactive records.

## Functional requirements

- FR-001: The screen SHALL display each provider's identity, contact details, service type, company, and active state.
- FR-002: The screen SHALL let a user search the loaded provider list and filter it by active state.
- FR-003: Only callers with `ServiceProviders.Write` SHALL be authorized by both the API and UI to create and edit providers; name and document are required, while phone, email, service type, and company are optional.
- FR-004: The edit form SHALL prefill every editable provider field and surface save errors without discarding entered values.
- FR-005: Only callers with `ServiceProviders.Write` SHALL be authorized by both the API and UI to disable active providers after an explicit confirmation.
- FR-006: Disabling SHALL preserve the provider record and return the updated inactive record.
- FR-007: The disable operation SHALL be tenant-scoped and idempotent.
- FR-008: Read-only users SHALL be able to browse, search, filter, and view photos but SHALL not see write actions.

## Acceptance criteria

- An edited provider persists after a page refresh and remains in the current tenant only.
- A disabled provider displays as inactive and is excluded from the Active filter.
- Repeating the disable request for an inactive provider succeeds without changing its identity or data.
- A failed create, edit, or disable operation gives the user a recoverable error message.

## Assumptions

- Disable is a soft deactivation; reactivation is out of scope for this request.
- The existing `ServiceProviders.Read` and `ServiceProviders.Write` permissions govern UI affordances.
