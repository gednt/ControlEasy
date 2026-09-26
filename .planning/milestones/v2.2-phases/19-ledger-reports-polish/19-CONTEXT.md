# Phase 19: Ledger & Reports Polish — Context

**Gathered:** 2026-09-24
**Status:** Ready for planning
**Source:** Party-mode planning session + v2.2 requirements (`milestones/v2.2-REQUIREMENTS.md`) + v2.1 Phase 16/17 CONTEXT decisions

<domain>
## Phase Boundary

The reports surface tells one honest story — the daily summary, status filters, search, pagination, and package-drop entry all match what the unified ledger backend actually serves. This phase closes five v2.1 tech-debt/partial gaps carried into v2.2, all in the Reports module (backend + reports/audit UI). No new data model. No door/hardware work.

Phase 19 is backend + UI. It builds directly on the post-cleanup entry-log/ledger contract. **Sequencing note (SATISFIED 2026-09-26):** `feat/unified-visits-flow-cleanup` (PR #11, `7a5eb35`) and `fix/gatehouse-direction-persistence` (PR #10, `0d8f96a`) have landed on `main` — the ledger/entry-log area vocabulary this phase touches matches the post-cleanup contract, which is now the shipped `main` state.
</domain>

<decisions>
## Implementation Decisions

### LEDGER-01 — Tenant day-bucketing (INFRA-02 closeout)
- `GetVisitCountsByDayAsync` MUST bucket visit counts by the tenant's local day boundary, NOT raw UTC. Use the existing `TenantDayBoundary` helper (`src/Modules/Reports/.../Application/Time/TenantDayBoundary.cs`) already used by the ledger read model.
- Default tenant timezone `America/Sao_Paulo` until a per-tenant timezone setting exists (settled v2.1). No per-tenant timezone config this phase.

### LEDGER-02 — Honest status filter vocabulary
- The ledger status filter must offer ONLY statuses the backend can actually return. Inert 'Recorded'/'Refused' options must be removed.
- Selecting any offered option returns real rows or a correct empty state.

### LEDGER-03 — Honest search scope
- Ledger search placeholder must promise only what backend `q` covers (PackageDescription / SubjectName / Purpose). Either align placeholder wording to backend scope, OR extend backend `q` scope to match the promise. No other scope change.

### LEDGER-04 — Condominium-level package drops
- Package-drop UI must allow registering a condominium-level drop (`DestinationApartmentId` omitted), not only apartment-bound drops. Backend already supports omitting the apartment (v2.1 VISIT-06/07 / Phase 16 Package Delivery Model). UI must surface the trigger.

### LEDGER-05 — X-Total-Count exposure
- `X-Total-Count` header is already SET on `GET /api/v1/reports/history` (`ReportEndpoints.cs` line 49) but NOT exposed to non-same-origin consumers. Add `WithExposedHeaders("X-Total-Count")` (or equivalent CORS exposure) so pagination totals work beyond the SPA origin.

### the agent's Discretion
- Whether LEDGER-03 resolves by aligning placeholder text vs. extending backend `q` scope (choose the lower-risk option that satisfies "honest").
- Exact UI wording for the condominium-level package-drop trigger.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/Modules/Reports/.../Api/Endpoints/ReportEndpoints.cs` — `GET /api/v1/reports/visit-counts-by-day`, `/history`, `/residents-per-apartment`; `/history` sets `X-Total-Count` header at line 49 (no `WithExposedHeaders`).
- `src/Modules/Reports/.../Application/Time/TenantDayBoundary.cs` — tenant day-boundary helper (the correct bucketing source for LEDGER-01).
- `src/Modules/Reports/.../Application/Handlers/GetVisitCountsByDayHandler.cs` — delegates to `IReportReadRepository.GetVisitCountsByDayAsync` (raw-UTC today).
- `src/Modules/Reports/.../Infrastructure/Persistence/ReportReadRepository.cs` — unified ledger UNION read model (Visits + visitor AccessEvents + legacy entry-log segment).
- `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.ts` — reports UI (status filter, search, pagination, package-drop surface).

### Established Patterns
- DBTools `Linq<TModel>` / `IAsyncSqlClient` via `ITenantAwareLinqFactory`; no EF Core (ADR 0002).
- Minimal API endpoints; scoped handler services (no MediatR); Mapster; FluentValidation.
- ProblemDetails (RFC 7807); Serilog structured logging.
- Angular standalone components, OnPush, signals, `ce-` prefix.

</code_context>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/milestones/v2.2-REQUIREMENTS.md` — LEDGER-01..05 definitions
- `.planning/ROADMAP.md` — Phase 19 goal + success criteria

### Prior phase decisions (the settled ledger contract)
- `.planning/milestones/v2.1-phases/16-visits-unification-backend/16-CONTEXT.md` — Unified Ledger Read Model, Package Delivery Model, day-boundary decision
- `.planning/milestones/v2.1-phases/17-gatehouse-panel-reports-page/17-CONTEXT.md` — reports page scope (PANEL-04/05)

### Source of truth
- `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/TESTING.md`
- `AGENTS.md` (project policy: no EF Core, DBTools only, tenant isolation via ITenantAwareLinqFactory, ProblemDetails, Serilog)

</canonical_refs>

<deferred>
## Deferred Ideas

- Per-tenant timezone configuration setting (v2.1 grey-area; still not in scope — use America/Sao_Paulo default).
- Carrier lookup table / normalized carrier catalog.
- Door integration, badge printing, biometrics — other milestones.

</deferred>

---

*Phase: 19-ledger-reports-polish*
*Context gathered: 2026-09-24 via party-mode planning + v2.2 requirements*
