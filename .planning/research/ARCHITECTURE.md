# Architecture Research — v2.1 Integrated Visits & Account Operations

**Domain:** Brownfield integration — visits unification, unified ledger, password management (ControlEasy Reborn, ASP.NET Core 8 modular monolith + Angular 18 SPA)
**Researched:** 2026-09-19
**Confidence:** HIGH (all claims verified against source in worktree `feat-qr-entrance-frontend-routing`; recommendation confidence noted per section)

> Scope note: this research covers **only how the new v2.1 features integrate with the existing
> architecture**. It builds on the settled decisions in `.planning/notes/integrated-visits-flow.md`
> (one data model, visitors-only QR→Visit, entry-log folds into Visits, one gatehouse panel,
> unified ledger) and turns them into concrete component-level guidance.

---

## Standard Architecture (target state)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Angular 18 SPA (src/Web/ControlEasyReborn.Web)                               │
│                                                                              │
│  /gatehouse (NEW panel page, composed of existing pieces)                    │
│    ├─ QR scan tab        → POST /api/v1/access-events/scans        (existing)│
│    ├─ Manual lookup tab  → POST /api/v1/access-events/manual        (existing)│
│    ├─ Walk-in register   → POST /api/v1/visits (status=CheckedIn)   (NEW use) │
│    └─ Open visits tab    → GET/POST /api/v1/visits .../checkin|checkout       │
│  /visits      → management/reporting for admins (modal stays for pre-reg)    │
│  /reports     → GET /api/v1/reports/*  +  GET /api/v1/reports/history (NEW)  │
│  /login       → POST /api/v1/security/auth/forgot-password          (NEW)    │
│  admin pages  → POST /api/v1/security/users|attendant-profiles/…/reset (NEW) │
└──────────────────────────────────────────────────────────────────────────────┘
                     │ HTTPS (JWT bearer, tenant_id claim)
┌──────────────────────────────────────────────────────────────────────────────┐
│ ASP.NET Core 8 API host (minimal API endpoint classes, DI in Program.cs)     │
├──────────────────────────────────────────────────────────────────────────────┤
│ MODULE BOUNDARIES (communication = interface abstractions, one direction)    │
│                                                                              │
│  AccessControl.Application                                                   │
│    RecordAccessScanHandler ──┐                                               │
│    RecordManualAccessHandler─┤ consume IVisitDirectory (EXTENDED, see (a))    │
│    AccessEventDestinationResolver ┘                                          │
│         │  writes                    ▲ writes AccessEvents (unchanged)       │
│         ▼                            │                                       │
│  Visits.Application / Domain         │                                       │
│    Visit entity (+ walk-in factory, see (a))                                 │
│    IVisitDirectory ← IVisitDirectoryRepository (Visits.Infrastructure)        │
│    IVisitRepository  ← VisitRepository                                       │
│                                                                              │
│  Photos module: ConsentAuditLog stays privacy-consent audit ONLY             │
│    CreateEntryLogHandler kept for photo/consent capture paths (unchanged)    │
│                                                                              │
│  Reports module (CQRS-lite read side, already reads foreign tables directly) │
│    ReportReadRepository: Visits ∪ AccessEvents ∪ legacy ConsentAuditLog      │
│    NEW: GetActivityHistoryHandler + GET /api/v1/reports/history              │
│                                                                              │
│  Security module (auth ops)                                                  │
│    ForgotPasswordHandler / ResetPasswordHandler (NEW)                        │
│    IEmailSender (NEW abstraction) → MailKit infra (NEW)                      │
│    PasswordResetAttemptRepository (NEW, direct IAsyncSqlClient)              │
│                                                                              │
│  Tenants module: staff lifecycle unchanged; platform-admin reset calls       │
│    Security-side reset handler via endpoint (no new cross-module writer)     │
├──────────────────────────────────────────────────────────────────────────────┤
│ MySQL 8 (shared schema, tenant_id columns + TenantFilterInterceptor)         │
│  Visits | AccessEvents | ConsentAuditLog (append-only triggers)              │
│  Users | RefreshTokens | PasswordResetAttempts (NEW)                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities — New vs Modified

| Component | Status | Responsibility | File(s) |
|-----------|--------|----------------|---------|
| `IVisitDirectory` | **MODIFY** (extend) | Add visitor check-in-or-create operation (see decision (a)) | `src/Modules/Visits/.../Application/Abstractions/IVisitDirectory.cs` |
| `VisitDirectoryRepository` | **MODIFY** | Implement the new directory method(s) | `src/Modules/Visits/.../Infrastructure/Persistence/VisitDirectoryRepository.cs` |
| `Visit` entity | **MODIFY** | Walk-in factory landing directly `CheckedIn` (state machine today only enters CheckedIn from Pending) | `src/Modules/Visits/.../Domain/Entities/Visit.cs` |
| `RecordAccessScanHandler` | **MODIFY** | On visitor + Entrance: create-or-check-in Visit (today only checks in pre-existing Pending) | `src/Modules/AccessControl/.../Handlers/RecordAccessScanHandler.cs:196-199` |
| `RecordManualAccessHandler` | **MODIFY** | Same visitor fold-in for the manual-lookup entrance path | `src/Modules/AccessControl/.../Handlers/RecordManualAccessHandler.cs:124-127` |
| `CreateVisitHandler` / `VisitEndpoints` | **MODIFY** (small) | Accept a gatehouse walk-in creation flavor that lands `CheckedIn` (see (b)) | `src/Modules/Visits/.../Handlers/CreateVisitHandler.cs`, `VisitEndpoints.cs` |
| `POST /api/v1/entry-log` | **MODIFY** (re-scope, not delete) | Stops being the walk-in write path from the gatehouse panel; stays as the consent/photo audit recorder (privacy role). Kept for the Audit page + CSV export | `src/Modules/Photos/.../Api/Endpoints/EntryLogEndpoints.cs` |
| `ReportReadRepository` | **MODIFY** | Ledger merge: Visits + visitor AccessEvents (+ legacy ConsentAuditLog segment) into one chronological stream; drop the fragile try/catch ConsentAuditLog merge in `GetDashboardStatsAsync` | `src/Modules/Reports/.../Infrastructure/Persistence/ReportReadRepository.cs:65-179` |
| `ReportEndpoints` | **MODIFY** | New `GET /api/v1/reports/history` (paged unified stream); `GET /api/v1/dashboard/stats` DTO updated | `src/Modules/Reports/.../Api/Endpoints/ReportEndpoints.cs` |
| `ReportDtos` | **MODIFY** | New `ActivityHistoryItem` / paged response records | `src/Modules/Reports/.../Application/Contracts/ReportDtos.cs` |
| `ForgotPasswordHandler`, `ResetPasswordHandler`, admin-reset handlers | **NEW** | Password flows (see (d)) | `src/Modules/Security/.../Application/Handlers/` |
| `IEmailSender` + MailKit implementation | **NEW** | SMTP delivery, no-op in demo mode | `Security.Application/Abstractions/`, `Security.Infrastructure/Services/` |
| `PasswordResetAttemptRepository` | **NEW** | Rate-limit state, per-email + per-IP windows | `Security.Infrastructure/Persistence/` |
| `User` entity | **MODIFY** | Add `ResetPassword(hash)` that sets hash **and** arms `MustChangePassword` (existing `SetPasswordHash` does **not** — verified) | `src/Modules/Security/.../Domain/Entities/User.cs:45-49` |
| `IRefreshTokenRepository` | **MODIFY** | Add `RevokeAllForUserAsync(userId)` so a reset invalidates live sessions | `Security.Application/Abstractions/IRefreshTokenRepository.cs`, `RefreshTokenRepository.cs` |
| `SecurityEndpoints` | **MODIFY** | `POST /auth/forgot-password` (AllowAnonymous), reset endpoints | `src/Modules/Security/.../Api/Endpoints/SecurityEndpoints.cs` |
| `SecurityModuleServiceCollectionExtensions` | **MODIFY** | Register new handlers, `IEmailSender`, validators | `Security.Infrastructure/DI/` |
| MySQL migrations | **NEW** | `PasswordResetAttempts` table; ledger index on `Visits(CreatedAtUtc)` (missing today — verified `06-visits-schema.sql`); cutoff marker for legacy ledger segment | `docker/mysql/migrations/00xx-*.sql` + `init/` mirror |
| `GatehousePage` (Angular) | **NEW** (thin page) | Operator panel composing existing components; replaces `EntryWorkflowPage` | `src/Web/.../features/gatehouse/gatehouse.page.ts` |
| `CeEntryWorkflowComponent` | **MODIFY** or **RETIRE** | Walk-in submit repointed from `POST /api/v1/entry-log` to `POST /api/v1/visits` (CheckedIn), or superseded by panel's walk-in tab | `src/Web/.../design-system/components/entry-workflow/entry-workflow.component.ts:809` |
| `reports.page` + `reports-api.service` | **NEW** | `/reports` route (counts by day, residents per apartment, unified history); fixes dead `dashboard.page.ts:178` link | `src/Web/.../features/reports/` |
| `app.routes.ts` | **MODIFY** | Add `reports` route; keep `/gatehouse/*` routes; keep `**`→login | `src/Web/.../app.routes.ts` |
| OpenAPI client | **REGENERATE** | `npm run openapi-check` must pass; `dashboard-api.service.ts` types updated | `src/Web/.../app/api/`, `features/dashboard/dashboard-api.service.ts` |

---

## The Five Integration Decisions

### (a) Visitor QR scan → Visit rows: creation logic lives in **Visits**, consumed by AccessControl via the existing abstraction

**Verdict: extend `IVisitDirectory` — do NOT put Visit-creation logic in AccessControl.**

The established pattern is unambiguous and already used by three handlers:

- `RecordAccessScanHandler`, `RecordManualAccessHandler`, `LookupSubjectHandler`, and
  `AccessEventDestinationResolver` all consume
  `ControlEasyReborn.Modules.Visits.Application.Abstractions.IVisitDirectory`, whose
  implementation (`VisitDirectoryRepository`) lives in Visits.Infrastructure and is registered in
  `AddVisitsModule()`. AccessControl never touches the Visits table directly.
- This mirrors how AccessControl consumes `IResidentDirectory`, `IVehicleDirectory`,
  `IApartmentDirectory` — consumer-side interface, producer-side implementation. The interface
  lives in the *producing* module's Application layer.

Why creation must be in Visits, not AccessControl:

1. **The Visit state machine is Visits domain knowledge.** `Visit.CheckIn` enforces
   `Pending → CheckedIn`; `Visit`'s constructor validates destination snapshots
   (`ApartmentId != Guid.Empty`, non-empty `DestinationBlock/Unit` — `Visit.cs:34-36`). A walk-in
   that lands directly `CheckedIn` (recommended below) is not expressible through any current
   method: `CheckIn` throws on non-Pending. Visits must own a new domain method/factory, e.g.
   `Visit.RegisterWalkIn(...)` (lands `CheckedIn`, stamps `CheckedInAtUtc`, attendant, gatehouse)
   — AccessControl has no business encoding these rules.
2. **"Visits is the single operational record"** (settled decision) means Visits owns write
   semantics; AccessControl should only *request* them.
3. The required data is already at the call site: after `_resolver.ResolveAsync(...)` the handler
   holds `DestinationResolution` (ApartmentId, Block, Unit) and the credential carries
   `SubjectType=Visitor`, `SubjectId`. That is exactly what a Visit row needs.

**Concrete change:**

```csharp
// Visits.Application/Abstractions/IVisitDirectory.cs — extend, don't rename
public interface IVisitDirectory
{
    // existing members unchanged...
    Task<bool> CheckInAsync(Guid tenantId, Guid visitId, Guid attendantProfileId, Guid? gatehouseId, CancellationToken ct);

    // NEW: single entry point for "visitor physically present now".
    // If a Pending visit exists for the subject (visitor credential subjectId == visitId),
    // check it in; otherwise create a CheckedIn visit with the resolved destination.
    Task<Guid> CheckInOrCreateAsync(
        Guid tenantId,
        Guid visitIdOrSubjectId,
        string visitorName,
        string visitorDocument,
        Guid? apartmentId, string destinationBlock, string destinationUnit,
        Guid attendantProfileId, Guid? gatehouseId,
        CancellationToken ct);
}
```

`RecordAccessScanHandler.cs:196-199` and `RecordManualAccessHandler.cs:124-127` then call
`CheckInOrCreateAsync` instead of the bare `CheckInAsync`. Name/document for the create branch:
the credential issuance flow already carries visitor identity (name/document captured at lookup /
credential issue); the handler passes what it has. Unmatched visitors whose name is unknown still
create a Visit with the lookup-provided label rather than silently vanishing from the ledger —
this is the actual bug being fixed.

**Keep the optional-dependency pattern** (`IVisitDirectory? visits = null` in handlers with
`NullLogger`-style defaults): unit tests construct handlers without it. Making the new call path
null-guarded preserves those tests; but *do* tighten DI so the real implementation is always
registered (it already is: `VisitsModuleServiceCollectionExtensions.cs:23`).

### (b) Entry-log fold-in: re-scope the endpoint to consent-audit only; **no dual-write**; time-cutoff for the legacy ledger segment

**Verdict: keep `POST /api/v1/entry-log` alive but demoted; the gatehouse write path moves to
Visits; no data backfill migration.**

Facts that constrain this decision (all verified):

- `POST /api/v1/entry-log` is owned by the **Photos** module (`EntryLogEndpoints.cs`,
  `CreateEntryLogHandler`) and writes `ConsentAuditLog` — which is **append-only by DB triggers**
  (`09b-consent-schema.sql:28-40`: UPDATE and DELETE both `SIGNAL SQLSTATE '45000'`). The row
  cannot be marked "migrated" in place, and rows cannot be deleted or rewritten.
- `CreateEntryLogHandler` enforces consent semantics: `entered_with_consent` requires a
  `PhotoId`; `entered_override` is dweller/visitor-only with a required reason; `gatehouse_only`
  is service-provider-only. Photo + consent policy is a *privacy* concern that must keep working
  (the consent gatehouse spec and audit page `/audit` + CSV export consume it).
- The Angular `CeEntryWorkflowComponent` posts to `/api/v1/entry-log` via `EntryLogService`, and
  five design-system components (`audit-filters`, `audit-row`, `entry-state-badge`,
  `override-reason`) plus the `/audit` page depend on that service's types.

**Therefore:**

1. **Walk-in registration becomes a Visits write.** The gatehouse panel's walk-in tab posts to
   `POST /api/v1/visits` with a walk-in flavor that lands directly `CheckedIn` (the person is
   physically present — matches the lean in the notes). Implementation: extend
   `CreateVisitRequest` with an optional `CheckInNow` flag (or add `POST /api/v1/visits/walk-in`
   gatehouse-scoped endpoint that wraps the same handler with `CheckIn` applied) — flag-on-POST is
   less surface, new endpoint is more explicit. Recommendation: **`POST /api/v1/visits` with
   `CheckInNow: true`**, validated to gatehouse-capable roles, so pre-registration
   (`CheckInNow: false`/absent) is byte-identical to today and the endpoint count doesn't grow.
2. **When a photo/consent state is part of the interaction** (override, consent-refused,
   service-provider gatehouse-only), the panel *additionally* calls `POST /api/v1/entry-log` —
   `ConsentAuditLog` reverts to its privacy-consent audit role. This is **not dual-write of the
   same fact**: the Visit row is the operational record, the ConsentAuditLog row is the privacy
   evidence. They answer different questions and the append-only triggers make ConsentAuditLog
   permanently safe to keep.
3. **No dual-write transition, no redirect shim.** `POST /api/v1/entry-log` keeps its current
   contract (it still accepts the same body) so the audit/CSV/consent flows are untouched; only
   the *gatehouse panel stops calling it as the primary record*. Deprecation notice in OpenAPI
   tags/doc is enough; deletion is a later cleanup once `/audit` migrates to the unified history.
4. **Legacy ledger segment, no backfill.** Historical walk-in rows live only in
   `ConsentAuditLog` and cannot be mutated. The unified ledger handles them as a **legacy
   read-only segment**: rows with `RecordedAt < <cutover-constant>` are included as
   `kind: 'legacy-entry-log'` rows; rows at/after cutoff are excluded (they would be duplicated by
   the corresponding Visit rows created post-cutover). The cutoff is a build constant in
   `ReportReadRepository` (e.g., deployment date constant) — no schema change, no destructive
   migration, append-only log untouched. *Optional later backfill* (inserting Visit rows for
   visitor-category legacy entries with `Purpose = 'Walk-in (migrated)'`) is possible precisely
   because the cutoff makes the two segments disjoint, but is not needed for correctness of the
   ledger view.

### (c) Unified ledger read model: **single raw UNION query in `ReportReadRepository`** (Reports module), paged server-side

**Verdict: SQL-side UNION via `SelectRawAsync`, not handler-side merge of two queries.**

Why not handler-side merge:

- The current codebase *does* merge in C# (`GetDashboardStatsAsync` concatenates Visits + mapped
  ConsentAuditLog rows and sorts in memory, `ReportReadRepository.cs:191-194`), but it does so by
  loading **entire tables** (`whereClause: "1=1"`) — workable for a dashboard top-10, unacceptable
  for a paged history page.
- Correct pagination across two sources cannot be done with two independent `LIMIT/OFFSET`
  queries merged in C# (page boundaries shift as rows interleave).

Why a raw UNION is safe and idiomatic here:

- The Reports module is explicitly **CQRS-lite read-only** and *already* reads other modules'
  tables directly (`Visits`, `Residents`, `Vehicles`, `Apartments`, `ConsentAuditLog`) via
  `ITenantAwareLinqFactory` — that is the module's sanctioned role; no new abstraction or
  cross-module interface is warranted (would contradict the existing design and the
  "abstraction only at real seams" decision pattern, cf. `IDeviceHandler` rationale in
  PROJECT.md).
- `SelectRawAsync` precedent exists in this very repository (occupied-apartments query,
  `ReportReadRepository.cs:99-102`), with explicit `tenant_id` predicates.
- Both tables carry `tenant_id` and time columns; both have indexes on tenant+time
  (`ix_access_events_tenant_time`, `IX_Visits_CheckedInAtUtc`). One missing index:
  **`Visits` has no index on `CreatedAtUtc`** (`06-visits-schema.sql`) — add it in the migration
  since the union sorts/pages on occurred-time.

**Shape:**

```
GET /api/v1/reports/history?from=&to=&kind=&skip=&take=
→ SELECT * FROM (
     SELECT Id, 'visit' AS Kind, VisitorName AS Title, Purpose AS Detail,
            Status AS StateCode, DestinationBlock, DestinationUnit,
            CreatedAtUtc AS OccurredAtUtc, tenant_id
     FROM Visits        WHERE tenant_id = @p0 AND CreatedAtUtc BETWEEN @p1 AND @p2
     UNION ALL
     SELECT Id, 'access_event', <subject-derived title>, <method/direction detail>,
            PolicyOutcome, DestinationBlock, DestinationUnit,
            OccurredAtUtc, tenant_id
     FROM AccessEvents  WHERE tenant_id = @p0 AND OccurredAtUtc BETWEEN @p1 AND @p2
        AND SubjectType = <visitor>            -- visitor-only per settled decision
     UNION ALL
     SELECT Id, 'legacy_entry_log', SubjectName, EntryState/OverrideReason,
            EntryState, 'Gatehouse'/NULL, NULL,
            RecordedAt, tenant_id
     FROM ConsentAuditLog WHERE tenant_id = @p0 AND RecordedAt < @cutoff
   ) ledger
   ORDER BY OccurredAtUtc DESC
   LIMIT @take OFFSET @skip
```

- Visitor-only AccessEvents per the settled decision (resident/vehicle scans remain pure
  security audit; they stay visible in `/audit`-style surfaces and the existing
  `GET /api/v1/access-events` list, not the visit ledger). If product later wants all access
  activity, the union is trivially widened — the read model is the right place for that policy.
- **Counts in `GetDashboardStatsAsync` simplify**: today's visits / open visits now come from
  Visits alone (walk-ins land there); delete the ConsentAuditLog try/catch block
  (`ReportReadRepository.cs:152-189`) and the `existingVisitIds` de-dup set — the merge it was
  working around disappears. Keep the `recentVisits` list shape (`RecentVisitDto`) but source it
  from the same union (top 10) so the dashboard "arrival record" and the reports history are
  fed by one code path.
- Pagination: `LIMIT/OFFSET` on the derived table is fine at condominium scale (hundreds–
  thousands of events/day/tenant). Keyset pagination (`WHERE (OccurredAtUtc, Id) < (@last, @id)`)
  is the documented upgrade path if a tenant ever outgrows it — not needed for v2.1.
- Tenant scoping: explicit `tenant_id = @p0` in every branch (mirrors the existing raw query),
  since raw SQL bypasses the `TenantFilterInterceptor`.

### (d) Password management: Security module owns flows; **temp-password-via-SMTP (settled), DB-backed rate limiting, global SMTP config**

**Verdict: new handlers in Security; endpoints under `/api/v1/security`; no token table; rate
limit state in a new DB table; global SMTP config.**

Where endpoints live — Security, not Tenants:

- Security already owns the auth surface: `/auth/login`, `/auth/refresh`,
  `/auth/change-password` (all anonymous-or-authenticated as appropriate), and
  `POST /users` (PlatformAdmin-gated) already live in `SecurityEndpoints.cs`.
- Tenants module owns *staff lifecycle* (create/suspend porteiros) but its handlers hash
  caller-supplied passwords at creation time (`CreatePorteiroHandler.cs:46`). A *reset* is an
  account-credential operation with session-invalidation and `MustChangePassword` semantics —
  Security domain. Cross-module precedent: `RefreshHandler` (Security) already consumes
  `ITenantAdminRepository` from Tenants, so Security calling Tenants' user-repo abstractions is
  an accepted direction; the reverse (Tenants minting temp passwords) is not.

Endpoint layout:

| Endpoint | Auth | Handler |
|---|---|---|
| `POST /api/v1/security/auth/forgot-password` | AllowAnonymous | `ForgotPasswordHandler` (admins only — resolved by role after email lookup) |
| `POST /api/v1/security/users/{id}/reset-password` | PlatformAdmin (existing policy) | `AdminResetPasswordHandler` |
| `POST /api/v1/security/attendant-profiles/{id}/reset-password` | RequireAuthorization + tenant match check in handler | same handler, tenant-scoped branch |

Token vs temp-password: **temp password** (already settled in milestone scoping — PROJECT.md
"Key Decisions"). Consequences, all cheap given existing machinery:

- `User.ResetPassword(passwordHash)` — **new method required**: `SetPasswordHash` exists but does
  *not* arm `MustChangePassword` (verified `User.cs:45-49`); `ChangePassword` clears it. The reset
  method sets hash + `MustChangePassword = true`; the existing login flow already surfaces
  `MustChangePassword` in `LoginResponse` and the SPA's `changePasswordGuard` forces the change
  page — so one-time temp passwords and forced rotation come free.
- One-time semantics: since the temp password is *delivered*, not stored, "one-time" is enforced
  by `MustChangePassword` (login succeeds once → guard → forced change clears the flag).
  No token table, no expiry column.
- Session invalidation: add `RevokeAllForUserAsync(Guid userId)` to `IRefreshTokenRepository`
  (currently only `RevokeAsync(entry)` exists) so a reset kills live refresh sessions.

Anonymous-flow wrinkle (important, easily missed): `forgot-password` has **no JWT**, so
`HttpTenantContext.TenantId` is null and the tenant-aware factory cannot scope the user lookup.
Precedent: `RefreshTokenRepository` takes plain `IAsyncSqlClient` (not `ITenantAwareLinqFactory`)
— Security already has non-tenant-scoped persistence for pre-auth operations. Build
`PasswordResetAttemptRepository` and the email→user lookup the same way, with **explicit,
parameterized tenant handling** in SQL. Enumeration safety: the lookup returns the same response
(204 or generic 200) whether or not the email exists; the email is only sent when the user
exists *and* is Active *and* is an admin role (`PlatformAdmin` or `TenantAdmin`) — gatekeepers
(porteiros) are excluded per the settled scope.

Rate-limit state: new `PasswordResetAttempts` table (mirroring `RefreshTokens` placement in
`05-security-schema.sql` — no `tenant_id` needed since it is keyed by email hash + IP):

```
Id CHAR(36) PK, EmailHash VARBINARY(32) NOT NULL, RequestIp VARCHAR(45) NULL,
RequestedAtUtc DATETIME(6) NOT NULL, INDEX ix_pra_email_time (EmailHash, RequestedAtUtc)
```

Counting recent rows per email-hash (e.g., max 3/hour) and per IP (looser cap) at request time;
purge rows older than the window on write. DB-backed (not in-memory) because the API container
scales horizontally behind Traefik and restarts would otherwise reset the window. This is the
same shape as `RefreshTokens` — no new persistence pattern introduced.

Per-tenant vs global SMTP: **global config** for v2.1 (`appsettings.json` `"Smtp": { Host, Port,
From, User, Password-from-Docker-secret, EnableSsl }`). Rationale: the platform operator runs one
SMTP relay; per-tenant SMTP adds secret storage per tenant, per-tenant verification UX, and a
config surface nobody asked for. The `IEmailSender` abstraction (Security.Application) keeps the
door open; `Demo.DisableOutboundEmail` (exists today) maps to a no-op/log sender so demo mode
never emails anyone. MailKit is the standard, maintained SMTP client for .NET 8
(`System.Net.Mail.SmtpClient` is documented by Microsoft as not recommended for new
development). No mail dependency exists today (verified — no Smtp/MailKit references in the
solution), so this is a genuinely new infra leaf, isolated in Security.Infrastructure.

### (e) Angular: **new `/gatehouse` panel page composing existing pieces** — do not stretch `CeEntryWorkflowComponent` further

**Verdict: new thin `GatehousePage` at `/gatehouse` that composes existing feature components;
repoint the entry-workflow's write target; retire its modal-frame role.**

Current state (verified):

- `/gatehouse` = `EntryWorkflowPage`, which pins `CeEntryWorkflowComponent` full-screen and adds
  shortcut links to `/gatehouse/qr` and `/gatehouse/manual` (`entry-workflow.page.ts`).
- `CeEntryWorkflowComponent` is a 800+-line design-system component: category radio group, photo
  capture, consent states, and the `POST /api/v1/entry-log` submit
  (`entry-workflow.component.ts:809`). It is also hosted by the dashboard ("Record access"
  button, `dashboard.page.ts:44-49`).
- The dashboard separately hosts `VisitCreateModalComponent` ("Add visit"), and `/visits` hosts
  the same modal for pre-registration.

Why compose rather than extend:

- `CeEntryWorkflowComponent` is a *modal-shaped consent workflow*, not a panel. The unified
  gatehouse surface needs tabs/sections (scan, lookup, walk-in, open visits) — bolting that onto
  a modal component means growing an already-large component with the wrong shape, and the
  dashboard's modal usage would inherit the churn.
- Every ingredient already exists as a route or component: `qr-scan.page`, `manual-lookup.page`,
  `VisitCreateModalComponent`, the visits list/check-in-out calls, `DashboardApiService` ledger
  feed. A new page that *routes within itself* (tabs rendering the existing pages/components)
  is low-risk and preserves deep links.

Concrete shape:

- `features/gatehouse/gatehouse.page.ts` — standalone, OnPush, tab strip
  (`Scan QR | Manual lookup | Walk-in | Open visits`), each tab either embedding the existing
  component or routerLink-ing to `/gatehouse/qr` style child routes for deep-link parity. Keep
  the existing child routes alive (bookmarks/tests) and render them as tabs.
- Walk-in tab uses `VisitCreateModalComponent`-derived form posting `CheckInNow: true`
  (see (b)) — the notes' decision "Dashboard 'Add visit' reuses the gatehouse modal" keeps
  `VisitCreateModalComponent` as the shared form.
- `CeEntryWorkflowComponent`: repoint its submit from `EntryLogService.create` to the Visits
  endpoint **when photo/consent is involved it additionally calls entry-log** — or, if the panel
  fully replaces it, keep the component for the dashboard "Record access" quick action but with
  the same repointed writes. Its consent-audit behavior is retained per the todo note ("keep
  consent-audit behavior").
- Dashboard: "Add visit" continues to open `VisitCreateModalComponent`; "Record access" becomes
  a `routerLink="/gatehouse"` (or keeps opening the workflow component with new writes). The
  dead `routerLink="/reports"` (`dashboard.page.ts:178`) is fixed by actually adding the
  `/reports` route + `reports.page.ts` in the same milestone.
- `/visits` loses gatehouse duties: management/reporting list + pre-registration modal
  (per todo).
- Generated OpenAPI client: after backend changes, `ng-openapi-gen` regenerates
  (`prebuild`/`openapi-check` gates it); new `reports-api.service.ts` should consume generated
  functions (aligning with the documented tech-debt direction of preferring the generated
  client).

---

## Data Flow

### Flow 1 — Visitor QR scan (entrance) after the change

```
QR payload → POST /api/v1/access-events/scans
    → RecordAccessScanHandler (AccessControl)
        idempotency check (ScanAttemptId) → credential resolve →
        AccessEventDestinationResolver.ResolveAsync (visitor → IVisitDirectory.FindByIdAsync,
            or fallback apartment for standalone credential)
        → consent policy evaluate
        → AccessEvent.Record + AddAsync            (security audit trail — unchanged)
        → IVisitDirectory.CheckInOrCreateAsync      (NEW — Visits module creates
            Pending→CheckedIn or direct CheckedIn Visit row with resolved destination)
    → ScanResponse (unchanged wire shape)
```

### Flow 2 — Gatehouse walk-in after the change

```
Gatehouse panel walk-in tab → POST /api/v1/visits { CheckInNow: true, ... }
    → CreateVisitHandler: validate → apartment resolve →
       Visit (Pending) → .CheckIn(...) [CheckedIn, CheckedInAtUtc=now]
    → ConsentAuditLog row written *only* when a photo/consent state was captured
       (override / entered_with_consent / gatehouse_only) via CreateEntryLogHandler
    → dashboard/gatehouse ledger refreshes from unified read model
```

### Flow 3 — Forgot password (admin)

```
Login page → POST /auth/forgot-password {email}            (AllowAnonymous)
    → ForgotPasswordHandler:
        rate-limit check (PasswordResetAttempts by emailHash + IP) → 204-style generic response
        user lookup (cross-tenant, active, admin role only)
        temp password generate (cryptographic random) → User.ResetPassword(hash)
            (MustChangePassword armed, refresh tokens revoked)
        IEmailSender.SendAsync(temp password)          (no-op when Demo.DisableOutboundEmail)
    → user logs in with temp password → changePasswordGuard → forced change → flag cleared
```

### Flow 4 — Unified ledger read

```
/reports page | /gatehouse panel | dashboard
    → GET /api/v1/reports/history (paged)  /  GET /api/v1/dashboard/stats
        → GetActivityHistoryHandler / GetDashboardStatsHandler
            → ReportReadRepository (Reports module, read-only)
                single UNION query over Visits + visitor AccessEvents
                + ConsentAuditLog(RecordedAt < cutoff)
                explicit tenant_id = @p0 per branch
```

---

## Suggested Build Order (dependency-driven)

Ordering rationale: Visits domain/abstraction changes are the root dependency of both the scan
path and the walk-in path; the ledger read model is only *correct* after the write paths land;
the Angular panel consumes whatever the API shape settles on; password management is independent
and can run in parallel with any of it.

| # | Slice | Depends on | Notes |
|---|-------|-----------|-------|
| 1 | **Visits module**: `Visit.ResetPassword`-analog — i.e., `Visit` walk-in factory (direct `CheckedIn`), `IVisitDirectory.CheckInOrCreateAsync` + repository impl, `CheckInNow` support in `CreateVisitRequest`/`CreateVisitHandler` | — | Pure Visits-domain work; existing unit tests keep passing (additive) |
| 2 | **AccessControl handlers**: scan + manual paths call `CheckInOrCreateAsync` | 1 | Small diffs at `RecordAccessScanHandler.cs:196-199`, `RecordManualAccessHandler.cs:124-127`; integration tests for scan→Visit and manual→Visit |
| 3 | **Entry-log re-scope + ledger cutoff**: gatehouse panel stops posting walk-ins to entry-log; `ReportReadRepository` cutoff constant | 1 | ConsentAuditLog/audit/CSV untouched |
| 4 | **Unified ledger**: UNION history endpoint (`GET /api/v1/reports/history`), `GetDashboardStatsAsync` simplification, DTO updates, `Visits(CreatedAtUtc)` index migration | 3 | `openapi-check` gate |
| 5 | **Angular gatehouse panel** (`GatehousePage` + tabs, walk-in modal, visits page demotion, dashboard button repoint) | 2, 4 | Largest frontend slice; a11y/i18n contract per entry-workflow precedent |
| 6 | **Reports page** (`/reports` route, page, nav placement, generated clients for visit-counts-by-day, residents-per-apartment, history) | 4 | Also fixes dead `dashboard.page.ts:178` link |
| 7 | **Password management backend** (handlers, `IEmailSender` + MailKit, `PasswordResetAttempts`, `User.ResetPassword`, refresh-token revoke-all, endpoints) | none | Independent — can be built in parallel with 2–5; demo no-op sender |
| 8 | **Password management frontend** (login forgot-link, forced-change flow already exists, admin reset buttons on administration/porteiros pages) | 7 | Smallest slice |

Suggested phase grouping for the roadmap: **Phase A** = slices 1–3 (backend visits unification);
**Phase B** = slices 4–6 (ledger + reports + panel + reports page — frontend-heavy, depends on A);
**Phase C** = slices 7–8 (password, parallel-friendly).

---

## Anti-Patterns (specific to this integration)

### Anti-Pattern 1: Put Visit-creation rules in AccessControl

**What people do:** have `RecordAccessScanHandler` construct `Visit` rows itself "to save an
interface method".
**Why it's wrong:** duplicates the Visit state machine and destination-snapshot invariants in the
wrong module; AccessControl already deliberately depends only on `IVisitDirectory`; arch tests
and the module-boundary discipline (Clean Architecture per module) erode.
**Do instead:** extend `IVisitDirectory` (decision (a)).

### Anti-Pattern 2: Backfill-mutating or dual-writing the append-only ConsentAuditLog

**What people do:** try to UPDATE/mark legacy rows, or run dual-write "during transition"
(walking both `POST /api/v1/entry-log` and `POST /api/v1/visits` for every walk-in).
**Why it's wrong:** DB triggers hard-fail any UPDATE/DELETE; dual-write double-counts entries in
every count/ledger unless a de-dup set survives forever (the exact fragility being deleted from
`GetDashboardStatsAsync`).
**Do instead:** re-scope the endpoint, one Visits write, optional disjoint legacy segment in the
ledger with a cutoff constant (decision (b)).

### Anti-Pattern 3: Handler-side merge + in-memory pagination for the history page

**What people do:** page Visits (50) and AccessEvents (50) separately, merge and sort in C#.
**Why it's wrong:** page boundaries are wrong under interleaving; full-table scans
(`whereClause: "1=1"` pattern in the current dashboard code) get slower with every month of
history.
**Do instead:** single UNION with `LIMIT/OFFSET` (or keyset later) in `ReportReadRepository`
(decision (c)).

### Anti-Pattern 4: Token-store password reset when a temp password is already settled

**What people do:** build reset-token tables, hashed single-use tokens, expiry columns, token
email links — a second credential subsystem.
**Why it's wrong:** the milestone decision is temp-password-via-SMTP; `MustChangePassword` +
`changePasswordGuard` already implement forced one-time use end-to-end; a token system doubles
the attack surface and test matrix for no product gain.
**Do instead:** `User.ResetPassword` + refresh-token revocation + rate-limit table (decision (d)).

### Anti-Pattern 5: Extending `CeEntryWorkflowComponent` into the gatehouse panel

**What people do:** keep growing the 800+-line modal component with tabs, open-visit list, and
check-in/out.
**Why it's wrong:** wrong shape (modal vs page), dashboard inherits every change, and its
entry-log write path would need surgery anyway.
**Do instead:** new thin `GatehousePage` composing existing components; repoint or retire the
modal's write path (decision (e)).

### Anti-Pattern 6: Cross-tenant data access for forgot-password via the tenant-aware factory

**What people do:** force `HttpTenantContext` to resolve a tenant for the anonymous reset flow,
or hack a header.
**Why it's wrong:** there is no tenant at that point in the flow; fighting the abstraction
invites scoping bugs in a security-sensitive path.
**Do instead:** dedicated non-tenant-scoped repository (plain `IAsyncSqlClient`) like the
existing `RefreshTokenRepository`, with explicit parameterized queries.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (dozens of condos, ≤1k events/day/tenant) | Nothing to change — single MySQL, UNION query with tenant+time indexes is fine |
| 10× history growth | Keyset pagination on `(OccurredAtUtc, Id)`; consider `PARTITION BY RANGE` on `AccessEvents.OccurredAtUtc` (MySQL 8) — deferred |
| Many concurrent gatehouse panels | Ledger read path is stateless; add 30–60s client polling or SSE later — v2.1 keeps the existing manual refresh pattern |

**First bottleneck:** the full-table scans in `GetDashboardStatsAsync` (today) — solved as part of
slice 4, not deferred.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| AccessControl → Visits | `IVisitDirectory` (extended) | Only cross-module write seam; producer-side interface — established pattern |
| AccessControl → Photos | `IConsentPolicyEvaluator` (existing) | Untouched by v2.1 |
| Reports → Visits/AccessControl/Photos tables | direct read-only SQL (`SelectAsync`/`SelectRawAsync`) with explicit `tenant_id` | CQRS-lite sanctioned; no new abstraction |
| Security → Tenants | `ITenantAdminRepository` abstraction (existing precedent in `RefreshHandler`) | Reset handlers live in Security, reuse Tenants' user repos |
| Photos (entry-log) | stays self-contained | Re-scoped to consent role; consumed by `/audit` |
| Angular → API | generated OpenAPI client (`ng-openapi-gen`) | `openapi-check` is the drift gate; `dashboard-api.service.ts` types must follow the stats DTO change |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| SMTP relay | New `IEmailSender` (MailKit) in Security.Infrastructure; config from appsettings + Docker secret | No-op when `Demo.DisableOutboundEmail=true`; global, not per-tenant (v2.1) |

---

## Open Questions (flag for phase planning)

1. **Visitor identity for unmatched QR scans** — for a standalone visitor credential whose
   `SubjectId` is not a Visit id, `AccessEventDestinationResolver` already falls back to the
   first active apartment; `CheckInOrCreateAsync` then needs a visitor name/document. Verify
   during planning what `IssueCredentialHandler` stores for visitor subjects (name captured at
   issue time?) — if nothing usable exists, the create path needs a label convention
   ("Visitante") and this should be an explicit spec decision.
2. **Walk-in landing status** — notes lean direct `CheckedIn`; confirm in spec (this research
   assumes direct `CheckedIn` for the walk-in path *and* for unmatched-scan creation; the
   matched-scan path keeps `Pending → CheckedIn` via `CheckIn`).
3. **Ledger cutoff constant vs config** — a build constant is simplest; if demo seeding needs to
   create legacy-looking rows, make the cutoff a config value instead.
4. **`GET /api/v1/dashboard/stats` DTO shape** — removing the ConsentAuditLog merge changes
   counts' semantics slightly (open visits/today are now purely Visits); confirm the dashboard
   copy ("entries today") still reads correctly, and whether `recentVisits` keeps
   `RecentVisitDto` or gains a `kind` discriminator (recommended: add `kind`).
5. **Tenant-admin permission for reset** — which permission string gates
   `attendant-profiles/{id}/reset-password` (existing `Permission_*` scheme in
   `RequirePermissionRequirement`); platform-admin reset reuses `PlatformAdminRequirement`.

---

## Sources

- `src/Modules/AccessControl/.../Handlers/RecordAccessScanHandler.cs` (scan flow, idempotency,
  visit check-in hook at 196–199)
- `src/Modules/AccessControl/.../Handlers/RecordManualAccessHandler.cs` (manual entrance path,
  visit check-in hook at 124–127)
- `src/Modules/AccessControl/.../Handlers/AccessEventDestinationResolver.cs` (visitor fallback
  destination, `IVisitDirectory` consumption)
- `src/Modules/Visits/.../Abstractions/IVisitDirectory.cs`, `IVisitRepository.cs`,
  `VisitDirectoryRepository.cs`, `Entities/Visit.cs` (state machine), `CreateVisitHandler.cs`,
  `VisitEndpoints.cs`, `VisitsModuleServiceCollectionExtensions.cs`
- `src/Modules/Photos/.../EntryLogHandlers.cs`, `Entities/ConsentAuditLog.cs`,
  `Api/Endpoints/EntryLogEndpoints.cs` (entry-log ownership, append-only semantics)
- `docker/mysql/init/09b-consent-schema.sql` (append-only triggers), `06-visits-schema.sql`
  (missing `CreatedAtUtc` index), `05-security-schema.sql` (`RefreshTokens` shape),
  `12-access-control-schema.sql` (`AccessEvents` indexes)
- `src/Modules/Reports/.../ReportReadRepository.cs` (dashboard merge, raw-SQL precedent),
  `IReportReadRepository.cs`, `ReportEndpoints.cs`, `ReportDtos.cs`
- `src/Modules/Security/.../Handlers/ChangePasswordHandler.cs`, `RefreshHandler.cs`,
  `LoginHandler.cs`, `Entities/User.cs` (`SetPasswordHash` vs `ChangePassword`),
  `Abstractions/IRefreshTokenRepository.cs`, `Infrastructure/Persistence/RefreshTokenRepository.cs`
  (non-tenant-scoped repo precedent), `Api/Endpoints/SecurityEndpoints.cs`
- `src/Modules/Tenants/.../Handlers/CreatePorteiroHandler.cs`,
  `TenantAdminLifecycleHandlers.cs`, `Api/Endpoints/TenantEndpoints.cs`
- `src/Host/ControlEasyReborn.Api/Program.cs` (module registration order),
  `appsettings.json` (no SMTP config today; `Demo.DisableOutboundEmail`)
- Angular: `app.routes.ts` (no `/reports`; gatehouse routes),
  `features/entry-workflow/entry-workflow.page.ts`,
  `design-system/components/entry-workflow/entry-workflow.component.ts` (entry-log submit at 809),
  `features/dashboard/dashboard.page.ts` (dual modals at 33–55, dead `/reports` link at 178),
  `features/entry-log/entry-log.service.ts` (+ design-system dependents)
- Planning: `.planning/PROJECT.md`, `.planning/notes/integrated-visits-flow.md`,
  `.planning/todos/pending/integrated-visits-flow.md`

---
*Architecture research for: ControlEasy Reborn v2.1 — Integrated Visits & Account Operations*
*Researched: 2026-09-19 (source-verified in worktree feat-qr-entrance-frontend-routing)*