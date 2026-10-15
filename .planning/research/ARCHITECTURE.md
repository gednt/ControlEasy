# Architecture Research — v2.4 Integration into Existing Architecture

**Domain:** Resident self-service & visitor experience added to a multi-tenant condominium access-control modular monolith
**Researched:** 2026-10-15
**Confidence:** HIGH — every claim below is verified by direct reads of the cited source files (code is the top tier of the source hierarchy; no web research needed). Where a placement is a *recommendation* rather than an existing pattern, it is explicitly flagged as such.

**Question answered:** How do the v2.4 features (Phases 27–30) integrate with the existing architecture? Where do new components live, and which existing seams do they ride?

---

## System Overview (v2.4 features mapped onto the existing monolith)

```
┌─────────────────────────────────── Angular 18 SPA ─────────────────────────────────────┐
│  features/portal/*            features/gatehouse/gatehouse-panel.page.ts              │
│  (NEW resident shell,         (MODIFIED: + pending pre-regs tab, doc-match,           │
│   residentGuard NEW)           one-click check-in, badge print trigger                 │
│  features/lane/* (NEW         + features/visits/* (resident pre-reg CRUD NEW pages)   │
│   self-service lane page)                                                              │
└──────────────┬────────────────────────────────────────────────────────────────────────┘
               │ Generated/handwritten API services
┌──────────────▼───────────── Host (Program.cs) MODIFIED ────────────────────────────────┐
│ JwtBearer → TenantResolutionMiddleware (EXISTING, untouched)                           │
│ Authorization: + Resident role policies (MODIFIED policy inventory)                    │
│ RateLimiter: + lane/resident partitioned policies (MODIFIED)                           │
│ DI: + residents-portal / preregistration registration (MODIFIED)                       │
└──────────────┬─────────────────────────────────────────────────────────────────────────┘
               │
┌──────────────▼── Modules (Clean Architecture each: Domain/Application/Infrastructure/Api)
│ Security  (MODIFIED: resident login branch, roles)                                     │
│ Residents (MODIFIED: portal auth surface + scoped directory)   ← Phase 27 core          │
│ Visits    (MODIFIED handler + NEW PreRegistration/PurposeCode aggregate) ← Ph 28/29/30  │
│ AccessControl (REUSED: OpaqueTokenIssuer, AccessCredential badges; no module fork)      │
│ Reports   (MODIFIED: apartment-predicated history branch)      ← Phase 30               │
└──────────────┬─────────────────────────────────────────────────────────────────────────┘
               │ ITenantAwareLinqFactory (TenantFilterInterceptor) + TenantContext
┌──────────────▼── MySQL 8 shared schema (docker/mysql/migrations, next: 23-/0023-) ──────┐
│ NEW tables: visitor_pre_registrations, purpose_codes, resident_notifications            │
│ NEW columns: users/roles "Resident"; visits.pre_registration_id (+ purpose snapshot)    │
│ REUSED tables: users, residents, access_credentials, visits, access_events,             │
│                refused_scan_attempts, credential_lifecycle_actions                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Key structural fact: **no new module is created.** v2.4 is a per-module extension of the existing five modules (Security, Residents, Visits, AccessControl, Reports) plus two new tables in the Visits aggregate and one in the notification slice. This mirrors how v2.3 extended Devices without forking anything from the ledger.

---

## Component Responsibilities

| Component | Location (canonical path) | Responsibility | v2.4 relationship |
|-----------|---------------------------|----------------|-------------------|
| `TenantResolutionMiddleware` | `src/BuildingBlocks/ControlEasyReborn.Infrastructure/MultiTenancy/TenantResolutionMiddleware.cs` | Derives `TenantId/ProfileId/Roles/Permissions` from JWT claims; skips anonymous callers (lines 23–28) | **Unmodified seam.** The lane is gatehouse-authenticated (gap review F01 resolution), so lane requests ride the same authenticated tenant bootstrap — no anonymous tenant bootstrap is built |
| `TenantAwareLinqFactory` + `TenantFilterInterceptor` | `src/BuildingBlocks/ControlEasyReborn.Infrastructure/MultiTenancy/TenantAwareLinqFactory.cs`, `TenantFilterInterceptor.cs` | Splices `tenant_id` into every module query | **Mandatory ride** for all new repositories; apartment scoping is layered ON TOP of, not instead of, tenant predication (see Pattern 2) |
| `JwtTokenService` | `src/Modules/Security/.../Persistence/JwtTokenService.cs` | Issues access (15-min default) + refresh tokens; claims: `sub, jti, tenant_id, profile_id, roles, permissions` | **Modified**: resident login flows through it unchanged; no apartment claim is added — apartment scope is resolved per-request server-side (see Pattern 1 and `JwtTokenService.cs:35-47`) |
| `LoginHandler` + `AttendantProfileLoginSupport` | `src/Modules/Security/.../Handlers/LoginHandler.cs`, `AttendantProfileLoginSupport.cs` | Email→user verify → **active attendant profile resolution** → token. Currently *requires* an attendant/admin profile (`LoginHandler.cs:60-65`) | **Modified**: must resolve the resident profile kind too, else no resident JWT can ever carry `profile_id`; uniform constant-cost denials (unknown/wrong/inactive/revoked same response) |
| `User.Roles` (comma string) | `src/Modules/Security/.../Domain/Entities/User.cs:18-41` | Coarse role list on user | **Extended**: new `"Resident"` role value; permissions come from the resolved profile, exactly like staff |
| `VisitorArrivalHandler` | `src/Modules/Visits/.../Handlers/VisitorArrivalHandler.cs` | THE single write path into Visits (dedupe + status transitions, D-01/D-02) | **The spine of Phases 29–30.** Every lane, panel one-click, and badge-bound arrival must pass through `HandleAsync`. Modified to accept an optional pre-registration identity + purpose snapshot |
| `VisitDirectoryRepository` | `src/Modules/Visits/.../Persistence/VisitDirectoryRepository.cs` | Document lookup (`FindLatestByDocumentAsync` lines 38–55: raw OR normalized match, latest by `CreatedAtUtc`) | **Modified/extended**: new authorization-bound and apartment-bound lookup methods; current method cannot discriminate apartment 101-vs-302 (gap review F03) |
| `Visit` entity | `src/Modules/Visits/.../Domain/Entities/Visit.cs` | Status machine Pending→CheckedIn→CheckedOut / Cancelled; `CheckIn/CheckOut/Cancel` guards | **Modified**: add `PreRegistrationId` link + purpose-label snapshot (+ optional plate snapshot per F17 resolution). State machine itself unchanged — checkout stays staff-only |
| `OpaqueTokenIssuer` | `src/Modules/AccessControl/.../Services/OpaqueTokenIssuer.cs` | 32-byte random token → HMAC verifier + fingerprint, `FixedTimeEquals` verify | **Reused as-is** for both pre-auth codes (verifier-only persistence) and badge QRs — *no second token subsystem* (Key Decision, F05/F12) |
| `RecordAccessScanHandler` | `src/Modules/AccessControl/.../Handlers/RecordAccessScanHandler.cs` | QR scan pipeline: idempotency by scan-attempt (99–119) → credential resolve → destination resolve → **consent policy gate** (156–187) → canonical arrival (190–217) → Event+audit | **Pattern donor, not modified core.** The lane handler *mirrors* its consent-gate + arrival-delegation structure. Devices module already rides it — precedent for a third caller |
| `AccessCredential` + lifecycle handlers | `src/Modules/AccessControl/.../Entities/AccessCredential.cs`, `Handlers/CredentialLifecycleHandlers.cs` | Verifier-only secrets, validity window (`IsUsableAt`), Issue/Replace/Revoke, lifecycle audit | **Reused as-is** for badges: `SubjectType=Visitor`, `SubjectId=Visit.Id` (established at `RecordAccessScanHandler.cs:197-202`). Reprint = new staff-authorized issue |
| `ReportEndpoints` / `GetHistoryHandler` | `src/Modules/Reports/.../Endpoints/ReportEndpoints.cs:29-52` | Unified UNION ledger, optional caller-supplied `apartmentId` | **Modified (gate)**: resident tokens forced to their own apartment predicate; optional apartmentId becomes staff-only. This is the RES-09 "honest, same source" delivery |
| `VisitEndpoints` | `src/Modules/Visits/.../Endpoints/VisitEndpoints.cs:15-17` | `RequireAuthorization()` only — **any authenticated tenant JWT passes** (gap review F02) | **Modified (deny matrix)**: explicit role policy per operation; negative integration suite proves resident tokens get 403. Same treatment for Reports, Residents, Apartments, AccessControl, Devices, Administration staff groups |
| Rate limiter (`forgot-password` policy) | `src/Host/ControlEasyReborn.Api/Program.cs:186-214` | Process-local fixed-window, partition-keyed | **Cloned** for lane denials, partitioned on a server-normalized document/code value — proxy-header trust decision owed (ForwardedHeaders: F05, currently absent at line 224-259 region) |
| Gatehouse panel page | `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts` | Consolidated tabs (QR, manual, walk-in, open visits); `DeviceHealthService` singleton-poll precedent | **Modified** (Phase 30): + "Pending today" pre-registrations tab, document-match binding, badge print trigger |
| Angular guards | `src/Web/.../app/core/guards/*.ts` | `porteiroGuard`, `tenantAdminGuard`, `syndicGuard`, `platformAdminGuard` | **Extended**: new `residentGuard`; shell routes get role-tightening because shell `authGuard` alone would let resident JWTs browse staff pages (F02 front-end half — backend deny matrix is the real fix) |
| Migrations | `docker/mysql/migrations/` (root `00…22-*` + module-migrations `0009…0022-*`) | Numbered schema files | **Extended with 23-/0023-** series in phase order (see build order) |

---

## Recommended Placement of New Components (v2.4)

Per-module folders follow the established 4-layer pattern (`Api/Endpoints`, `Application/{Handlers,Contracts,Abstractions,Validators}`, `Domain/{Entities,ValueObjects}`, `Infrastructure/Persistence`).

### Phase 27 — Resident Access Foundation

| Item | Where | New / Modified |
|------|-------|----------------|
| Resident profile (apartment-bound, carries permissions) | `src/Modules/Residents/.../Domain/Entities/ResidentPortalProfile.cs` + Infrastructure repo | **New** |
| `Resident` role string + resolution | `Security` module: `LoginHandler`/`AttendantProfileLoginSupport` + new `IResidentPortalProfileRepository` application abstraction | **Modified** (Security depends on the pattern, Residents owns the data — same cross-module pattern as `RecordAccessScanHandler` consuming `IResidentDirectory`) |
| Resident scope resolver (server-side apartment derivation + per-request suspend check) | `Residents.Application/Abstractions/IScopedResidentContext.cs` + implementation that reads `profile_id` claim → resident profile → `ApartmentId`, rejecting suspend/stale membership per request | **New** — this is the load-bearing component of the whole milestone; do NOT bake `ApartmentId` into the JWT (stale-token failure mode F07) |
| Resident-reachable API group | `Residents.Api/Endpoints/ResidentPortalEndpoints.cs` (`/api/v1/portal/*`) | **New** — never extend the existing staff `/api/v1/residents` group |
| Staff deny matrix (RES-13) | One policy pass over every existing `RequireAuthorization()` group: `VisitEndpoints`, `ReportEndpoints`, Residents/Apartments/AccessControl/Devices/Administration endpoint files | **Modified** + **new negative integration test suite** in `tests/ControlEasyReborn.IntegrationTests` |
| Program.cs authorization + login rate-limit partitions | `src/Host/ControlEasyReborn.Api/Program.cs` | **Modified** |
| TenantAdmin provisioning UI + resident login page | `features/administration/*` (modified) + resident shell `features/portal/*`, `resident.guard.ts` | New pages + Modified routes |

**Login architecture recommendation** (flagged: recommendation, settles gap-review F06/F07): mirror the staff structure exactly — a resident portal profile row owned by the Residents module with `ApartmentId` + permission set, resolved by an `AttendantProfileLoginSupport`-style helper in Security. Suspension enforcement = per-request lookup in `IScopedResidentContext` (authoritative DB check each request, 15-min JWT live-expiry covered) + refresh-token revocation on suspend (existing `RefreshTokenRepository` machinery from Phase 18).

### Phase 28 — Pre-Registration & Purpose Codes

| Item | Where | New / Modified |
|------|-------|----------------|
| `VisitorPreRegistration` aggregate (name, canonical document, optional plate snapshot, purpose code ref, window start/end, `max_uses`, `uses_consumed`, status Pending/Cancelled/Consumed, creator/editor audit fields) | `Visits.Domain/Entities/VisitorPreRegistration.cs` + value objects | **New** — Visits module owns it; `AccessControl` and `Reports` reach it only through application abstractions |
| `VisitorPreRegistrationRepository` | `Visits.Infrastructure/Persistence/` via `ITenantAwareLinqFactory`, tenant + apartment predicated | **New** |
| `PurposeCode` aggregate + repository + TenantAdmin endpoints | Visits module (table + `/api/v1/purpose-codes` endpoints); immutable code identity, deactivate-not-delete | **New** (place in Visits so the FK lives in-module; the administration UI merely consumes it) |
| Pre-registration CRUD handlers + resident endpoints | `Visits.Application/Handlers/PreRegistrationHandlers.cs` (4 CRUD), endpoints under `/api/v1/portal/*` (resident) and `/api/v1/pre-registrations` (staff view) | **New** |
| `VisitorArrivalHandler` | Accept optional `PreRegistrationId`/authorization context on `VisitorArrivalCommand`; bind authorization → resulting VisitId; never auto-resolve same-document cross-apartment conflicts (gate review F03: porteiro disambiguates) | **Modified** — the only Phase-28 touch to the canonical path |
| `Visit` entity + visit tables | `pre_registration_id`, purpose-code identity + label snapshot columns (F18); plate as informational snapshot (F17) | **Modified** |
| Migration | `docker/mysql/migrations/23-visits-preregistration.sql` + `0023-…` module file | **New** |
| Angular | Resident pre-reg CRUD pages (`features/portal/*`), TenantAdmin purpose-code management (`features/administration/*`) | **New pages** |

### Phase 29 — Self-Service Lane & Badge

| Item | Where | New / Modified |
|------|-------|----------------|
| `LaneSelfCheckInHandler` | `Visits.Application/Handlers/` | **New** — orchestrator that (1) resolves the pre-auth code via `IOpaqueTokenIssuer`/verifier lookup **or** document via new apartment/authorization-discriminated directory method, (2) validates window/cancelled/uses with compare-and-consume, (3) evaluates consent via the *existing* `IConsentPolicyEvaluator` seam (mirroring `RecordAccessScanHandler.cs:156-187`), (4) delegates arrival to `VisitorArrivalHandler`, all in one canonical transaction with bounded idempotent replay (F10/F11 resolutions) |
| Lane endpoints | `Visits.Api/Endpoints/LaneEndpoints.cs` (`/api/v1/lane/*`) — gatehouse-/lane-authenticated, actor recorded as kind `Visitor@Lane` in a dedicated field; never impersonate a porteiro via `AttendantProfileId` (F11) | **New** |
| Badge issuance | **Reuse** `IssueCredentialHandler` (AccessControl): `SubjectType.Visitor`, `SubjectId=Visit.Id`, `IssuedByProfileId` = authorizing lane/porteiro actor, validity intersected with the authorization window (F12/F13) | **Reused** — zero new AccessControl code expected |
| Rate limiting | New fixed-window policy in `Program.cs`, partitioned by server-normalized document/code hash (never trust client headers without configured proxy hops); denied attempts land in existing `RefusedScanAttempt`-style audit | **Modified** (Program.cs) + reuse audit writer seam |
| Lane route + badge print | `features/lane/*` page under `porteiroGuard`-adjacent guard, browser `window.print()` of badge composed with `ce-*` components | **New** |
| E2E journey | Playwright spec covering the resident-share → lane check-in → staff print journey (F15: a page/route must exist in Phase 29, not deferred) | **New** |

### Phase 30 — Visibility, Notifications, Panel Integration

| Item | Where | New / Modified |
|------|-------|----------------|
| Apartment-scoped history | **Modify** `Reports` handlers (`GetHistoryHandler`/`ReportReadRepository`) to accept a forced apartment predicate from `IScopedResidentContext`; the UNION keeps `tenant_id = @p0` per branch AND gains `ApartmentId = @pN` predication | **Modified** — delivers "same honest source" for RES-09 without a second query model |
| `ResidentNotification` aggregate + repo + resident endpoints | Visits module (`Domain/Entities/ResidentNotification.cs`, Infrastructure repo, `/api/v1/portal/notifications`) | **New** |
| Notification emission | **Inside** the canonical `VisitorArrivalHandler` commit boundary (notification insert atomic with the Visit mutation; per-recipient rows to current household residents of the destination apartment; no emission on no-op replay) | **Modified** (handler) as part of Phase 30 |
| Gatehouse panel pending pre-regs | `gatehouse-panel.page.ts` + new tab component; document-match uses new directory method; one-click check-in calls the same lane/staff arrival seam; badge print triggers `IssueCredentialHandler` from the porteiro context | **Modified** |
| Angular poller | New `ResidentNotificationService` following the proven `DeviceHealthService` Phase-26 pattern: singleton, one poll cycle, transition diff in the service, not the page | **New** |

---

## Architectural Patterns (each rides an existing precedent)

### Pattern 1: Server-side scope derivation over claim-baked scope

**What:** Resident apartment scope is resolved per request from the `profile_id` claim → resident portal profile → apartment; never trusted from a query/body parameter, never baked sole-authority into the JWT.
**When to use:** Every Phase 27–30 resident endpoint.
**Why:** `JwtTokenService` issues 15-min tokens with no apartment claim, and suspension/move-out must deny **the next request** (RES-01). Per-request resolution handles suspension (profile row check) and stale membership (apartment reassignment between token issue and use) in one place (F06/F07).
**Ride:** `TenantResolutionMiddleware` unchanged (it already publishes roles/permissions/profileId to `ITenantContext`); the new `IScopedResidentContext` is a thin `HttpContext`-adjacent resolver registered per module.

### Pattern 2: Apartment predicate layered on tenant predication

**What:** New reads/writes go through `ITenantAwareLinqFactory` (tenant splice) *and* add an explicit apartment predicate after it. Tenant isolation ≠ apartment isolation; both needed, and both integration-tested.
**Why:** `VisitDirectoryRepository.FindLatestByDocumentAsync` is today tenant-wide-with-document-key — sufficient for staff, dangerous for lane/resident flows (F03). Never weaken the first predicate; strengthen with the second.

### Pattern 3: Handler-mirroring instead of handler-forking (the RecordAccessScan precedent)

**What:** The lane does not get a new write path into Visits. `LaneSelfCheckInHandler` performs *authorization/policy front-matter* itself (consent gate, denial semantics, rate limits) and then delegates the *arrival mutation* to `VisitorArrivalHandler` — exactly how `RecordAccessScanHandler` already composes with it at lines 190–217, and how Devices rides it.
**When to use:** Any new caller into the Visits aggregate. **Trade-off:** handler stays the change point for arrival semantics (intended); callers must resist embedding their own `Visit` mutation — v2.3's architecture tests (grep for `new Visit(`/`INSERT INTO Visits` outside canonical handlers) already enforce this spirit and should gain a lane/pre-reg variant.

### Pattern 4: Verifier-only secrets for every visitor-facing credential

**What:** Pre-auth codes and badge QRs ride `OpaqueTokenIssuer` + `AccessCredential`: raw token shown/printed once, only the HMAC verifier persisted, `FixedTimeEquals` verification, fingerprint for lookup, one-way so lost prints cannot be "re-read" (F12).
**Why:** Already proven for resident/vehicle/visitor QR credentials; zero new crypto story.

### Pattern 5: Derived state, no background sweeps

**What:** `Consumed`, `Expired`, `Expected today`, notification unread counts are computed at read time from durable state columns — the same doctrine proven with `device_heartbeats` status derivation (v2.3 Key Decision).
**Why:** The settled v2.4 decision says "expired is derived at read time, no background sweep."

---

## Data Flow (changed and new flows)

### Flow A — Lane self check-in (NEW, Phase 29; rides everything above)

```
Visitor at supervised lane kiosk
    ↓
Lane page (features/lane, authenticated lane session)
    → enters pre-auth code OR document
    ↓
POST /api/v1/lane/check-in  (bearer lane/porteiro credential; rate limiter partitions by normalized input)
    ↓
TenantResolutionMiddleware → TenantContext (EXISTING)
    ↓
LaneSelfCheckInHandler:
    1. resolve pre-registration (verifier match or tenant+apartment-bound doc search)   [New repo]
    2. validate window (tenant-day basis), status Pending, uses < max_uses → compare-and-consume
    3. consent policy evaluation — same policy evaluator, refused/action-required → uniform denial [REUSED]
    4. map destination (prereg apartment) — conflict w/ same-document open visit to
       another unit → no auto-resolve, staff disambiguation response [F03 decision]
    5. delegate: VisitorArrivalHandler (Pending→CheckIn, else new CheckedIn Visit)     [REUSED spine]
       — atomic: consumption + Visit mutation + notification insert in one transaction
    ↓
Response: Visit + badge token (issued via IssueCredentialHandler; visitor AccessCredential)
    → lane page renders printable badge (browser print)
    ↓ audit: action kind Visitor@Lane; denials → refused-attempt audit row
```

### Flow B — Arrival notification (MODIFIED canonical path, Phase 30)

`VisitorArrivalHandler` (self, staff, or panel path) commits the Visit → in the same transaction, inserts `ResidentNotification` rows for the destination apartment's active residents → resident portal poller (`ResidentNotificationService`) surfaces them; badge counts and history derive from the same committed rows. No-op idempotent replays emit nothing.

### Flow C — Resident tenant + apartment double-predicated read (NEW, Phases 27/30)

Resident JWT → `TenantContext` (tenant, roles=Resident) → `IScopedResidentContext` verifies active portal profile per request and yields `ApartmentId` → repository applies tenant splice + apartment predicate → same underlying tables (`Visits` UNION ledger, `VisitorPreRegistrations`) the porteiro and `/reports` read. Reports module receives the predicate as a forced parameter; caller-supplied `apartmentId` collapses for resident tokens.

---

## Integration Points

### Internal Boundaries (module ↔ module)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Security ↔ Residents | `Security` resolves resident login via a new application abstraction over Residents' resident-profile repo | Mirrors existing `AttendantProfileLoginSupport`; Security cannot query Residents tables directly |
| Visits ↔ AccessControl (lane ↔ badge) | AccessControl's `IssueCredentialHandler` called with `SubjectType.Visitor/SubjectId=Visit.Id` from the Visits-owned lane handler | AccessControl stays credential-sovereign; Visits owns arrival truth |
| Visits ↔ Reports | `GetHistoryHandler` consumes the same `visits`/`access_events` tables; apartment predicate forced from scope context | Keep per-branch explicit `tenant_id` predication (v2.1 Key Decision: interceptor never splices into a UNION) |
| Anything ↔ Notifications | Emission only from inside the canonical arrival transaction (Visits) | No third party may `INSERT INTO ResidentNotifications` — extend the v2.3 single-write-path arch-test grep to it |
| Host ↔ all modules | `Program.cs` DI (`Add…Module()`) + endpoint mapping + shared policies | New DI registrations, policies, rate-limit partitions; middleware order unchanged |

### External / Infrastructure surfaces

| Surface | Integration | Gotcha |
|---------|-------------|--------|
| JWT bearer (`Program.cs:81-95`) | Resident login validates unchanged | Signature/lifetime only — no DB status callback; that's why per-request profile checks are mandatory |
| Fixed-window rate limiter (`Program.cs:186-214`) | Clone the partition-key pattern for lane + login | Headers-forge risk: no `UseForwardedHeaders` today; Traefik hop trust decision owed (open flag, F05) |
| DBTools + `ITenantAwareLinqFactory` | All new repos | No EF Core, no MediatR, minimal APIs only, `ProblemDetails` mapping through existing `GlobalExceptionHandler` |
| `docker/mysql/migrations` | Next numbers: `23-…` root + `0023-…` module series | Append-only ledger tables get triggers only when tamper-evidence is required (ConsentAuditLog precedent); plain ledger tables enforce via repository surface |
| Test harness | Testcontainers.MySql integration + NetArchTest arch + Angular specs | Negative tests (resident→staff endpoints, apt 101→302, tenant A→B) are phase deliverables, not extras; fixtures synthetic per `AGENTS.POLICY.md` |

---

## New vs Modified — consolidated for the roadmap

**Explicitly NEW (nothing exists today):**
1. `IScopedResidentContext` scope resolver (Residents/App + shared usage) — Phase 27
2. `ResidentPortalProfile` entity + repo — Phase 27
3. `ResidentPortalEndpoints` (`/api/v1/portal/*`) — Phase 27 (+28, +30 additive)
4. `residentGuard` + resident portal shell/pages (`features/portal/*`) — Phase 27
5. `VisitorPreRegistration` aggregate + repo + CRUD handlers — Phase 28
6. `PurposeCode` aggregate + repo + admin endpoints — Phase 28
7. `LaneSelfCheckInHandler` + `LaneEndpoints` (`/api/v1/lane/*`) — Phase 29
8. Lane page + badge print flow + E2E journey — Phase 29
9. `ResidentNotification` aggregate + repo + endpoints + `ResidentNotificationService` poller — Phase 30
10. Deny-matrix negative integration test suite — Phase 27 (grows every phase)
11. Migrations `23-/0023+` series (pre-registrations, purpose codes, resident notifications, resident portal profile binding)

**Explicitly MODIFIED (existing code, surgical changes):**
1. `VisitorArrivalHandler` — pre-registration identity binding + purpose snapshot + in-transaction notification emission (Phases 28–30 touchpoints on ONE handler)
2. `VisitDirectoryRepository` (+ its Application abstraction) — apartment/authorization-discriminated lookups
3. `Visit` entity + visits schema columns (`pre_registration_id`, purpose snapshot, optional plate snapshot)
4. `LoginHandler`/`AttendantProfileLoginSupport` — resident profile resolution branch; uniform denial hardening
5. `JwtTokenService` — only if resident claims need an extra marker (recommendation: keep claim set as-is; scope from DB)
6. Every staff `MapGroup(...).RequireAuthorization()` group — explicit role/policy statements (deny matrix); front-end counterpart: shell route `canActivate` tightening
7. `Program.cs` — authorization policies, rate-limit partitions, module DI additions
8. `ReportEndpoints`/`GetHistoryHandler` — forced apartment predication; `apartmentId` param demoted to staff-only
9. `gatehouse-panel.page.ts` — pending-today tab, document match, badge print trigger
10. `app.routes.ts` — portal and lane routes, guard tightening

**Unchanged / deliberately untouched:**
`TenantResolutionMiddleware`, `TenantAwareLinqFactory`/interceptor mechanics, `OpaqueTokenIssuer`, `AccessCredential` + lifecycle handlers, `record scan` consent machinery, the Visits status machine semantics (checkout stays staff-only), the UNION-ledger approach, all other module internals.

---

## Suggested Build Order & Dependency Graph (maps 1:1 to Phases 27–30)

```
P27 [27-01 schema/profile] → [27-02 login+scope] → [27-03 deny matrix + negative tests]
        │ (resident identity + scoped context must exist before anyone touches data)
        ▼
P28 [28-01 pre-reg aggregate+schema] → [28-02 CRUD+resident endpoints] → [28-03 purpose codes] → [28-04 arrival-handler binding]
        │ (consumable authorizations must exist; consumption binding must be wired before any consumer)
        ▼
P29 [29-01 lane resolution+consumption handler] → [29-02 denial security+tests] → [29-03 badge issuance] → [29-04 lane page + print E2E]
        │ (F15: the visitor-facing route ships here, not later)
        ▼
P30 [30-01 scoped history] → [30-02 notifications + emission] → [30-03 panel pre-regs + match + print trigger]
        (history is read-only, safe to land first; emission depends on arrival commit boundary from 28-04; panel consumes everything)
```

Rationale: the deny matrix (P27) is deliberately *before* pre-reg CRUD (P28) — adding resident-portal read endpoints while staff APIs still admit resident JWTs would widen the exact hole gap review F02 flags. Atomic consumption binding (28-04) is the last Phase-28 item so `VisitorArrivalHandler` is wired once, before any of its Phase-29/30 consumers depend on the transactional contract.

---

## Anti-Patterns (project-specific, backed by gap review)

### 1. Second write path into Visits for "convenience"
**Mistake:** Lane/panel/badge flows creating `Visit` rows directly (like Devices was tempted to). **Wrong because:** forks the state machine and re-opens the double-counting bug class v2.1 folded away (Key Decision: Murat's one-door condition). **Instead:** delegate through `VisitorArrivalHandler`; extend the arch-test grep to the new modules.

### 2. Baking apartment scope into the JWT
**Mistake:** `JwtTokenService` gains `apartment_id` and endpoints trust it. **Wrong because:** move-out/reassignment/suspend then require token expiry to take effect — violates RES-01's "next request" semantics (F07). **Instead:** per-request resolution via resident profile (`IScopedResidentContext`).

### 3. Tenant-wide document resolution in resident/lane flows
**Mistake:** Reusing `FindLatestByDocumentAsync` as-is for pre-registration matching. **Wrong because:** same-document cross-apartment Pending/CheckedIn conflict silently serves the wrong household (F03). **Instead:** authorization-bound lookups; conflict → staff disambiguation response with no other-apartment identifiers.

### 4. Extending staff endpoint groups with resident scopes
**Mistake:** Adding resident role checks *inside* `VisitEndpoints` as an afterthought or reusing `/api/v1/residents`. **Wrong because:** authenticated-only groups admit resident JWTs to tenant-wide data (F02). **Instead:** separate `/api/v1/portal/*` groups + explicit deny matrix with negative tests on the staff groups.

### 5. Fake actor identity on self-service writes
**Mistake:** Putting a real `AttendantProfileId` (or `Guid.Empty`, as `Visit.CheckIn` currently accepts at `VisitorArrivalHandler.cs:62`) behind lane arrivals. **Wrong because:** destroys audit attribution (F11). **Instead:** actor-kind field `Visitor@Lane` + trusted lane location; `Guid.Empty`-in-pending stays a documented staff-only fallback.

### 6. Persisting raw pre-auth codes / badge tokens
**Mistake:** Storing the printable token "so reprints work." **Wrong because:** violates the established verifier-only QR contract (`.specs/qr-entrance-exit-access/contracts/access-api.md`; F09/F12). **Instead:** verifier-only storage; reprint = new staff-authorized credential.

---

## Scaling Considerations (pragmatic)

| Concern | Today (single replica) | If multi-replica later | Note |
|---------|------------------------|------------------------|------|
| Rate limiting | Process-local fixed-window (`Program.cs:186-214`) | Distributed limiter or per-partition tables | Existing pattern already carries this documented tradeoff (v2.1 Key Decision ⚠ for forgot-password); lane limiter inherits it — decide explicitly, don't inherit silently |
| Notification delivery | Portal polling on page open | Polling + backoff fine up to thousands of residents | No push infra by decision; `DeviceHealthService` poller pattern already proven |
| Pre-registration expiry | Derived at read; no sweep | Same — indexed status+window makes pending-today queries cheap | Add window-end + status composite index in the migration |
| Idempotency | Per-process IMemoryCache + durable scan-attempt 4-tuple | Durable tables carry it | Follow `RecordAccessScanHandler`'s durable-key pattern (durable > cache idempotency) |

---

## Sources (code-verified, HIGH confidence)

- `src/Modules/Visits/.../Handlers/VisitorArrivalHandler.cs` (read in full)
- `src/Modules/Visits/.../Persistence/VisitDirectoryRepository.cs` (read in full)
- `src/Modules/Visits/.../Domain/Entities/Visit.cs` (read in full)
- `src/Modules/Visits/.../Api/Endpoints/VisitEndpoints.cs` (read in full)
- `src/Modules/AccessControl/.../Handlers/RecordAccessScanHandler.cs` (read in full)
- `src/Modules/AccessControl/.../Handlers/CredentialLifecycleHandlers.cs` (read in full)
- `src/Modules/AccessControl/.../Entities/AccessCredential.cs`, `Services/OpaqueTokenIssuer.cs` (read in full)
- `src/Modules/Reports/.../Endpoints/ReportEndpoints.cs` (read in full)
- `src/Modules/Security/.../Handlers/LoginHandler.cs`, `Persistence/JwtTokenService.cs`, `Domain/Entities/User.cs`, handlers listing (read)
- `src/Modules/Residents/.../Domain/Entities/Resident.cs` (read in full)
- `src/BuildingBlocks/.../MultiTenancy/TenantResolutionMiddleware.cs`, `TenantFilterInterceptor.cs`, `TenantAwareLinqFactory.cs` (read)
- `src/Host/ControlEasyReborn.Api/Program.cs` (auth, limiter, DI, CORS — read)
- `src/Web/ControlEasyReborn.Web/src/app/app.routes.ts`, `core/guards/*`, `features/` layout, `features/gatehouse/` (read/listed)
- `docker/mysql/migrations/` inventory (listed — next series 23-/0023)
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phases 27–30 definitions)
- `.planning/notes/v2-4-codex-gap-review.md` (F01–F18 findings; resolutions cited as decisions from this document)

*Research mode: integration (codebase) — no external web providers used; findings are code-cited at commit state of the current working tree (2026-10-15).*