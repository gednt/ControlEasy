# Phase 16: Visits Unification Backend - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The gatehouse visit record is single-sourced — every visitor arrival (QR scan, manual lookup, walk-in) produces or advances a Visit row, and the backend serves one honest chronological ledger stream (`GET /api/v1/reports/history`) without double-counting. Backend-only phase: writes fold into Visits, entry-log is re-scoped to its privacy-consent audit role with legacy rows preserved read-only below a cutoff, package drops become AccessEvents `PackageDrop` kind rows. No frontend UI in this phase (Phase 17 consumes the settled API shapes).

</domain>

<decisions>
## Implementation Decisions

### Visitor Identity for Unmatched QR Scans
- Unmatched visitor QR scan uses the credential's registered visitor profile (name/document from the scan payload) for the new Visit row
- Repeated scans by the same visitor are idempotent: a re-scan while the visitor's latest Visit is still `CheckedIn` is a no-op (no duplicate Visit); a new Visit is created only after the previous one is `CheckedOut`
- Destination policy: enter-visits keep the existing required destination resolution (ACCESS-05 snapshot); visits for a service within the condominium get destination marked CONDOMINIUM; package drops are NOT visits
- The QR-created Visit backfills document/apartment fields from the resolved visitor profile so manual-lookup dedupe can find it later

### Walk-in & Entry-Log Re-scope
- Walk-in via `POST /api/v1/visits` with `CheckInNow: true` lands directly `CheckedIn` (person is physically present at the gate)
- `POST /api/v1/entry-log` gets a contract re-shape: walk-in fields removed from the DTO entirely; the endpoint keeps consent/audit writes only (privacy-consent role)
- Ledger cutoff for legacy ConsentAuditLog walk-in rows is a build constant (compile-time constant in ReportReadRepository)
- One shared visitor check-in handler/service used by QR scan, manual lookup, and walk-in registration — single source of truth for dedupe and status transitions

### Unified Ledger Read Model
- New endpoint `GET /api/v1/reports/history` with server-side pagination (`page`/`pageSize`, X-Total-Count header pattern already used in the codebase)
- Single SQL UNION in `ReportReadRepository` with explicit `tenant_id = @p0` per branch (never let TenantFilterInterceptor splice into a UNION)
- Per-row shape: `kind` discriminator (`visit` / `access-event` / `legacy-entry-log`), native state stamp (VisitStatus for visits, AccessDecision for events, consent status for legacy), `source` origin label, millisecond-precision timestamps; refused scans and security events stay in their native decision state — never coerced into Visit status enums
- Shared tenant-local day-boundary helper (per-tenant timezone) used by both ledger and reports; default timezone `America/Sao_Paulo` until a per-tenant timezone setting exists

### Package Delivery Model
- Package drops are recorded as AccessEvents with a `PackageDrop` kind/discriminator carrying `PackageDescription` (free text) + `PackageCarrierCode` (structured code) — no Visit row
- Apartment-bound packages record which apartment the package goes to: a `PackageDrop` AccessEvent for an apartment carries the destination apartment (immutable destination snapshot fields, same pattern as other AccessEvents); condominium-level drops (e.g., mail room / reception shelf) omit it
- Carrier code: free-form string code with a suggested dropdown list (Correios, Sedex, Jadlog, Loggi, Outro) on the UI in Phase 17; backend stores the code string — no lookup table this phase
- Gatehouse operator registers a package drop via the registration path recording an AccessEvent directly — no apartment destination REQUIRED, but recorded when the package is for an apartment
- Filtering: ledger filter `carrierCode=<code>` on `/api/v1/reports/history` (server-side) plus free-text search matching description; apartment-bound package rows are also filterable by apartment

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RecordAccessScanHandler.cs`, `LookupSubjectHandler.cs`, `RecordManualAccessHandler.cs` (AccessControl Application) — scan/manual paths already exist and `LookupSubjectHandler` already searches Pending visits
- `AccessEventDestinationResolver` (AccessControl Application) — destination resolution incl. `ResolveVisitorAsync` via `IVisitDirectory`
- `Visit` entity + `VisitStatus` state machine (Pending→CheckedIn→CheckedOut, Cancelled blocked after CheckedOut/Cancelled) with `CheckIn`/`CheckOut`/`Cancel` methods
- `CreateVisitHandler` + `VisitEndpoints.cs` — visit creation endpoint to extend with `CheckInNow`
- `ReportReadRepository.cs` — existing ledger read model (Visits + ConsentAuditLog UNION pattern) to extend with AccessEvents and PackageDrop
- `IVisitDirectory.CheckInAsync` — existing cross-module check-in abstraction

### Established Patterns
- DBTools `Linq<TModel>` / `IAsyncSqlClient` via `ITenantAwareLinqFactory`; no EF Core
- Minimal API endpoints, scoped handler services (no MediatR), Mapster mapping, FluentValidation
- ProblemDetails (RFC 7807) with `NotFoundException`/`ValidationException`/`ConflictException`
- Serilog structured logging with tenant/subject context and redaction arch tests
- Append-only triggers on audit tables (ConsentAuditLog) — no backfill mutation
- Migration pattern: ordered SQL files under `docker/mysql/init/`

### Integration Points
- `POST /api/v1/access-events/scans` (RecordAccessScanHandler) — must create/check-in Visit rows for visitor subjects
- `POST /api/v1/entry-log` — contract re-shape (consent writes only)
- `POST /api/v1/visits` — add `CheckInNow` walk-in support
- `GET /api/v1/dashboard/stats` — legacy ledger consumer; the new `/reports/history` becomes the honest stream
- `docker/mysql/init/` — new migration for Visits index (INFRA-02: `(tenant_id, CreatedAtUtc)`) and AccessEvents package columns

</code_context>

<specifics>
## Specific Ideas

- User-settled model refinement (this discussion): package drops are NOT visits — they are AccessEvents `PackageDrop` rows; this supersedes the VISIT-06/07 reading that package deliveries are Visit rows. Description + carrier code live on AccessEvents and surface on the unified ledger. Apartment-bound packages record the destination apartment.
- Service-in-condominium visits use a designated CONDOMINIUM destination (block/unit value) rather than a concrete apartment.
- Exploration notes: `.planning/notes/integrated-visits-flow.md` (settled decisions 1–5, key files list).
- The write-path fold and read-model rewrite MUST land in the same phase (STATE.md decision) — no double-counting window.

</specifics>

<deferred>
## Deferred Ideas

- Badge printing, webhook/WhatsApp delivery, photo on packages, CPF pre-reg matching, purpose codes feeding day breakdowns, resident visit history, visitor self-check-in (already deferred in REQUIREMENTS.md)
- Per-tenant timezone configuration setting (grey-area flagged for Phase 17 discussion)
- Carrier lookup table / normalized carrier catalog (free-form code string this phase)

</deferred>