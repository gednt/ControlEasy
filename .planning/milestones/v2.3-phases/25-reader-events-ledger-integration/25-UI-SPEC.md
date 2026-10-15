# Phase 25: Reader Events & Ledger Integration — UI Spec

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Phase:** 25 — Reader Events & Ledger Integration
**Requirements:** DOOR-08, DOOR-09, DOOR-10, DOOR-11
**Surfaces:** None (read-events ingestion is invisible; no UI in Phase 25)

---

## Decision: No new UI surfaces

Phase 25 is a backend-only phase. There is no UI work to design or implement.

### Rationale

- Reader events arrive asynchronously from devices. There is no operator who "watches" individual events in real time — the value is in the durable ledger rows (Visit + AccessEvent / RefusedScanAttempt) that downstream features (gatehouse panel, reports, consent audit) already consume.
- Adding a "live event feed" page would be premature — operators have no action to take on individual events. The ledger surfaces (entry-log page, reports) are the right place to see the aggregated effect.
- The dev-only `SimulatorInspectorEndpoints` already exposes a peek endpoint for integration tests (`GET /api/v1/_internal/devices/{deviceId}/simulator`); this is the only read-event surface and it stays dev-only.

### Deferred to a future phase (NOT in v2.3)

- A "device events log" admin page that shows recent `device_events` rows with their `resultCode`. Candidates: a future milestone that bundles "device observability" (post-v2.5), OR a Phase 26 extension if the health dashboard naturally subsumes it.
- An event-replay UI for support engineers. Today this is done via SQL + the `_internal` endpoints.

### File plan (none — UI)

No new Angular files in Phase 25. The only TypeScript changes are:
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-api.service.ts` — add `ingestEvent(deviceId, payload)` and `listEvents(deviceId, since, limit)` methods (consumed by integration tests + future admin pages). Not yet wired into any page component.
- `src/Web/ControlEasyReborn.Web/openapi.json` — regenerated to pick up the two new endpoints.