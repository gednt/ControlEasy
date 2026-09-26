# Phase 19: Ledger & Reports Polish - Research

**Researched:** 2026-09-24
**Domain:** Reports module closeout (ASP.NET Core 8 minimal API + DBTools read model + Angular 18 reports/gatehouse UI). Five carried v2.1 tech-debt gaps, no new data model.
**Confidence:** HIGH (all findings read directly from the repo source; no web-research dependency)

## Summary

Phase 19 is a **closeout phase on existing code**, not greenfield. Every one of the five LEDGER requirements maps to a concrete, already-identified seam in the Reports module (backend) and the reports/gatehouse Angular pages (UI). The backend "unified ledger" read model (`ReportReadRepository.GetHistoryAsync`) is already the honest source: it already day-buckets `from`/`to` via `TenantDayBoundary` (through `GetHistoryHandler`), already exposes a `NativeState` vocabulary that preserves each source row's own enum/string values (never coerced), already scopes search `q` to `PackageDescription`/`SubjectName`/`Purpose`, already supports condominium-level package drops (via `SubjectId = Guid.Empty`), and already sets `X-Total-Count` on `/history`. The five gaps are all **discrepancies between the UI surface and that already-correct backend** — plus one backend-side raw-UTC bucketing bug in the *visit-count summary* path (`GetVisitCountsByDayAsync`) that predates the `TenantDayBoundary` fix and one missing CORS header-exposure line.

**Primary recommendation:** Fix `GetVisitCountsByDayAsync` to bucket by tenant-local day (mirroring `GetHistoryHandler`'s use of `TenantDayBoundary`), align the reports-page status filter + search placeholder to the actual `NativeState`/`q` vocabulary, surface a "condominium-level drop" trigger in the gatehouse package-drop modal (send `SubjectId = Guid.Empty`), and add `WithExposedHeaders("X-Total-Count")` to the `/history` endpoint. No new NuGet/npm packages. No new tables/migrations. No door/hardware work.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tenant-day bucketing (LEDGER-01) | API / Backend (Reports Application `TenantDayBoundary` + Infrastructure `ReportReadRepository`) | — | Bucketing is a server-side timezone concern; the client must not guess the tenant's local midnight. Existing helper lives in the Application layer. |
| Status filter vocabulary (LEDGER-02) | Browser / Client (reports.page.ts) | API / Backend (NativeState source) | The backend already emits honest `NativeState`; the UI must only *offer* values the backend can emit. Backend change is not required. |
| Search scope (LEDGER-03) | Browser / Client (placeholder wording) | API / Backend (`q` SQL) | Lower-risk fix is placeholder alignment; backend `q` scope is already correct (D-03). |
| Condominium-level package drop (LEDGER-04) | Browser / Client (gatehouse-panel.page.ts + gateway-control.service.ts) | API / Backend (AccessControl manual endpoint) | Backend already accepts `SubjectId = Guid.Empty`; the UI never surfaces the trigger. |
| X-Total-Count exposure (LEDGER-05) | API / Backend (ReportEndpoints + CORS) | — | Header is set server-side; exposure is an ASP.NET Core CORS/endpoint concern, not a client concern. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **LEDGER-01 — Tenant day-bucketing (INFRA-02 closeout):** `GetVisitCountsByDayAsync` MUST bucket visit counts by the tenant's local day boundary, NOT raw UTC. Use the existing `TenantDayBoundary` helper (`src/Modules/Reports/.../Application/Time/TenantDayBoundary.cs`) already used by the ledger read model. Default tenant timezone `America/Sao_Paulo` until a per-tenant timezone setting exists (settled v2.1). No per-tenant timezone config this phase.
- **LEDGER-02 — Honest status filter vocabulary:** The ledger status filter must offer ONLY statuses the backend can actually return. Inert 'Recorded'/'Refused' options must be removed. Selecting any offered option returns real rows or a correct empty state.
- **LEDGER-03 — Honest search scope:** Ledger search placeholder must promise only what backend `q` covers (PackageDescription / SubjectName / Purpose). Either align placeholder wording to backend scope, OR extend backend `q` scope to match the promise. No other scope change.
- **LEDGER-04 — Condominium-level package drops:** Package-drop UI must allow registering a condominium-level drop (`DestinationApartmentId` omitted), not only apartment-bound drops. Backend already supports omitting the apartment (v2.1 VISIT-06/07 / Phase 16 Package Delivery Model). UI must surface the trigger.
- **LEDGER-05 — X-Total-Count exposure:** `X-Total-Count` header is already SET on `GET /api/v1/reports/history` (`ReportEndpoints.cs` line 49) but NOT exposed to non-same-origin consumers. Add `WithExposedHeaders("X-Total-Count")` (or equivalent CORS exposure) so pagination totals work beyond the SPA origin.

### the agent's Discretion

- Whether LEDGER-03 resolves by aligning placeholder text vs. extending backend `q` scope (choose the lower-risk option that satisfies "honest").
- Exact UI wording for the condominium-level package-drop trigger.

### Deferred Ideas (OUT OF SCOPE)

- Per-tenant timezone configuration setting (v2.1 grey-area; still not in scope — use America/Sao_Paulo default).
- Carrier lookup table / normalized carrier catalog.
- Door integration, badge printing, biometrics — other milestones.

## Project Constraints (from AGENTS.md)

These directives bind the planner — research must not recommend approaches that contradict them.

- **No EF Core.** DBTools (`Linq<TModel>`, `IAsyncSqlClient`) is the only data-access library. LINQ-first; raw SQL only for stored procs (ADR 0002). *(Phase 19 read-model changes must stay in `ReportReadRepository` using `ITenantAwareLinqFactory`.)*
- **No MediatR.** Handlers registered as scoped services directly (already true for `GetVisitCountsByDayHandler`, `GetHistoryHandler`).
- **No MVC controllers.** Minimal API endpoint classes only.
- **All tenant-scoped reads/writes via `ITenantAwareLinqFactory`.** No cross-tenant data access.
- **`ProblemDetails` (RFC 7807)** for all error responses; domain exceptions `NotFoundException`/`ValidationException`/`ConflictException`.
- **Serilog** structured logging to Console (JSON) + Seq.
- **Synthetic test data only** — never copy real names/documents/contact details into tests, seeders, snapshots, or example payloads.
- **BCrypt cost >= 11** (not relevant to Phase 19, but a standing constraint).
- **C#:** file-scoped namespaces, `sealed` by default, nullable enabled, `TreatWarningsAsErrors=true`, central package versioning, kebab-case plural REST routes.
- **Angular:** standalone components, `OnPush`, signals, `ce-` prefix, ESLint `@angular-eslint/recommended`, Prettier single quotes + 120 cols, strict TS, DTOs generated via `ng-openapi-gen`.
- **Mandatory Local CI Verification Gate:** `scripts/verify-ci-local.sh --fast` per turn; full `scripts/verify-ci-local.sh` at task completion (format, Release build, unit+arch tests, Testcontainers MySQL integration, Angular Docker prod build, OpenAPI drift check).
- **Sequencing note (SATISFIED 2026-09-26):** `feat/unified-visits-flow-cleanup` (PR #11, `7a5eb35`) and `fix/gatehouse-direction-persistence` (PR #10, `0d8f96a`) have landed on `main` — the ledger/entry-log vocabulary this phase touches matches the post-cleanup contract. Verified: the merge touched NO files under `src/Modules/Reports` or `src/Modules/AccessControl` (`git diff HEAD...origin/main` on those paths is empty), so assumption A4 below is confirmed — the seams referenced here are unchanged.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEDGER-01 | Daily visit-count summary bucketed by tenant day, not raw UTC | `GetVisitCountsByDayAsync` (ReportReadRepository.cs:20-42, 163-188) buckets raw UTC; `TenantDayBoundary.GetDayBoundsUtc` (TenantDayBoundary.cs:22-31) is the correct source; `GetHistoryHandler` (GetHistoryHandler.cs:38-48) already uses it. Fix = normalize range + bucket rows via tenant-local date. |
| LEDGER-02 | Status filter offers only backend-returnable statuses; remove inert Recorded/Refused | reports.page.ts:247-254 lists 6 options incl. inert `Recorded`/`Refused`; backend `NativeState` values (ReportReadRepository.cs:249,268,299,318) are VisitStatus (`Pending`/`CheckedIn`/`CheckedOut`/`Cancelled`/`Unknown`), PolicyOutcome (`permit`/`requires_action`/`refused`/`unknown`), failure codes, and legacy EntryState — no `Recorded`/`Refused`. |
| LEDGER-03 | Search placeholder honest vs backend `q` scope | Placeholder (reports.page.ts:234) promises subject/document/destination; backend `q` (ReportReadRepository.cs:471-476) covers only `PackageDescription`/`SubjectName`/`Purpose`. |
| LEDGER-04 | Condominium-level package drop surfaced in UI | Backend already supports `SubjectId = Guid.Empty` → condominium-level drop (RecordManualAccessHandler.cs:189-220, validator AccessControlValidators.cs:57, integration test ReportEndpointTests.cs:219-230); UI requires apartment (gatehouse-panel.page.ts:1145, 1153). |
| LEDGER-05 | X-Total-Count exposed to non-same-origin consumers | Header set at ReportEndpoints.cs:49; no `WithExposedHeaders`; CORS policy (Program.cs:164-173) uses `AllowAnyHeader()` (does NOT expose response headers). |

## Standard Stack

This phase introduces **zero new packages**. All work rides the existing stack.

### Core (already in use — no change)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ASP.NET Core 8 (C# 12) | net8.0 | Minimal API endpoints, CORS | Existing Reports/AccessControl module seams |
| DBTools | 1.4.3 | `Linq<TModel>` / `IAsyncSqlClient` via `ITenantAwareLinqFactory` | Only sanctioned data access (ADR 0002) |
| Angular 18.2 | ~18.2 | Standalone components, signals, OnPush | Existing reports.page.ts / gatehouse-panel.page.ts |
| FluentValidation | 11.9.0 | Command validation | Already governs `RecordManualAccessCommand` |
| ng-openapi-gen | 1.0.5 | Generated `ReportsService`/`HistoryRowResponse` DTOs | reports.page.ts already consumes generated client |

### Supporting (no change)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xUnit + FluentAssertions + NSubstitute | 2.9.2 / 8.2.0 / 5.1.0 | Unit tests | New `TenantDayBoundary` bucket helper tests |
| Testcontainers.MySql | 4.0.0 | Integration tests | Day-boundary bucket assertions in `ReportEndpointTests` |
| Jasmine + Karma | 5.2 / 6.4 | Angular unit tests | reports.page.spec.ts / gatehouse-panel.page.spec.ts updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled timezone math in `ReportReadRepository` | `TenantDayBoundary` helper (existing) | Hand-rolling reintroduces the DST/Windows-fallback bugs the helper already solves |
| Adding a new NuGet timezone lib (e.g. NodaTime) | `TimeZoneInfo` via existing `TenantDayBoundary` | New dependency for a one-line bucketing fix; violates "no new packages" closeout |
| Extending backend `q` to document/destination (LEDGER-03) | Align placeholder wording only | Backend `q` scope is settled (D-03); extending it widens SQL surface for no requirement |

**Installation:** none — no new NuGet/npm packages.

## Package Legitimacy Audit

No external packages are installed in this phase. Skip.

*Packages removed due to [SLOP] verdict:* none
*Packages flagged as suspicious [SUS]:* none

## Architecture Patterns

### System Architecture Diagram (data flow for the five fixes)

```text
                    ┌───────────────────────────────────────────────────────────┐
                    │  Angular SPA (Browser)                                     │
                    │                                                            │
                    │  reports.page.ts          gatehouse-panel.page.ts          │
                    │   ├─ visit-counts (LEDGER-01 read only)                     │
                    │   ├─ status filter  (LEDGER-02: option set)                │
                    │   ├─ search box     (LEDGER-03: placeholder)               │
                    │   └─ history table  (LEDGER-05: reads X-Total-Count)       │
                    │                                                             │
                    │  gatehouse-panel package-drop modal                        │
                    │   └─ LEDGER-04: "condominium-level" trigger                │
                    │        → subjectId = Guid.Empty                            │
                    └───────────────┬─────────────────────────────────────────────┘
                                    │ REST /api/v1/* (JWT Bearer, CORS "AngularDev")
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  ASP.NET Core 8 Host (Program.cs: CORS pipeline + WithExposedHeaders fix)     │
│                                                                                │
│  Reports Module Api  →  ReportEndpoints.cs                                    │
│    GET /reports/visit-counts-by-day → GetVisitCountsByDayHandler               │
│    GET /reports/history            → GetHistoryHandler  (X-Total-Count line 49)│
│  AccessControl Module Api → AccessEventsEndpoints.cs                          │
│    POST /access-events/manual    → RecordManualAccessHandler                   │
└───────────────┬────────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  Reports Application:                                                         │
│    TenantDayBoundary.GetDayBoundsUtc(date)   ← LEDGER-01 source of truth      │
│    GetHistoryHandler (already day-buckets via TenantDayBoundary)              │
│  Reports Infrastructure:                                                      │
│    ReportReadRepository.GetVisitCountsByDayAsync  ← LEDGER-01 BUG (raw UTC)   │
│    ReportReadRepository.GetHistoryAsync (unified ledger UNION, NativeState)   │
│  AccessControl Application: RecordManualAccessHandler.RecordPackageDropAsync  │
│    ← LEDGER-04 already accepts Guid.Empty (condominium-level)                 │
└───────────────┬────────────────────────────────────────────────────────────────┘
                │ DBTools (ITenantAwareLinqFactory → tenant-filtered SQL)
                ▼
                    MySQL 8  (Visits, AccessEvents, RefusedScanAttempts,
                              ConsentAuditLog)
```

### Recommended Project Structure (unchanged — files touched only)

```
src/Modules/Reports/ControlEasyReborn.Modules.Reports.
├── Application/
│   ├── Time/TenantDayBoundary.cs        # LEDGER-01: add ToTenantDate(DateTime utc) helper
│   └── Handlers/GetVisitCountsByDayHandler.cs   # LEDGER-01: pass normalized bounds
├── Infrastructure/Persistence/ReportReadRepository.cs  # LEDGER-01: bucket tenant-local
└── Api/Endpoints/ReportEndpoints.cs     # LEDGER-05: WithExposedHeaders("X-Total-Count")

src/Web/ControlEasyReborn.Web/src/app/features/
├── reports/reports.page.ts              # LEDGER-02 (filter options), LEDGER-03 (placeholder)
└── gatehouse/
    ├── gatehouse-panel.page.ts           # LEDGER-04: condominium-level trigger
    └── access-control/gateway-control.service.ts  # LEDGER-04: subjectId Guid.Empty passthrough
```

### Pattern 1: Tenant-day bucketing via a single Application-layer helper
**What:** `TenantDayBoundary` is the single source of truth for "which UTC window is this tenant-local day." `GetHistoryHandler` already converts `DateOnly` → UTC bounds via `GetDayBoundsUtc`. The fix for LEDGER-01 is to make `GetVisitCountsByDayAsync` (a) convert its `from`/`to` range the same way and (b) bucket each `CreatedAtUtc` row into its tenant-local `DateOnly` instead of raw `ToUniversalTime()`.
**When to use:** Any report/ledger query that filters or groups by calendar day.
**Example (LEDGER-01 bucket mapping):**
```csharp
// Source: repo — TenantDayBoundary.GetDayBoundsUtc + ReportReadRepository.MapVisitDate (lines 184-188)
// Current (WRONG): raw UTC day
private static DateOnly MapVisitDate(DataRow row)
    => DateOnly.FromDateTime(Convert.ToDateTime(row["CreatedAtUtc"]).ToUniversalTime());

// Correct approach: convert the UTC timestamp into the tenant-local DateOnly,
// e.g. via a new TenantDayBoundary.ToTenantDate(DateTime utc) helper, then group.
```

### Pattern 2: Minimal API endpoint with `WithExposedHeaders`
**What:** The `/history` endpoint returns a paged list and sets `X-Total-Count` in the response headers. For non-same-origin consumers (CORS) to read it, the endpoint (or CORS policy) must explicitly expose the header.
**When to use:** Any endpoint whose response carries metadata headers a browser client must read cross-origin.
**Example:**
```csharp
// Source: repo — ReportEndpoints.cs:29-52 (currently sets header at line 49, no exposure)
group.MapGet("/history", /* ... */)
    .Produces<IReadOnlyList<HistoryRowResponse>>(StatusCodes.Status200OK)
    .WithExposedHeaders("X-Total-Count");  // LEDGER-05 fix
```

### Anti-Patterns to Avoid
- **Hand-rolling timezone math in the repository:** re-introduces the America/Sao_Paulo DST + Windows-fallback edge cases `TenantDayBoundary` already encodes. Use the helper.
- **Guessing the tenant's local midnight on the client:** the browser's local timezone is the *porteiro's* machine, not the tenant's. Bucketing must stay server-side.
- **Hard-coding a new status enum for the filter:** `NativeState` is intentionally heterogeneous (VisitStatus, PolicyOutcome, failure code, EntryState). A filter must match the *exact string* values the UNION emits, not a single imagined enum.
- **Adding `WithExposedHeaders` only to the CORS policy and forgetting the endpoint (or vice versa):** pick one seam and test it; the requirement is that a non-same-origin consumer can read the header.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant-local day boundaries | Custom timezone/offset math in the repository | Existing `TenantDayBoundary.GetDayBoundsUtc` (extend with a `ToTenantDate(DateTime)` helper) | DST rules, Windows vs IANA fallback, fixed-offset fallback already handled |
| Status vocabulary derivation | A new "coalesced" status enum on the client | The exact `NativeState` strings the UNION emits (read from `ReportReadRepository`) | `NativeState` is deliberately heterogeneous per `Kind` (D-03) |
| Search scope | A client-side filter re-implementing `q` | Backend `q` (`PackageDescription`/`SubjectName`/`Purpose` LIKE) — align the placeholder | Server-side pagination means client-side filtering would diverge from the DB total |
| CORS header exposure | A custom middleware exposing headers | ASP.NET Core `WithExposedHeaders(...)` / `WithExposedHeaders` on the CORS policy | First-class, tested API; no bespoke pipeline |
| Package-drop destination | A new "condominium" model/table | Existing `SubjectId = Guid.Empty` + `GATEHOUSE`/`RECEPTION` snapshot | Backend already models condominium-level drops this way (Phase 16) |

**Key insight:** The backend is already the honest source; four of five fixes are UI-vocabulary alignment, and the one backend bug (LEDGER-01) is a *regression to raw UTC* in a method that predates the `TenantDayBoundary` helper. Do not build anything new — reuse the settled contracts.

## Runtime State Inventory

Not a rename/refactor/migration phase. Skipped.

## Common Pitfalls

### Pitfall 1: Bucketing fix touches only the range, not the row grouping (LEDGER-01)
**What goes wrong:** Converting `from`/`to` to tenant-day bounds but leaving `MapVisitDate` on raw `ToUniversalTime()` means a visit at `02:00 UTC` (≈ `23:00` São Paulo *previous* day) is still grouped under the wrong date.
**Why it happens:** Two separate code paths (`BuildDateRangeClause` for range, `MapVisitDate` for grouping) — fixing one is easy, missing the other is the classic partial fix.
**How to avoid:** Fix both: (a) normalize the range via `TenantDayBoundary`, (b) bucket each row by a tenant-local `ToTenantDate(DateTime utc)` mapping. Add a Testcontainers test that seeds a visit at an off-midnight UTC timestamp and asserts its bucket.
**Warning signs:** A test that only asserts "rows returned, non-empty" (like the existing `GetVisitCountsByDay_ReturnsAggregatedRows`) will pass even when bucketing is wrong — it must assert the *date* of the bucket.

### Pitfall 2: Filter vocabulary drifts from `NativeState` (LEDGER-02)
**What goes wrong:** The dropdown hard-codes display labels and `value` strings that don't match the `NativeState` strings in the UNION (e.g. `"Recorded"`/`"Refused"` which the backend never emits).
**Why it happens:** The filter was authored against an imagined VisitStatus enum, before the heterogeneous `NativeState` contract (D-03) existed.
**How to avoid:** Derive the option list from the *actual* `NativeState` values in `ReportReadRepository` (VisitStatus strings + PolicyOutcome strings + failure codes + legacy EntryState strings). Remove `Recorded`/`Refused`. Each option's `value` must equal the exact `NativeState` string; the backend `BuildFilterWhere` does an exact `NativeState = @param` match (ReportReadRepository.cs:483-488).
**Warning signs:** An option that returns "0 rows" for a state the backend demonstrably produces; or a state rendered as `—` because it's not in the option list.

### Pitfall 3: CORS `AllowAnyHeader()` assumed to expose response headers (LEDGER-05)
**What goes wrong:** A developer assumes `AllowAnyHeader()` already exposes `X-Total-Count` to browser JS. It does **not** — `AllowAnyHeader()` governs *request* headers only; response-header exposure requires `WithExposedHeaders`.
**Why it happens:** The SPA works same-origin in production (Traefik serves both) and via the dev proxy, so the gap is invisible in normal development.
**How to avoid:** Add `WithExposedHeaders("X-Total-Count")` on the `/history` endpoint (and/or `.WithExposedHeaders(...)` on the CORS policy). Test by asserting the `Access-Control-Expose-Headers` response header (or endpoint metadata) contains `X-Total-Count`.
**Warning signs:** `res.headers.get('X-Total-Count')` silently returns `null` in a genuine cross-origin browser deployment, falling back to `res.body?.length` (reports.page.ts:1205-1206) — pagination total becomes page-size-capped.

### Pitfall 4: Package-drop UI enforces apartment even for the condominium-level path (LEDGER-04)
**What goes wrong:** `submitPackageDrop` (gatehouse-panel.page.ts:1153) and `selectPackageRecipient` (line 1145) both bail when `recipient?.apartmentId` is falsy, so the `Guid.Empty` path is unreachable from the UI even though the backend supports it.
**Why it happens:** The UI was built for the apartment-bound case only; the backend's `SubjectId = Guid.Empty` condominium-level branch (RecordManualAccessHandler.cs:214-220) was added later without a UI trigger.
**How to avoid:** Add a "condominium-level / reception" trigger that skips recipient selection and sends `subjectId = '00000000-0000-0000-0000-000000000000'` (Guid.Empty) with `kind: 'package-drop'`. Keep the recipient-search path for apartment-bound drops.
**Warning signs:** The modal's submit button is disabled because `!packageDropRecipient()`; no way to record a mail-room/reception package without fabricating an apartment.

## Code Examples

### Tenant-day bound conversion (existing helper, LEDGER-01 reference)
```csharp
// Source: repo — src/Modules/Reports/.../Application/Time/TenantDayBoundary.cs:22-31
public static (DateTime StartUtc, DateTime EndUtc) GetDayBoundsUtc(DateOnly date)
{
    var tz = ResolveTimeZone();
    var localMidnight = new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Unspecified);
    var nextLocalMidnight = localMidnight.AddDays(1);
    var startUtc = TimeZoneInfo.ConvertTimeToUtc(localMidnight, tz);
    var endUtc = TimeZoneInfo.ConvertTimeToUtc(nextLocalMidnight, tz);
    return (startUtc, endUtc);
}
```

### GetHistoryHandler already correct (LEDGER-01 reference for how to normalize range)
```csharp
// Source: repo — GetHistoryHandler.cs:38-48
DateTime? fromUtc = null;
DateTime? toUtc = null;
if (from.HasValue)
    fromUtc = TenantDayBoundary.GetDayBoundsUtc(from.Value).StartUtc;
if (to.HasValue)
    toUtc = TenantDayBoundary.GetDayBoundsUtc(to.Value.AddDays(1)).StartUtc;  // inclusive end day
```

### Backend `q` scope (LEDGER-03 source of truth)
```csharp
// Source: repo — ReportReadRepository.cs:471-476 (BuildFilterWhere)
if (!string.IsNullOrWhiteSpace(query.Q))
{
    parts.Add($"({alias}.PackageDescription LIKE @param{p} OR {alias}.SubjectName LIKE @param{p} OR COALESCE({alias}.Purpose, '') LIKE @param{p})");
    values.Add("%" + query.Q + "%");
    p++;
}
```

### Condominium-level package drop backend branch (LEDGER-04 already supported)
```csharp
// Source: repo — RecordManualAccessHandler.cs:214-220
else
{
    // Condominium-level drop (mail room / reception shelf): omits the apartment.
    destinationApartmentId = Guid.Empty;
    destinationBlock = "GATEHOUSE";
    destinationUnit = "RECEPTION";
}
```

### `X-Total-Count` set but unexposed (LEDGER-05)
```csharp
// Source: repo — ReportEndpoints.cs:45-50
var (rows, total) = await handler.HandleAsync(tenantId, from, to, page ?? 1, pageSize ?? 50,
    status, carrierCode, q, apartmentId, ct);
httpContext.Response.Headers["X-Total-Count"] = total.ToString();
return Results.Ok(rows);
// FIX: append .WithExposedHeaders("X-Total-Count") to the MapGet chain.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `GetVisitCountsByDayAsync` raw-UTC range + raw-UTC grouping | `GetHistoryHandler` normalizes via `TenantDayBoundary`; summary path should follow suit | v2.1 Phase 16/17 (day-boundary decision) | LEDGER-01 closes the last raw-UTC summary path |
| Status filter authored against a single VisitStatus enum (incl. inert `Recorded`/`Refused`) | Heterogeneous `NativeState` per `Kind` (D-03) | v2.1 Phase 16 | LEDGER-02 removes inert options |
| Search placeholder promising document/destination | Backend `q` = PackageDescription/SubjectName/Purpose | v2.1 Phase 16 | LEDGER-03 aligns wording |
| Package drop = apartment-bound only | `SubjectId = Guid.Empty` = condominium-level (GATEHOUSE/RECEPTION snapshot) | v2.1 Phase 16 | LEDGER-04 surfaces the trigger |
| `X-Total-Count` set, assumed visible | Needs `WithExposedHeaders` for cross-origin | carried v2.0 tech-debt | LEDGER-05 |

**Deprecated/outdated:**
- Raw-UTC day bucketing in `GetVisitCountsByDayAsync` — superseded by `TenantDayBoundary`.
- Inert `Recorded`/`Refused` filter options — the backend has never emitted these `NativeState` values.
- Search placeholder "subject, document, or destination" — backend `q` never covered document or destination.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The tenant-local day for São Paulo is UTC-3 in September (no DST), so `GetDayBoundsUtc` yields `03:00Z → next 03:00Z`. Verified by `TenantDayBoundaryTests` for 2026-09-19/06-15. | Standard Stack / LEDGER-01 | LOW — test already asserts these exact bounds |
| A2 | `gatehouse_only` is a valid legacy `EntryState` value even though it is absent from `EntryStates` constants (which list `entered_with_consent`/`entered_without_consent`/`entered_override`/`exited`); the SQL (ReportReadRepository.cs:324) and integration test (ReportEndpointTests.cs:243,258) reference it. | LEDGER-02 vocabulary | MEDIUM — the full honest option list for legacy states should be confirmed against the post-cleanup contract on `main` before finalizing the filter |
| A3 | No new package is needed for any of the five fixes. | Package Legitimacy Audit | LOW — all five fixes are code/UI/wiring changes on existing seams |
| A4 | The post-cleanup entry-log contract (from `feat/unified-visits-flow-cleanup` + `fix/gatehouse-direction-persistence`) does not change the `NativeState`/`q`/package-drop seams referenced here. | Phase Requirements | RESOLVED 2026-09-26 — both branches merged to `main` (PRs #10/#11); `git diff HEAD...origin/main` shows zero changes under `src/Modules/Reports` and `src/Modules/AccessControl`, so the seams are unchanged |

**If this table is empty:** n/a — see A1-A4 above.

## Open Questions (RESOLVED)

1. **Full status-filter option list (LEDGER-02) — which of the heterogeneous `NativeState` values should be offered?**
   - What we know: the UNION emits VisitStatus (`Pending`/`CheckedIn`/`CheckedOut`/`Cancelled`/`Unknown`), PolicyOutcome (`permit`/`requires_action`/`refused`/`unknown`), failure codes (e.g. `credential_inactive`, 11 total via `RefusalCodes.All`), and legacy EntryState (`entered_*`, `gatehouse_only`, `exited`). The current dropdown has only visit states + inert `Recorded`/`Refused`.
   - What's unclear: whether the planner should expose the full union (visit states + permit/refused + failure codes + legacy states) or a curated, user-friendly subset — the CONTEXT.md decision only says "remove inert options and offer only returnable statuses."
   - RESOLVED: The planner treats the *minimum* fix as removing `Recorded`/`Refused` and keeping the four visit states (they're the dominant rows). The exact option list (empty "All statuses" + `CheckedIn`/`Pending`/`CheckedOut`/`Cancelled`) is stated explicitly in 19-02-PLAN.md Task 1, which removes the two inert options and keeps the four visit-state options whose `value` equals the exact `NativeState` strings the backend emits. Implemented in Plan 19-02.

2. **LEDGER-03 resolution direction (placeholder vs. backend `q` extension) — agent's discretion.**
   - What we know: placeholder currently promises document + destination; backend `q` covers PackageDescription/SubjectName/Purpose only.
   - What's unclear: which is lower-risk in this codebase.
   - RESOLVED: **Align the placeholder** to "Search by subject, package description, or purpose" — zero backend/SQL change, zero re-test of the `q` filter, and it matches the settled D-03 scope. Extending `q` to document/destination would widen the UNION filter SQL and require new integration tests for no requirement value. Implemented in Plan 19-02 Task 1 (placeholder alignment, the lower-risk option per LEDGER-03 agent discretion).

3. **LEDGER-04 exact UI wording for the condominium-level trigger — agent's discretion.**
   - What we know: backend accepts `SubjectId = Guid.Empty`; `gateway-control.service.ts.recordPackageDrop` currently requires a non-empty `destinationApartmentId` string and maps it to `subjectId`.
   - What's unclear: exact label/placement (e.g. a "Condominium / reception drop" button or a "No specific apartment" checkbox in the modal).
   - RESOLVED: Add a secondary trigger ("Record reception / condominium drop") that bypasses the recipient search and sends `subjectId: '00000000-0000-0000-0000-000000000000'`. The `gateway-control.service.ts` `recordPackageDrop` signature is adjusted to accept a nullable apartment (mapping `null` → Guid.Empty string; one method covers both paths). Implemented in Plan 19-03 Tasks 1 & 2.

4. **LEDGER-05 exposure seam (endpoint vs. CORS policy).**
   - What we know: header is set on the endpoint (line 49); CORS policy `AngularDev` uses `AllowAnyHeader()` (request headers only).
   - What's unclear: whether non-same-origin consumers in scope are the dev Angular origin (`localhost:4200`) or a truly external origin.
   - RESOLVED: Add `WithExposedHeaders("X-Total-Count")` on the `/history` endpoint (most localized, applies regardless of CORS policy); the `AngularDev` CORS policy in `Program.cs` is left unchanged. The endpoint-level fix is canonical and satisfies the success criterion "non-same-origin consumers receive the header." Implemented in Plan 19-04 Task 1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | Backend build/test | ✓ | 8.0.131 | — |
| Node.js | Angular build/test | ✓ | v22.22.1 | — |
| npm | Angular deps | ✓ | 10.9.4 | — |
| Docker | Local CI gate (Testcontainers MySQL, web build) | ✓ | 29.8.1 | — |
| MySQL 8 | Integration tests | ✓ (via Testcontainers) | mysql:8.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

*No new external dependencies are introduced by this phase — it is a pure code/UI closeout on the existing ASP.NET Core + Angular + MySQL stack.*

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | xUnit 2.9.2 (backend) + FluentAssertions 8.2.0 + NSubstitute 5.1.0 + Testcontainers.MySql 4.0.0; Jasmine 5.2 + Karma 6.4 (Angular) |
| Config file | `tests/Directory.Build.props` (backend); `angular.json` → `test` architect + `tsconfig.spec.json` (Angular) |
| Quick run command | `dotnet test tests/ControlEasyReborn.UnitTests --filter "FullyQualifiedName~TenantDayBoundary"` |
| Full suite command | `scripts/verify-ci-local.sh` (full 6-stage gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEDGER-01 | Visit counts bucketed by tenant day (off-midnight UTC event lands in correct local day) | integration (Testcontainers) | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ReportEndpointTests"` | ❌ Wave 0 (existing `GetVisitCountsByDay_ReturnsAggregatedRows` does NOT assert bucket date) |
| LEDGER-01 | `TenantDayBoundary` UTC→local-day mapping helper | unit | `dotnet test tests/ControlEasyReborn.UnitTests --filter "FullyQualifiedName~TenantDayBoundaryTests"` | ⚠️ partial (has `GetDayBoundsUtc` tests; no `ToTenantDate(DateTime)` helper test) |
| LEDGER-02 | Status filter offers only backend-returnable states (no Recorded/Refused) | Angular unit | `npm test -- --no-watch --browsers=ChromeHeadless` (reports.page.spec.ts) | ❌ Wave 0 (spec asserts search/status mechanics, not the option vocabulary) |
| LEDGER-03 | Search placeholder wording matches backend `q` scope | Angular unit | `npm test -- --no-watch --browsers=ChromeHeadless` (reports.page.spec.ts) | ❌ Wave 0 (no assertion on placeholder text) |
| LEDGER-04 | Condominium-level drop sends `subjectId = Guid.Empty` | Angular unit + integration | `npm test -- --no-watch --browsers=ChromeHeadless` (gatehouse-panel.page.spec.ts) + `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ReportEndpointTests"` | ⚠️ partial (integration test `History_returns_visit_package_and_legacy_rows_once_each` already posts `SubjectId: Guid.Empty`; Angular spec only covers apartment-bound path) |
| LEDGER-05 | `X-Total-Count` exposed via `Access-Control-Expose-Headers` / `WithExposedHeaders` | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ReportEndpointTests"` | ❌ Wave 0 (no assertion on exposed headers) |

### Sampling Rate
- **Per task commit:** `scripts/verify-ci-local.sh --fast` (format + Release build + unit/arch tests)
- **Per wave merge:** `dotnet test tests/ControlEasyReborn.IntegrationTests` (Testcontainers) + `npm test -- --no-watch --browsers=ChromeHeadless`
- **Phase gate:** Full `scripts/verify-ci-local.sh` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/ControlEasyReborn.IntegrationTests/ReportEndpointTests.cs` — add a day-boundary test seeding a visit at an off-midnight UTC timestamp (e.g. `2026-09-19T02:00:00Z` ≈ `23:00` São Paulo 2026-09-18) and asserting the bucket date is the tenant-local day (LEDGER-01).
- [ ] `tests/ControlEasyReborn.UnitTests/Modules/Reports/` — add `TenantDayBoundary.ToTenantDate(DateTime utc)` helper tests (LEDGER-01), if that helper is introduced (recommended).
- [ ] `tests/ControlEasyReborn.IntegrationTests/ReportEndpointTests.cs` — add a test asserting `X-Total-Count` is exposed (e.g. request with an `Origin` header and assert `Access-Control-Expose-Headers` contains `X-Total-Count`, or assert endpoint metadata) (LEDGER-05).
- [ ] `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.spec.ts` — add assertions: status-filter `<option>` set excludes `Recorded`/`Refused` and equals the backend-returnable set; search placeholder text matches backend `q` scope (LEDGER-02, LEDGER-03).
- [ ] `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.spec.ts` — add a condominium-level package-drop spec asserting `subjectId` = Guid.Empty in the `/api/v1/access-events/manual` payload (LEDGER-04).

*(Backend `ReportReadRepository` currently has **no dedicated unit test** — coverage is via `ReportEndpointTests` integration tests. That is acceptable for a read model; the planner may add repository unit tests with `FakeAsyncSqlClient` if desired, but integration coverage is the higher-value target for the day-boundary fix.)*

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (unchanged) | JWT Bearer (existing) |
| V3 Session Management | yes (unchanged) | JWT bearer tokens (existing) |
| V4 Access Control | yes | `RequireAuthorization` + `Permission_Access.*` policies; `ITenantAwareLinqFactory` tenant isolation |
| V5 Input Validation | yes | FluentValidation (`RecordManualAccessCommandValidator`, `LookupSubjectCommandValidator`); `q`/`status`/`carrierCode` are parameterized SQL values (never interpolated) |
| V6 Cryptography | yes (unchanged) | BCrypt ≥ 11, HMAC-SHA256 QR tokens (not in this phase's scope) |

### Known Threat Patterns for ASP.NET Core + DBTools + Angular
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection in `q`/`status`/`carrierCode` filters | Tampering | All filter values are parameterized (`@paramN`) in `BuildFilterWhere`/`BuildRangeClause`; identifiers are compile-time constants (verified in ReportReadRepository.cs:471-488) |
| Cross-tenant data leak in the UNION ledger | Information disclosure | Each UNION branch predicates `tenant_id = @param0` explicitly (never relying on interceptor splicing into a UNION) — verified ReportReadRepository.cs:261,285,311,334 |
| CORS misconfiguration exposing headers | Information disclosure | `WithExposedHeaders("X-Total-Count")` restricts exposure to the single metadata header (LEDGER-05); the `AngularDev` policy already restricts origins to `localhost:4200`/`localhost:8443` |
| Package-drop without destination (abuse) | Spoofing | Backend models condominium-level drops as `SubjectId = Guid.Empty` with a `GATEHOUSE`/`RECEPTION` snapshot and `AccessEvent.Record` invariant requiring a destination snapshot (AccessEvent.cs:60-62) — not a security hole, a deliberate workflow |
| Refused-scan state spoofing | Tampering | `RefusedScanAttempt` validates `FailureCode` against `RefusalCodes.All` (CredentialStatus.cs:139-152); the ledger emits the raw failure code only |

## Sources

### Primary (HIGH confidence — read directly from repo)
- `src/Modules/Reports/.../Api/Endpoints/ReportEndpoints.cs` — endpoints, `X-Total-Count` set at line 49, no `WithExposedHeaders`
- `src/Modules/Reports/.../Application/Time/TenantDayBoundary.cs` — `GetDayBoundsUtc`, `DefaultTimeZoneId = America/Sao_Paulo`
- `src/Modules/Reports/.../Application/Handlers/GetVisitCountsByDayHandler.cs` — thin delegate to repository
- `src/Modules/Reports/.../Application/Handlers/GetHistoryHandler.cs` — already normalizes via `TenantDayBoundary`
- `src/Modules/Reports/.../Infrastructure/Persistence/ReportReadRepository.cs` — raw-UTC `GetVisitCountsByDayAsync`, unified ledger UNION, `NativeState`/`q`/`BuildFilterWhere`
- `src/Modules/Reports/.../Application/Contracts/ReportDtos.cs` — `HistoryRowResponse`, `HistoryQuery`
- `src/Modules/AccessControl/.../Application/Handlers/RecordManualAccessHandler.cs` — `RecordPackageDropAsync` (condominium-level = `Guid.Empty`)
- `src/Modules/AccessControl/.../Application/Validators/AccessControlValidators.cs` — `SubjectId.NotEmpty().When(Kind != PackageDrop)`
- `src/Modules/AccessControl/.../Domain/Entities/AccessEvent.cs` — destination-snapshot invariant for package drops
- `src/Modules/AccessControl/.../Domain/ValueObjects/CredentialStatus.cs` — `PolicyOutcome`, `RefusalCodes.All`
- `src/Modules/AccessControl/.../Domain/ValueObjects/AccessEventKind.cs` — `package-drop` wire code
- `src/Modules/Photos/.../Domain/Entities/ConsentAuditLog.cs` — `EntryStates` constants
- `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.ts` — status filter options, search placeholder, `X-Total-Count` read + fallback
- `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.spec.ts` — existing spec coverage
- `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts` (+ `.spec.ts`) — package-drop UI (apartment-bound only)
- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/gateway-control.service.ts` — `recordPackageDrop` maps apartment → `subjectId`
- `src/Host/ControlEasyReborn.Api/Program.cs` — CORS policy (lines 164-173), `UseCors("AngularDev")` (line 216)
- `tests/ControlEasyReborn.IntegrationTests/ReportEndpointTests.cs` — existing ledger integration coverage (incl. `SubjectId: Guid.Empty` package drop, `X-Total-Count` read via HttpClient)
- `tests/ControlEasyReborn.UnitTests/Modules/Reports/TenantDayBoundaryTests.cs` — existing day-bound tests
- `.planning/codebase/STACK.md`, `ARCHITECTURE.md`, `TESTING.md`

### Secondary (MEDIUM confidence — cited framework behavior)
- [CITED: learn.microsoft.com/aspnet/core/security/cors] — `AllowAnyHeader()` does not expose response headers; `WithExposedHeaders(...)` is required for browser JS to read a custom response header cross-origin. (Standard ASP.NET Core CORS semantics; not re-verified against a live request this session.)

### Tertiary (LOW confidence — marked for validation)
- None. All findings were read from the repository; no web-search-only claims were introduced.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read from `Directory.Packages.props` / `package.json` / repo code; no new packages
- Architecture: HIGH — every seam read directly from the five grounding files + access-control module
- Pitfalls: HIGH — each pitfall is anchored to a specific line in the read source

**Research date:** 2026-09-24
**Valid until:** 2026-10-24 (30 days — stable closeout phase on a fixed stack; the external contract branches have landed on `main` (2026-09-26, PRs #10/#11) without altering `NativeState`/`q`/package-drop seams — verified by diff)
