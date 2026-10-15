# Phase 27: Resident Access Foundation - Research

**Researched:** 2026-10-15
**Domain:** ASP.NET Core 8 JWT authorization (resident credential surface, per-request credential-status policies, staff-endpoint deny matrix) inside the existing multi-tenant monolith
**Confidence:** HIGH (all load-bearing claims verified against in-repo source this session; milestone-level pitfalls pre-verified in `.planning/research/PITFALLS.md`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Implementation Decisions (LOCKED)

**Resident Credential & Identity Model**
- Resident login credentials live in NEW `ResidentCredential` rows in the Residents module (resident-scoped table: BCrypt hash, status, `MustChangePassword`) — never an `AttendantProfiles` row, never a `Users` extension
- Resident JWT carries `credential_id` + `profile_kind: "Resident"` claim instead of an `AttendantProfiles` profile id; staff endpoints require explicit staff role policies, so a resident token fails them structurally — pinned by an explicit test
- Mixed-role (TenantAdmin + Resident) precedence: staff branch wins — if the user has any staff profile, login dispatch resolves staff first; the resident credential is a separate credential and a mixed user gets a staff token on login (explicit mixed-role test)
- Apartment scope for RES-03 isolation is derived server-side per request from live apartment-occupancy/resident records via `ITenantAwareLinqFactory` — never a claim in the JWT, never a snapshot column on the credential

**Per-Request Suspension Check**
- The per-request credential-status check is a custom authorization requirement/policy (`IAuthorizationRequirement` reading `ResidentCredential` status from the DB per request) — inside the normal .NET authorization pipeline, uniform ProblemDetails, integration-testable
- The check hits the DB on every request for resident endpoints (suspension correctness > latency; the "next request after suspend" test demands zero staleness); no caching in v2.4
- A suspended/revoked/missing credential gets HTTP 403 ProblemDetails with the same shape for all three (no enumeration signal); 401 is reserved for missing/invalid JWT
- The same per-request resolver also re-verifies apartment occupancy per request — move-outs revoke visibility immediately

**Deny Matrix & Architecture Enforcement**
- Existing staff endpoints declare their role policy through named policy constants (e.g. `StaffPolicies.TenantAdmin`, `StaffPolicies.Porteiro`, `StaffPolicies.TenantAdminOrPorteiro`) applied per endpoint group/route; zero bare `.RequireAuthorization()` remains
- Architecture enforcement via NetArchTest + endpoint-metadata scan: every mapped endpoint in feature-module `Map*Endpoints` registrations must reference an explicit policy constant — build fails otherwise; the suite re-runs green as Phases 28–30 add endpoints
- Negative suite inventory = exactly the ROADMAP four endpoint classes (tenant-wide visit lists, direct visit/detail reads, visit mutations, reports with caller-supplied `apartmentId`): one negative integration test per class, not per route
- Resident refusal shape: RFC 7807 ProblemDetails 403, standard problem type, no tenant-wide data anywhere in the response body — asserted in the same negative tests

**Provisioning & Resident Surface Scope**
- TenantAdmin provisions resident portal access in the existing `/residents` area: a "Portal Access" section on the resident create/edit flow with create/activate, suspend, revoke actions (mirrors the Phase 24 device-admin UI pattern)
- Resident-facing UI in Phase 27 is login only + the armed `MustChangePassword` flow reusing existing Phase 17/18 machinery — no portal pages yet (they arrive in Phases 28/30)
- Initial password is set by the TenantAdmin at provision time, with `MustChangePassword` armed (same constant-cost path as staff credentials)
- Password recovery is TenantAdmin-reset only: the reset endpoint extended to cover resident credentials (BCrypt ≥ 11 + `MustChangePassword` re-armed + refresh-token revoke); resident hitting any forgot-password flow gets the uniform denial with no enumeration signal

### the agent's Discretion
- Exact table/column naming for `ResidentCredential`, policy-constant naming details, internal handler/repository layout, and test file organization — within codebase conventions

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RES-01 | TenantAdmin provisions/suspends/revokes resident portal access; denial effective on **next request** via per-request credential-status check; password recovery is TenantAdmin-reset only | Per-request `IAuthorizationRequirement`+handler pattern (§ Architecture Patterns P2); provisioning endpoints on the Residenents group; existing `ITempPasswordGenerator`/`IPasswordHasher`/`RevokeAllForUserAsync` reuse (§ Code Examples) |
| RES-02 | Resident login with own credential — same JWT machinery, BCrypt ≥ 11, constant-cost uniform enumeration-safe responses | `LoginHandler` resolver-dispatch design (§ P1); exact current claims/machinery read and quoted (§ Code Examples C1–C2) |
| RES-03 | Apartment-scoped, occupancy-scoped isolation; cross-apartment denial tested on every resident-reachable endpoint; tenant-aware + apartment-scoped repository pattern enforced by resident-surface architecture test | Scope-derivation via `ITenantAwareLinqFactory` + resident record (§ P5); `Resident.ApartmentId` is the live occupancy source (quoted); two-apartment fixture precedent exists (§ Validation Architecture) |
| RES-13 | Staff-endpoint deny matrix + negative integration suite + architecture test | Bare-authorization inventory captured this session (§ P4 table); endpoint-metadata-scan arch test pattern verified (§ P4) |
</phase_requirements>

## Summary

This phase is almost entirely **in-repo authorization-surface work** — no new external packages are needed. Three mechanical changes: (1) extend `LoginHandler` with a resolver-dispatch that, after the staff user lookup, falls through to a Residents-module credential resolver when the caller is not a staff user (never a fake `AttendantProfiles` row); (2) add a `ResidentCredential` table + provisioning endpoints + a per-request credential-status `IAuthorizationRequirement`; (3) sweep every bare `.RequireAuthorization()` on staff endpoint groups into named policy constants and pin both a negative integration suite (resident JWT → 403 ProblemDetails on the four endpoint classes) and a NetArchTest **endpoint-metadata scan** that fails the build for any endpoint without an explicit policy.

Verified this session: `JwtTokenService` emits exactly `sub/jti/tenant_id/profile_id` + role claims (`ClaimTypes.Role` AND `roles`) + `credentials`-style `permissions` claims, 15-minute TTL, HMAC-SHA256; all staff endpoints' deny-matrix gap is real and enumerable — bare group-level `.RequireAuthorization()` with no policy exists on Visits, Reports, Vehicles, Residents reads, Apartments reads, ServiceProviders reads, Administration, Photos/EntryLog/ConsentPolicy groups, AccessControl groups, Security staff groups, Devices groups, and the host FeatureEndpoints (§ Architecture Patterns P4 table for the precise inventory). A resident token (roles=`Resident`, no `permissions` claims) **already fails** every `Permission_*` policy (the `RequirePermissionAuthorizationHandler` only reads `permissions` claims) — the deny matrix's job is the bare-authorization groups.

**Primary recommendation:** Land in this order — (1) deny matrix (named policies + endpoint-scan arch test) → (2) negative integration suite over the four endpoint classes → (3) ` ResidentCredential` schema + provisioning endpoints + per-request credential policy → (4) `LoginHandler`/`RefreshHandler` resident resolver dispatch + session/change-password resident branches → (5) Angular Portal Access modal (Phase 24 `DeviceFormModalComponent` pattern) → tests throughout. The trust precondition is a hard ordering constraint: items (1)–(2) must be merged before any resident-visible data surface is wired.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Staff deny matrix (role policies on existing endpoints) | API/Backend | (arch test in tests/) | Authorization is server-side; bare-auth sweep is endpoint-registration work |
| Negative integration suite (resident JWT refused) | API/Backend (tests) | — | Tests `TenantAwareWebApplicationFactory`-hosted against the real pipeline |
| `ResidentCredential` table + repository | Database/Storage | API/Backend | DBTools-only persistence per constitution (no EF Core) |
| Provisioning endpoints (create/activate/suspend/reactivate/revoke) | API/Backend (Residents module) | Frontend modal | Tenants don't touch Residents' data through other modules |
| TenantAdmin reset for resident password | API/Backend | Frontend write-once panel | Reuses Phase 17/18 machinery; returns password once (UI displays write-once) |
| Resident login dispatch in `LoginHandler`/`RefreshHandler` | API/Backend (Security module) | — | Single login endpoint, server-side branch on credential kind |
| Per-request credential-status + occupancy re-verification | API/Backend (authorization pipeline) | Database | `.NET` requirement/handler; DB hit per request by locked decision |
| Apartment scope derivation per request | API/Backend (repository layer) | Database | Hand-written apartment predicates via `ITenantAwareLinqFactory` (no interceptor net for apartment — PITFALLS #3) |
| Portal Access modal (`PortalAccessModalComponent`) | Frontend (Angular 18) | — | Per locked 27-UI-SPEC.md — one standalone modal, zero new routes |
| MustChangePassword re-arming + `/change-password` flow | Frontend + API | — | Existing guards unchanged; API `change-password` needs a resident branch |

## Standard Stack

### Core (all existing, verified versions)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ASP.NET Core 8 (`Microsoft.AspNetCore.Authentication.JwtBearer`) | 8.0.10 | JWT bearer + policy-based authorization | [VERIFIED: src/Directory.Packages.props] — pinned by global.json SDK 8.0.0 (rollForward latestMajor); host runs dotnet 10.0.402 SDK against it |
| DBTools | 1.4.3 | `IAsyncSqlClient` / `ITenantAwareLinqFactory` (`Linq<TModel>`) — only legal data access | [VERIFIED: src/Directory.Packages.props:DBTools 1.4.3; AGENTS.md prohibition on EF Core] |
| `BCrypt.Net-Next` | 4.0.3 | Resident credential hashing ≥ work factor 11 | [VERIFIED: src/Directory.Packages.props:BCrypt.Net-Next 4.0.3; in-repo `PasswordHasher.WorkFactor = 11` constant] |
| NetArchTest.Rules | 1.3.2 | Deny-matrix + resident-surface architecture tests | [VERIFIED: src/Directory.Packages.props:NetArchTest.Rules 1.3.2] |
| xUnit + Testcontainers.MySql | pinned in src/Directory.Packages.props | Unit + integration suites | [VERIFIED: tests csproj packages; Testcontainers already the integration harness] |
| FluentValidation | 11.9.0 | Request validators for new endpoints | [VERIFIED: src/Directory.Packages.props:FluentValidation 11.9.0] |
| Angular 18 ce-* design system | in-repo | Portal Access modal per 27-UI-SPEC.md | [VERIFIED: design-system/index.ts existence; Phase 24 modal precedent at `src/Web/.../features/devices/components/device-form-modal.component.ts`] |

**No new NuGet or npm packages are required.** Nothing in this phase needs an install step.

### Supporting
| Library | Feature | Purpose | When to Use |
|---------|---------|---------|-------------|
| `System.IdentityModel.Tokens.Jwt` | pinned via JwtBearer | Minting resident token claims | Extending `JwtTokenService` with `credential_id`/`profile_kind` |
| Serilog | 4.0.2 | Structured logging on new credential surfaces | Log ids/outcomes only — no password material, no raw document values (RES-14 posture) |
| Serilog.Sinks.Seq | 6.0.0 | Local log inspection in redaction tests | Reuse the existing SecurityRedactionTests approach |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none — this phase installs zero new external packages) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

All libraries used are already pinned in `src/Directory.Packages.props` and exercised by shipped code — no new legitimacy risk is introduced in Phase 27.

## Architecture Patterns

### System Architecture Diagram

```
 TenantAdmin (Angular /residents)                    Resident (Angular /login)
        │  Portal Access modal                              │ email + password
        │ POST /api/v1/residents/{id}/portal-credential*    │ POST /api/v1/security/auth/login
        ▼ (Permission_Residents.Write)                      ▼ (AllowAnonymous)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ Security API                                                            │
 │   /auth/login  ──► LoginHandler                                            │
 │                        ├─ staff path: Users row found ──► ResolveActive    │
 │                        │                ProfileAsync (staff WINS)          │
 │                        └─ resident path (NEW): email miss/staff miss ────►│
 │                              Residents.ResidentCredentialResolver          │
 │                              (BCrypt ≥ 11, status Active, uniform deny)    │
 │   /auth/refresh ──► RefreshHandler (same dispatch, NEW resident branch)    │
 │   JwtTokenService: staff token = sub/tenant_id/profile_id/roles/perms      │
 │                    resident token (NEW) = sub?/tenant_id/                  │
 │                        credential_id/profile_kind:"Resident"/roles:"Resident"
 │                        (NO permissions claims, NO apartment claim)         │
 └──────────────────────────────────────────────────────────────────────────────┘
        │  resident token on staff endpoints                       │ resident token on
        ▼  (negative suite)                                        │ resident-reachable endpoints
 ┌────────────────────────────────────────┐   ┌────────────────────────────────┐
 │ Staff endpoint groups (Visits,         │   │ Authorization pipeline         │
 │ Reports, Residents, ..., every group): │   │  · policy ResidentCredential   │
 │  RequireAuthorization(StaffPolicies.X) │   │  · handler (per request):      │
 │   └─ RequirePermissionAuthorization    │   │     load credential+Resident,  │
 │      Handler rejects (no permissions   │   │     status==Active? occupancy? │
 │      claims in resident token)         │   │     else 403 ProblemDetails    │
 │   Result: 403 ProblemDetails, no data  │   │  · apartment scope derived     │
 └────────────────────────────────────────┘   │    per request from Resident   │
                                              └────────────────────────────────┘
```

### Recommended Project Structure

```
src/Modules/Residents/
├── ControlEasyReborn.Modules.Residents.Domain/
│   ├── Entities/ResidentCredential.cs       # hash, status, MustChangePassword
│   ├── Entities/ResidentCredentialStatus.cs # Active|Suspended|Revoked (enum or const strings)
│   └── Events/                              # e.g. ResidentCredentialCreated/Revoked (follow ResidentCreated shape)
├── ControlEasyReborn.Modules.Residents.Application/
│   ├── Abstractions/ IResidentCredentialRepository, IResidentCredentialResolver.cs
│   ├── Handlers/ ProvisionResidentCredentialHandler.cs / SetResidentCredentialStatusHandler.cs /
│   │   RevokeResidentCredentialHandler.cs / ResetResidentPortalPasswordHandler.cs
│   ├── Validators/ ...
│   └── Contracts/ ResidentCredentialDtos.cs
├── ControlEasyReborn.Modules.Residents.Infrastructure/
│   └── Persistence/ ResidentCredentialRepository.cs (raw SQL/Linq — same pattern as ResidentRepository)
└── ControlEasyReborn.Modules.Residents.Api/
    ├── Auth/ ResidentPolicies.cs (+ credential-status requirement & handler live here or in Security.Api.Auth)
    └── Endpoints/ ResidentPortalEndpoints.cs (new group, mounted next to ResidentEndpoints)

src/Modules/Security/ (minimal edits, no new module surface)
├── Application/Handlers/LoginHandler.cs          # resident dispatch branch
├── Application/Handlers/RefreshHandler.cs        # resident dispatch branch
├── Application/Handlers/ChangePasswordHandler.cs # resident credential branch (profile_kind)
├── Api/Auth/StaffPolicies.cs                     # NEW policy constants
└── Api/Auth/ResidentCredentialRequirement(.Handler).cs
src/Modules/Tenants Api/... or SecurityEndpoints  # where the staff policy sweep lands (see P4)

docker/mysql/migrations/0023-resident-credentials.sql   # idempotent live migration (0022 pattern)
docker/mysql/init/23-resident-credentials-schema.sql    # init + 03-tenant-backfill entry (SchemaBackfillSyncTests)
tests/ControlEasyReborn.{Unit,Integration,Architecture}Tests/...
```

### Pattern 1: Resident resolver dispatch inside the existing `LoginHandler` (RES-02)

**What:** Keep one login endpoint and one handler. After the staff branch, dispatch by credential kind — never create a fake `AttendantProfiles` row, never a second login endpoint.

**Verified current shape** `[VERIFIED: src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/LoginHandler.cs:39-78]`:

```csharp
var user = await _users.FindByEmailAsync(request.Email, ct);
if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
{
    throw new UnauthorizedException("Invalid email or password.");   // uniform, constant-cost
}
if (!user.Active) { throw new UnauthorizedException("User account is inactive."); }
var activeProfile = await AttendantProfileLoginSupport.ResolveActiveProfileAsync(user, _profiles, _adminProfiles, ct);
if (activeProfile is null)
{
    throw new UnauthorizedException("No active attendant profile found for user.");
}
var token = _jwtService.GenerateAccessToken(user.Id, tenantId, profileId, roles, permissions);
var refreshToken = await _jwtService.GenerateRefreshTokenAsync(user.Id, ct);
return new LoginResponse(token, refreshToken, tenantId, profileId, roles, permissions,
    user.MustChangePassword, DemoPersonas.IsDemoPersona(user.Email));
```

**Verified JWT claims today** `[VERIFIED: .../JwtTokenService.cs:35-47 — quotes verbatim: sub, jti, "tenant_id", "profile_id"; roles emitted as ClaimTypes.Role + "roles"; permissions as "permissions"; TTL default 15 minutes (line 30)]:`

```csharp
var claims = new List<Claim>
{
    new(JwtRegisteredClaimNames.Sub, userId.ToString()),
    new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
    new("tenant_id", tenantId.ToString()),
    new("profile_id", profileId.ToString()),
};
...
claims.Add(new Claim(ClaimTypes.Role, role));
claims.Add(new Claim("roles", role));
...
claims.Add(new Claim("permissions", perm));
```

**Recommended insertion point:** in `LoginHandler.HandleAsync`, attempt the staff branch only when a `Users` row exists for the email **and** it carries a staff role; the resident branch runs when there is no user row (pure resident) — it resolves `ResidentCredential` by resident/credential lookup on the Residents module, verifies BCrypt ≥ 11 through the SAME `IPasswordHasher` (constant-cost: keep the same message `"Invalid email or password."` for wrong-password/unknown/inactive/suspended/revoked so RES-02 uniformity holds), and issues the resident JWT. Mixed-role precedence (locked): if a user row with any staff role is found, the staff branch runs and the resident branch is never consulted — pin with a unit test. Note `RefreshHandler.HandleAsync` uses the **identical** resolver (`RefreshHandler.cs:59-66`), so the resident refresh dispatch must ride the same seam [VERIFIED: .../RefreshHandler.cs:59-66].

Open sub-decision (discretion area): resident token `sub` value + `RefreshTokens` keying. `RefreshTokens.UserId` is a plain Guid today (`JwtTokenService.cs:71-78`), and `RefreshTokenRepository.RevokeAllForUserAsync(Guid userId)` is the revoke-all primitive [VERIFIED: RefreshTokenRepository.cs — method signature read this session]. Recommendation: resident refresh rows key on the resident/credential id with an explicit discriminator (e.g. `subject_kind` column or `profile_kind` claim re-resolved by the refactorer at refresh time) so `RevokeAllForUser` also works for residents — the password-revoke flow needs it.

### Pattern 2: Per-request credential-status + occupancy re-verification (RES-01/RES-03)

**What:** A named policy (e.g. `ResidentPolicies.ResidentCredential`) with a custom `IAuthorizationRequirement`; its handler queries the DB **every request** (locked decision: no caching) for `ResidentCredential` (via `credential_id` claim) — status must be Active AND the resident must still occupy an apartment (`Residents.ApartmentId` live read) — else fail the requirement, surfaced as uniform 403 ProblemDetails.

**CRITICAL TRAP (verified class of failure):** the existing handlers are registered **singleton** in Program.cs (`AddSingleton<IAuthorizationHandler, RequirePermissionAuthorizationHandler>` at Program.cs:114-115). Registering a DB-dependent `IAuthorizationHandler` as **scoped** throws `InvalidOperationException: Cannot resolve 'IAuthorizationHandlerProvider' from root provider because it requires scoped service 'IAuthorizationHandler'` because the singleton `IAuthorizationHandlerProvider` is built from the root provider [CITED: https://github.com/dotnet/aspnetcore/issues/43188]. Registered DI lifetime in this repo: `ITenantAwareLinqFactory` is **singleton**, `ITenantContext` is **scoped** [VERIFIED: src/BuildingBlocks/ControlEasyReborn.Infrastructure/Data/ServiceCollectionExtensions.cs:47-49 — quotes: `services.TryAddSingleton<TenantAwareLinqFactory>(); services.TryAddSingleton<ITenantAwareLinqFactory>(sp => sp.GetRequiredService<TenantAwareLinqFactory>()); services.TryAddScoped<ITenantContext, HttpTenantContext>();`].

**Recommended handler shape** (singleton + request-scoped resolution):

```csharp
public sealed class ResidentCredentialAuthorizationHandler
    : AuthorizationHandler<ResidentCredentialRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, ResidentCredentialRequirement requirement)
    {
        if (context.Resource is not DefaultHttpContext http) return;      // endpoint routing default
        var tenantContext = http.RequestServices.GetRequiredService<ITenantContext>();
        var credentialId = context.User.FindFirst("credential_id")?.Value;
        var profileKind  = context.User.FindFirst("profile_kind")?.Value;
        // staff branch: no resident claims → do not fail (deny matrix handles staff endpoints);
        // resident branch: resolve credential + resident per request via ITenantAwareLinqFactory
        // → status==Active && Active row && ApartmentId present → Succeed; else fail
        // → 403 ProblemDetails with identical shape for Suspended/Revoked/Missing (locked decision)
    }
}
```

The 403 (not 401) must be produced inside the pipeline: policy failure at endpoint routing yields 403 by default (`ForbidResult` → `IAuthenticationService.ForbidAsync` → 403 with the default scheme), which the GlobalExceptionHandler/ProblemDetails path renders as RFC 7807 — integration tests must assert the body shape (locked decision: uniform 403 ProblemDetails, 401 reserved for missing/invalid JWT).

**Where the policy applies in Phase 27:** the only resident-reachable endpoints this phase are the login-adjacent ones — `/auth/change-password` (MustChangePassword flow) and the session-establishment read. Both are bare `.RequireAuthorization()` today [VERIFIED: SecurityEndpoints.cs:57 and :279 — `}).RequireAuthorization();`]. Recommendation: introduce a policy (e.g. `ResidentPolicies.StaffOrResident` — succeeds for a staff-role token OR an active resident credential) applied to these two endpoints, while resident DATA surfaces in Phases 28–30 use the strict `ResidentCredential` policy alone. The suspension integration test needs one resident-authenticated GET to run the sequence "issue live token → suspend → same token's NEXT request → denied → reactivate → allowed" — `/auth/session` with a resident branch in `GetSessionHandler` (it currently hard-requires `ProfileId` → `AttendantProfile` [VERIFIED: GetSessionHandler.cs:35-39 — throws `"No active profile in current token."` when `ProfileId` is null]) is the minimal surface that satisfies the test without adding portal pages.

### Pattern 3: Apartment scope derivation, per request (RES-03)

**What:** Resident-reachable repositories take an apartment parameter derived per request, not from the JWT. There is **no interceptor net for apartment** — `TenantFilterInterceptor` only guarantees the tenant predicate; apartment predicates are hand-written per query [CITED: .planning/research/PITFALLS.md Pitfall 3, code-verified there].

**Verified live occupancy source** `[VERIFIED: src/Modules/Residents/ControlEasyReborn.Modules.Residents.Domain/Entities/Resident.cs:6-12,38-45 — quotes: Resident has `TenantId`, `ApartmentId` (nullable Guid), `Active`; `UpdateDetails(... Guid? apartmentId)` freely rewrites it; no occupancy-period history exists]`:

```csharp
public Guid TenantId { get; private set; }
...
public Guid? ApartmentId { get; private set; }
public bool Active { get; private set; }
```

In Phase 27 nothing resident-visible reads data yet, so the deliverables are: (a) the `ResidentCredentialResolver` that loads `ResidentCredential.Join(Resident)` and returns `(residentId, apartmentId, tenantId)` per request from live rows; (b) the two-apartment-fixture integration test that proves a resident of apartment 101's scope token never returns apartment 302's data (prove it on the session/profile surface available this phase); (c) the **resident-surface architecture test** (Pattern 5) that Phases 28–30 will satisfy per endpoint.

### Pattern 4: Deny matrix — named policies + endpoint-metadata scan (RES-13)

**Verified inventory of bare `.RequireAuthorization()` (no policy) — the exact deny-matrix surface.** All quotes from this session's grep + reads:

| File | Line | Bares found |
|------|------|-------------|
| `src/Modules/Visits/.../VisitEndpoints.cs` | :16 | group `.RequireAuthorization()` — all 5 endpoints (list, detail, create, checkin, checkout) inherit bare auth |
| `src/Modules/Reports/.../ReportEndpoints.cs` | :15, :69 | both groups (reports + dashboard) bare; `/history` accepts caller-supplied `apartmentId` query param [VERIFIED: ReportEndpoints.cs:37] |
| `src/Modules/Vehicles/.../VehicleEndpoints.cs` | :17 | group bare (:49, :59 writes already `Permission_Vehicles.Write`) |
| `src/Modules/Residents/.../ResidentEndpoints.cs` | :17 | group bare; reads (list+detail) bare, writes `Permission_Residents.Write` (:51,:61) |
| `src/Modules/Apartments/.../ApartmentEndpoints.cs` | :16 | group bare; writes `Permission_Apartments.Write` (:49,:59) |
| `src/Modules/ServiceProviders/.../` | :17 | group bare; writes `Permission_ServiceProviders.Write` (:50,:60,:69) |
| `src/Modules/Administration/.../AdministrationEndpoints.cs` | :17 | group bare — executor must inventory per endpoint inside |
| `src/Modules/AccessControl/.../AccessEventsEndpoints.cs` | :20, :191 | `/scans` group bare; `/search` group bare; `/`, `/refused-attempts`, `/manual` named (`Permission_Access.*`) |
| `src/Modules/AccessControl/.../AccessCredentialsEndpoints.cs` | :19 | group bare; detail/list/issue/replace/revoke named |
| `src/Modules/AccessControl/.../AccessControlEndpoints.cs` | :12 | `/_meta` bare |
| `src/Modules/Photos/.../{Photos,EntryLog,ConsentPolicy}Endpoints.cs` | :19, :21, :16 | groups bare; inner endpoints named `Permission_Photos.*` etc. |
| `src/Modules/Devices/.../{Device,DeviceEvent,DeviceHealth,SimulatorInspector}Endpoints.cs` + Devices `TenantEndpoints.cs` | :17, :18, :14, :154/183, :17 | groups bare; inner endpoints named `Permission_devices.*` / `Permission_tenants.toggle_door_integration` |
| `src/Modules/Security/.../SecurityEndpoints.cs` | :57 (change-password), :84 (user reset-password!), :95 (staff), :98 (attendant-profiles group incl. `/me`), :160 (shifts), :186 (gatehouses group — with an **inline** `Permission_devices.write` check inside the handler at :210-220, not a policy), :271 (tenant-switch), :279 (session) | all bare |
| `src/Host/.../Hosting/FeatureEndpoints.cs` | :14 | bare |
| (anonymous, exempt) | security `/auth/login`, `/auth/forgot-password`, `/auth/refresh`, `/tenants` lookup, bootstrap, Tenants module `PlatformAdminRequirement.PolicyName` groups, Demo `PlatformAdminOnly` | already explicit |

**Policy design (recommendation, discretion within locked shape):** define `StaffPolicies` constants — `TenantAdmin`, `Porteiro`, `TenantAdminOrPorteiro` — registered once in `Program.cs`/`AddAuthorization` as `RequireRole("TenantAdmin")`-style policies (JWT already flattens `user.Roles` into `ClaimTypes.Role` AND `roles` claims [VERIFIED: JwtTokenService.cs:43-47]; `TenantResolutionMiddleware` reads both [VERIFIED: TenantResolutionMiddleware.cs:30-33]). Sweep: replace the bare group-level `.RequireAuthorization()` with `.RequireAuthorization(StaffPolicies.TenantAdminOrPorteiro)` (staff read surfaces) or `.RequireAuthorization(StaffPolicies.TenantAdmin)` (admin surfaces) — keep existing named `Permission_*` policies on inner endpoints; those already refuse residents structurally because `RequirePermissionAuthorizationHandler` only reads `permissions` claims [VERIFIED: RequirePermissionAuthorizationHandler.cs:10-11 — `var permissions = context.User.FindAll("permissions").Select(c => c.Value); if (permissions.Contains(requirement.Permission)) context.Succeed(...)`].

**Two semantic traps for the sweep:**
1. **Actor-bearing endpoints assume a staff profile.** `POST /visits` reads `tenantContext.ProfileId` and `checkin` throws if it is null [VERIFIED: VisitEndpoints.cs:50-53,63-64]. A policy that admitted non-staff would crash here — the role policy is what prevents it. Similarly `/users/{id}/reset-password` is bare but handler-gated (`ResetUserPasswordHandler.cs:44-50` throws `ForbiddenException` for non-admins) — replace with an explicit policy; the in-handler check stays as defense-in-depth.
2. **`SecurityEndpoints` login-adjacent endpoints need OR-semantics.** `/auth/change-password` and `/auth/session` must keep working for staff AND accept resident tokens in Phase 27. ASP.NET policy semantics AND all requirements by default, so use a single custom requirement that succeeds for staff-role tokens or for a live resident credential (Pattern 2's handler), not two stacked requirements.

**Architecture test (endpoint-metadata scan)** — recommended shape, verified viable:

```csharp
// In tests/ControlEasyReborn.ArchitectureTests/, spin the factory (WebApplicationFactory<Program>),
// then: var ds = factory.Services.GetRequiredService<EndpointDataSource>();
// foreach RouteEndpoint e in ds.Endpoints:
//   if (e.Metadata.OfType<IAllowAnonymous>().Any()) continue;             // login/forgot/refresh/etc.
//   var auth = e.Metadata.OfType<IAuthorizeData>().ToList();
//   auth.Should().NotContain(a => string.IsNullOrWhiteSpace(a.Policy));    // bare RequireAuthorization() => Policy ""
//   and require the "profile_kind" resident-surface check separately for resident endpoints.
```

Endpoint authorization metadata is merged into `RouteEndpoint.Metadata` (`RequireAuthorization()` → `AuthorizeAttribute` with **empty** `Policy`; `RequireAuthorization(name)` → populated `Policy`) and is inspectable from `EndpointDataSource` after build [CITED: https://andrewlock.net/behind-the-scenes-of-minimal-apis-1-a-first-look-behind-the-scenes-of-minimal-api-endpoints; https://andrewlock.net/behind-the-scenes-of-minimal-apis-2-describing-custom-metadata (endpoint metadata) — Medium follow-up by A. Simmons covers the same]. NetArchTest handles type-level rules (reuse `LayerDependencyTests`/`AccessControlTenantRulesTests` patterns for the repository-pattern enforcement), while the route-level scan is a plain xUnit reflection-over-endpoints test — both live in `tests/ControlEasyReborn.ArchitectureTests` and both fail the build.

### Pattern 5: Resident-surface architecture test (pattern reused by Phases 28–30)

Two rules, NetArchTest + reflection, in `tests/ControlEasyReborn.ArchitectureTests/ResidentSurfaceRulesTests.cs`:
1. Every class in `ControlEasyReborn.Modules.Residents.*` used by a resident endpoint's handler (naming-convention seeded, e.g. `*Portal*`, `IResidentCredential*`, or an explicit `[ResidentSurface]` marker attribute added this phase) must depend on `ITenantAwareLinqFactory` (tenant-aware) — mirroring `AccessControlTenantRulesTests` reflection style [VERIFIED: AccessControlTenantRulesTests.cs:57-80].
2. `JwtTokenService.GenerateAccessToken` must never add an `apartment` claim — assert the issued token's claims in a unit test on the resident path (JWT apartment claim is the stale-membership hole; PITFALLS #2).

### Anti-Patterns to Avoid
- **Fake `AttendantProfiles` row for residents** — feeds `profile_id` into audit/actor surfaces; locked decision forbids it.
- **Second login endpoint (`/auth/resident-login`)** — locked decision: resolver dispatch inside `LoginHandler` only.
- **Apartment or `credential`-status claims in the JWT** — stale-membership/stale-status hole; per-request DB check is the locked semantics.
- **`OnTokenValidated` global DB callback** — hits the DB on every staff request too; PITFALLS #2 lists the scope error explicitly. Status check scoped to resident policy only.
- **Caching credential status** — locked decision: no caching in v2.4.
- **In-handler-only authorization on `/users/{userId}/reset-password`** — handler checks are defense-in-depth, not the deny matrix; explicit policy is required by the arch test.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash/verify or work factor < 11 | `IPasswordHasher` (`BCrypt.Net-Next`, `WorkFactor = 11` const) | Same constant-cost path as staff; constitution bar BCrypt ≥ 11 [VERIFIED: PasswordHasher.cs:8] |
| Enumeration-safe login denials | Timing-juggling custom "equal cost" paths | Reuse `UnauthorizedException("Invalid email or password.")` + decoy verify precedent in ForgotPasswordHandler [VERIFIED: ForgotPasswordHandler.cs:15,83-85 — `DecoyHash = BCrypt.Net.BCrypt.HashPassword("DecoyDummyPassword123!", workFactor: 11)`] | Already built and tested (Phase 17/18) |
| Temp password generation | Own generator | `ITempPasswordGenerator.Generate(12)` [VERIFIED: ResetUserPasswordHandler.cs:74] | Existing 12-char unambiguous charset |
| Refresh-token lifecycle | Parallel resident token store | `IRefreshTokenRepository.RevokeAllForUserAsync` + resident dispatch | One revoke-all primitive covers password-change/reset flows |
| Endpoint policy registration | Per-endpoint hand-rolled `Requirements.Add` | Program.cs `AddAuthorization` loop pattern (Permission_ policies) + `StaffPolicies` constants [VERIFIED: Program.cs:102-112] | Named, testable, arch-test-compatible |
| Endpoint inventory assertion | Grep-based source parsing in CI | `EndpointDataSource` metadata scan (Pattern 4 code) | Route-matching already merges group+endpoint metadata; grep misses groups/imports |
| ProblemDetails | Hand-built error JSON in new handlers | GlobalExceptionHandler + `AddProblemDetails` + existing module ProblemDetails writers [VERIFIED: Program.cs:144-145; SecurityProblemDetailsWriter pattern] | RFC 7807 uniformity is a constitution requirement |

**Key insight:** Phase 27 is a *wiring* phase — nearly every security primitive it needs (hashing, decoy-verify, temp passwords, refresh revoke, tenant filter, ProblemDetails, rate limits) already exists and is battle-tested in Phases 17–18. The genuinely new constructs are exactly four: `ResidentCredential` schema, the login/refresh resolver branch, the per-request credential requirement, and the deny-matrix sweep — everything else should be consumed, not built.

## Common Pitfalls

### Pitfall 1: Scoped `IAuthorizationHandler` registration explodes at runtime
**What goes wrong:** Executor registers the DB-reading credential handler via `AddScoped<IAuthorizationHandler, ...>` → `InvalidOperationException ... Cannot resolve 'IAuthorizationHandlerProvider' from root provider` on first request.
**Why:** the handler provider is a singleton built from the root provider; scoped handlers are not resolvable there [CITED: dotnet/aspnetcore#43188].
**How to avoid:** register singleton (matching the repo's existing two handlers, Program.cs:114-115) and pull scoped `ITenantContext`/DB client through `context.Resource` (HttpContext).`RequestServices` or `IServiceScopeFactory`, per Pattern 2.
**Warning signs:** green unit tests (which activate authorization from a scoped test host) that crash in integration tests only.

### Pitfall 2: Suspension test masked by re-login
**What goes wrong:** test suspends then logs in again → passes; live-token staleness never proven. The success criterion requires the **same token's NEXT request** after the mutation.
**How to avoid:** hold the HttpClient/token; suspend via a second (TenantAdmin) client; call with the first client without re-authenticating. Reactivate → next request allowed. Exact sequence in RES-01.
**Warning signs:** any `login()` call after the suspend step in the test body.

### Pitfall 3: Resident token passes `Permission_*`-gated endpoints' neighbors but bare groups admit it
**What goes wrong:** partial sweep — someone converts the Visits group but misses `Administration`, `AccessControl /_meta`, `/users/{userId}/reset-password`, or the host `FeatureEndpoints`.
**Why:** 12 modules × dozens of routes; nearest-example copying.
**How to avoid:** the endpoint-metadata arch test (Pattern 4) is the enforcement — it fails the build listing every unannotated endpoint, and it re-runs for Phases 28–30 automatically.
**Warning signs:** `Policy == ""` in the failure list; a "temporary" `RequireAuthorization()`.

### Pitfall 4: Uniform-deny regression on the resident login branch
**What goes wrong:** the resident branch returns 403 "suspended" for a suspended credential before password verification — a timing/behavior distinguisher between "wrong password" and "suspended", and an enumeration signal (email existence probe via status codes).
**How to avoid:** verify password against the fetched credential hash FIRST (constant cost), then fail on status inside the uniform `UnauthorizedException("Invalid email or password.")` path; 403 is for the **pipeline** (per-request policy), the login flow itself stays uniform-401. Distinguish the two surfaces explicitly in tests.
**Warning signs:** distinct error messages/details per failure factor on `/auth/login`.

### Pitfall 5: Forgetting `RefreshHandler`, `ChangePasswordHandler`, `GetSessionHandler`, `GetMyProfileHandler` resident branches
**What goes wrong:** login works but the first token refresh throws `"No active attendant profile found for user."` [VERIFIED: RefreshHandler.cs:63] or `/auth/change-password`/`/auth/session` throw on the missing `profile_id` claim [VERIFIED: ChangePasswordHandler.cs:60-61 and GetSessionHandler.cs:35-36 — both require `ProfileId`].
**How to avoid:** enumerate every handler that resolves identity via `ProfileId`/`AttendantProfile` as part of the resident-dispatch task; each gets an explicit profile_kind branch.
**Warning signs:** resident can log in but immediately 401s on refresh or cannot complete MustChangePassword.

### Pitfall 6: `SchemaBackfillSyncTests` breaks on the new table
**What goes wrong:** new `ResidentCredential` init script's `CREATE TABLE` is not reflected in `docker/mysql/init/03-tenant-backfill.sql` → architecture test fails the build [VERIFIED: SchemaBackfillSyncTests.cs:13-64 — every CREATE TABLE in init must be listed (tenant_id backfill) or exempt].
**How to avoid:** add the migration pair (00XX live migration + init script) AND the backfill entry in the same commit, following the `0022-gatehouse-lifecycle.sql` idempotent pattern [VERIFIED: docker/mysql/migrations/0022-gatehouse-lifecycle.sql:1-14 — information_schema-guarded ALTER + index].

## Code Examples

### C1 — Resident JWT issue (extend `IJwtTokenService`/`JwtTokenService`)
```csharp
// Resident variant keeps the same signing config + 15-min TTL; adds credential_id + profile_kind.
// NO apartment claim (locked decision), NO permissions claims (that's what makes
// Permission_* policies structurally refuse residents).
var claims = new List<Claim>
{
    new(JwtRegisteredClaimNames.Sub, subjectId.ToString()),
    new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
    new("tenant_id", tenantId.ToString()),
    new("credential_id", credentialId.ToString()),   // NEW
    new("profile_kind", "Resident"),                 // NEW
    new(ClaimTypes.Role, "Resident"),
    new("roles", "Resident"),
};
```

### C2 — Deny-matrix sweep (before/after)
```csharp
// Before (VisitEndpoints.cs:15-17 — quoted):
var group = app.MapGroup("/api/v1/visits")
    .RequireAuthorization()
    .WithTags("Visits");

// After:
var group = app.MapGroup("/api/v1/visits")
    .RequireAuthorization(StaffPolicies.Staff)     // explicit role policy constant
    .WithTags("Visits");
// Program.cs: options.AddPolicy(StaffPolicies.Staff,
//                    policy => policy.RequireRole("TenantAdmin", "Porteiro", "PlatformAdmin"));
// A resident token (roles = "Resident" only) fails RequireRole → 403, no data (negative suite asserts).
```

### C3 — Provisioning endpoint (Residents module, mirrors existing write pattern)
```csharp
// ResidentPortalEndpoints.cs — same shape as ResidentEndpoints.cs:41-51 (quoted pattern):
portalGroup.MapPost("/{residentId:guid}/portal-credential", async (
    Guid residentId,
    [FromBody] ProvisionResidentPortalRequest request,
    ITenantContext tenantContext,
    ProvisionResidentCredentialHandler handler,
    CancellationToken ct) =>
{
    var tenantId = tenantContext.TenantId
        ?? throw new InvalidOperationException("Tenant context is not resolved.");
    var response = await handler.HandleAsync(residentId, tenantId, request, ct);
    return Results.Created($"/api/v1/residents/{residentId}/portal-credential", response);
}).RequireAuthorization(StaffPolicies.TenantAdmin);   // or Permission_Residents.Write per discretion
// Actions: POST .../suspend, POST .../reactivate, POST .../revoke, POST .../reset-password
// One credential per resident: UNIQUE (tenant_id, resident_id) in schema.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bare `RequireAuthorization()` per group (v1 habit) | Named policy constants (`Permission_*` since v2.1, `StaffPolicies` now) | Permission policies already exist (Program.cs:102-112 [VERIFIED]); staff-role sweep is this phase | deny matrix becomes mechanically enforced |
| Staff-only assumed-authenticated surface | Two credential kinds under one login + per-request credential-state check | Phase 27 | residents are lowest-trust principals — live-token suspension semantics |
| JWT carries profile_id as actor | Resident JWT carries credential_id + profile_kind instead | Phase 27 (locked) | actor surfaces (audit rows) must not attribute residents to attendants |

**Deprecated/outdated for this codebase:** `OnTokenValidated`-style callback checks (global, unscoped), storing membership in tokens, cached authorization decisions — all explicitly out for v2.4.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Resident login flow has **no `Users` row** to anchor `sub`; recommendation is resident/credential id as `sub` with an explicit refresh-token discriminator (`subject_kind`-style column or re-resolution at refresh) | Pattern 1 | If the planner prefers giving residents `Users` rows, provisioning/mixed-role flows change shape — CONTEXT forbids a `Users` *extension* but not necessarily rows; needs the planner/discuss confirmation |
| A2 | Policy constant naming (`StaffPolicies.Staff` / `.TenantAdmin` / `.TenantAdminOrPorteiro`) and applying role policies at group level while keeping `Permission_*` per endpoint | Pattern 4 | Purely naming/placement — discretion area; group-level role policies could be too coarse if some group inner endpoints are tenant-admin-only (Administration settings PUT etc.) — executor must verify per endpoint |
| A3 | The suspension sequence test can ride `/auth/session` (with a resident branch in `GetSessionHandler`) as the minimal resident-authenticated surface | Pattern 2 | If planner prefers a dedicated minimal endpoint (e.g. `GET /api/v1/residents/portal/session`), the test target changes but the shape is unaffected |
| A4 | ASP.NET endpoint authorization middleware yields 403 on policy failure with the default scheme (uniform ProblemDetails via the existing pipeline) | Pattern 2 | If a different status emerges (e.g. 401 re-prompt), the negative suite's asserted status code needs adjusting; integration test will pin it |
| A5 | Testcontainers integration harness works unchanged for a new module's endpoints; two-apartment seeding follows the raw-SQL insert precedent (`SeedApartmentForTenantAAsync`) | Validation Architecture | Low risk — established pattern |

## Open Questions (RESOLVED)

All three questions were settled at plan time; resolutions are pinned in plan content. Per-question pointers:

1. **Resident refresh-token keying (`sub`/`RefreshTokens.UserId` collision space)** — RESOLVED: explicit `SubjectKind` VARCHAR(32) column on `RefreshTokens` added in migration 0023, DEFAULT 'Staff' so staff rows are unaffected; resident refresh rows carry 'Resident'. Resolved in Plan 02 Task 1 (schema trio) and Plan 03 Task 3 (refresh dispatch branching on SubjectKind).
   - What we know: `RefreshTokens.UserId` is a bare Guid keyed on `Users` ids; residents have no `Users` row; `RevokeAllForUserAsync` must revoke resident tokens too (password-reset flow requires it).
   - What's unclear: whether to add a discriminator column to `RefreshTokens` or re-resolve by trying Users-then-ResidentCredential at refresh time (ambiguity risk: an accidental Guid collision is cryptographically improbable but schema honesty matters).
   - Recommendation: add an explicit `subject_kind`/`profile_kind` column to `RefreshTokens` in the 0023 migration; defaults keep staff rows unaffected. ~~Settle at plan time.~~ — settled as above.
2. **Policy granularity inside Administration/AccessControl groups** — RESOLVED: group-level staff-role default (`StaffPolicies.Staff` / `StaffPolicies.TenantAdminOrPorteiro` shapes), escalating to `StaffPolicies.TenantAdmin` where the handler assumes admin (settings PUT routes, staff listing, Administration module, `staff` listing); the negative suite covers classes, not routes, so the coarse default is safe. Resolved in Plan 01 Task 2 (policy granularity discretion block).
   - What we know: group-level policies are coarse; some inner endpoints (Administration settings PUT, audit-log writes) may be TenantAdmin-only while others serve Porteiro.
   - What's unclear: exact per-endpoint role split — no existing doc enumerates it.
   - Recommendation: conservative default `TenantAdminOrPorteiro` at group level, escalate specific tenant-admin-only routes to a `TenantAdmin` policy; the negative suite covers classes, not routes, so the coarse default is safe. ~~Confirm in plan.~~ — confirmed as above.
3. **Mixed-role user whose staff side is deactivated** — RESOLVED: hard-fail with the existing uniform message, never silently escalate to the resident branch; pinned with the LoginHandler dispatch-matrix unit test (inactive-staff case asserts the resident lookup is never invoked). Resolved in Plan 03 Task 2.
   - What we know: locked decision = staff branch wins; but if a mixed user's staff profile is inactive, current staff path throws `"No active attendant profile found for user."`.
   - What's unclear: fall back to resident branch, or hard-fail?
   - Recommendation: hard-fail with the existing uniform message (never silently escalate to a lower-trust token); pin with a unit test. ~~Confirm in plan.~~ — confirmed as above.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | backend build/tests | ✓ | 10.0.402 (global.json pins 8.0.0, rollForward latestMajor) [VERIFIED: global.json + `dotnet --version`] | — |
| Docker (Testcontainers.MySql) | integration suite | ✓ | 29.8.0 [VERIFIED: `docker --version`] | — |
| Node.js | Angular build/tests/lint | ✓ | 26.5.0 [VERIFIED: `node --version`] | — |
| MySQL (local compose) | manual dev run | ✓ via docker | 8 (compose) | Testcontainers bootstraps its own container for tests |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | xUnit (unit + integration + architecture, three projects) |
| Config file | csproj-based; `tests/ControlEasyReborn.UnitTests`, `tests/ControlEasyReborn.IntegrationTests` (Testcontainers.MySql + `TenantAwareWebApplicationFactory`), `tests/ControlEasyReborn.ArchitectureTests` (NetArchTest.Rules 1.3.2) |
| Quick run command | `dotnet test tests/ControlEasyReborn.UnitTests` |
| Full suite command | `dotnet test tests/ControlEasyReborn.UnitTests && dotnet test tests/ControlEasyReborn.ArchitectureTests && dotnet test tests/ControlEasyReborn.IntegrationTests` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RES-13 | Endpoint-metadata scan: no bare `RequireAuthorization()` on any non-anonymous endpoint | arch (xUnit/scan) | `dotnet test tests/ControlEasyReborn.ArchitectureTests --filter "FullyQualifiedName~EndpointAuthorization"` | ❌ Wave 0 |
| RES-13 | Negative suite: resident JWT → 403 ProblemDetails, no data, on each of the 4 endpoint classes (visit lists, direct visit/detail reads, visit mutations, reports with `apartmentId`) | integration (one test per class) | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ResidentDenyMatrix"` | ❌ Wave 0 |
| RES-01 | Provisioning: create/activate/suspend/reactivate/revoke lifecycle + one-credential-per-resident | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ResidentPortal"` | ❌ Wave 0 |
| RES-01 | Same-token suspension sequence (issue → suspend → next request 403 → reactivate → allowed) | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ResidentPortal"` | ❌ Wave 0 |
| RES-02 | Resident login dispatch: success, uniform deny (unknown/wrong-password/inactive/suspended/revoked indistinguishable), mixed-role staff-wins | unit (LoginHandler) | `dotnet test tests/ControlEasyReborn.UnitTests --filter "FullyQualifiedName~LoginHandler"` | ✅ exists — extend (`LoginHandlerTests.cs`) |
| RES-02 | Refresh dispatch + password change (`profile_kind` branch) + reset re-arms `MustChangePassword` | unit + integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~PasswordResetTests"` (also Security suite) | ✅ exists — extend |
| RES-03 | Per-request occupancy re-verification (scope moves with `Residents.ApartmentId`; no apartment claim in JWT) | integration + unit | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ResidentPortal"` | ❌ Wave 0 |
| RES-03 | Resident-surface arch rules (tenant-aware + apartment-scoped repository pattern) | arch | `dotnet test tests/ControlEasyReborn.ArchitectureTests --filter "FullyQualifiedName~ResidentSurfaceRules"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** quick run — unit + architecture projects.
- **Per wave merge:** full suite command (integration spins Testcontainers MySQL).
- **Phase gate:** full suite green before `/gsd-verify-work` (plus `scripts/verify-ci-local.sh --fast` per AGENTS.POLICY.md two-tier gate).

### Wave 0 Gaps
- [ ] `tests/ControlEasyReborn.ArchitectureTests/EndpointAuthorizationScanTests.cs` — deny-matrix enforcement (RES-13); Wave 0 because it gates every subsequent endpoint edit
- [ ] `tests/ControlEasyReborn.ArchitectureTests/ResidentSurfaceRulesTests.cs` — apartment-scoped repository pattern (RES-03), reused by Phases 28–30
- [ ] `tests/ControlEasyReborn.IntegrationTests/Residents/ResidentPortalTests.cs` (+ two-apartment fixture helpers extending `TenantAwareWebApplicationFactory` seeding for `Residents` rows) — RES-01/RES-02/RES-03
- [ ] Schema artifacts pair: `docker/mysql/migrations/0023-resident-credentials.sql` + `docker/mysql/init/23-...schema.sql` + `03-tenant-backfill.sql` entry (keep `SchemaBackfillSyncTests` green)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | BCrypt ≥ 11 via `IPasswordHasher` (WorkFactor const 11); enumeration-safe uniform denials + decoy hash precedent; FluentValidation on all requests |
| V3 Session Management | yes | Same JWT bearer machinery (15-min access + refresh w/ revoke); `RevokeAllForUserAsync` on password change/reset; per-request credential status policy |
| V4 Access Control | yes | `StaffPolicies` named role policies (deny matrix); `IAuthorizationRequirement` per-request credential check; endpoint-metadata arch test |
| V5 Input Validation | yes | FluentValidation validators for all new requests (existing pattern) |
| V6 Cryptography | yes | BCrypt for credentials; HMAC-SHA256 JWT signing (existing config) — never hand-rolled |
| V7 Error Handling & Logging | yes | ProblemDetails RFC 7807 everywhere; Serilog structured logs — log ids/outcomes only, no password material (Phase 17/18 precedent) |

### Known Threat Patterns (JWT-based multi-tenant authn)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Resident JWT replayed against staff endpoints after provisioning bug | Elevation of Privilege | Deny matrix + negative suite + arch scan (RES-13); staff role policies structurally require staff role claims |
| Live-token staleness on suspend/revoke | Elevation of Privilege | Per-request DB check; same-token sequence test (zero staleness) |
| Cross-apartment data access inside tenant | Information Disclosure | Per-request occupancy re-verification + apartment-scoped repositories + two-apartment fixtures; no apartment claim in JWT |
| Credential enumeration on login | Information Disclosure | Uniform messages + constant-cost decoy verify + BCrypt cost on every path |
| Enumeration via credential-status differences | Information Disclosure | Identical 403 ProblemDetails shape for suspended/revoked/missing (locked decision) |
| Tenant filter bypass via raw SQL | Tampering | `ITenantAwareLinqFactory` + tenant predicates per repo; `TenantFilterInterceptor` as net |

## Project Constraints (from AGENTS.md)

- **Stack & architecture:** ASP.NET Core 8 modular monolith + Angular 18 SPA + MySQL 8 + Docker Compose + JWT bearer; Clean Architecture per module (Domain/Application/Infrastructure/Api); **no EF Core, no MediatR, no MVC controllers** — DBTools 1.4.3 `IAsyncSqlClient`/`Linq`, handler-based application layer, minimal APIs via `Map*Endpoints`.
- **Security bar:** BCrypt ≥ 11, `ProblemDetails` (RFC 7807), all tenant-scoped reads/writes via `ITenantAwareLinqFactory`, Serilog structured logging, **no cross-tenant access**, **no real-user data in tests** (synthetic fixtures only).
- **Load `AGENTS.POLICY.md` before any non-trivial change** (two-tier local CI gate `scripts/verify-ci-local.sh`; `AGENTS.STACK.md` for C#/Angular conventions; worktree rule for execution).
- Angular SPA edits: after any `/residents` area change, smoke-test per repo's Playwright validation guidance (contributor responsibility; the webapp-testing/Playwright-validate skill).

## Sources

### Primary (HIGH confidence — read this session)
- `src/Modules/Security/.../LoginHandler.cs:39-78` — login flow, uniform deny messages, resolver seam
- `src/Modules/Security/.../JwtTokenService.cs:22-82` — exact claim inventory, TTL, refresh-token entry shape
- `src/Modules/Security/.../AttendantProfileLoginSupport.cs:10-67` — profile resolution + `EnsureAttendantProfileAsync` repair path
- `src/Modules/Security/.../RefreshHandler.cs:59-66`, `ChangePasswordHandler.cs:45-68`, `GetSessionHandler.cs:30-60` — ProfileId-dependent handlers needing resident branches
- `src/Modules/Security/.../RequirePermission{Requirement,Attribute,AuthorizationHandler}.cs` — permission-policy machinery (resident refusal vector)
- `src/Modules/Security/.../ForgotPasswordHandler.cs:15,60-86,125-133` and `ResetUserPasswordHandler.cs:42-124` — enumeration-safe + admin-reset machinery (targets staff only today)
- `src/Modules/Security/.../PasswordResetRequest.cs`, `User.cs` (MustChangePassword/ResetPassword), `PasswordHasher.cs` (WorkFactor 11)
- `src/Host/ControlEasyReborn.Api/Program.cs:81-115,144-149` — AddJwtBearer (no OnTokenValidated), policy registration loops, handler singletons, ProblemDetails
- `src/BuildingBlocks/.../TenantResolutionMiddleware.cs:23-65`, `HttpTenantContext.cs`, `TenantAwareLinqFactory.cs:5-36`, `Data/ServiceCollectionExtensions.cs:47-49` (DI lifetimes)
- Bare-authorization inventory — grep over all `Map*` + `RequireAuthorization` sites (table in Pattern 4), spot-reads of `SecurityEndpoints.cs`, `VisitEndpoints.cs`, `ReportEndpoints.cs`, `ResidentEndpoints.cs`
- `src/Modules/Residents/.../Resident.cs` (ApartmentId live column), `ResidentRepository.cs` (DBTools repo pattern), `ResidentEndpoints.cs:16-62`
- `src/Modules/Tenants/.../TenantAdminDefaults.cs`, `PorteiroDefaults.cs` (role/permission strings)
- `tests/ControlEasyReborn.ArchitectureTests/{SchemaBackfillSyncTests,AccessControlTenantRulesTests,LayerDependencyTests}.cs`; `tests/ControlEasyReborn.IntegrationTests/{TenantAwareWebApplicationFactory,JwtTestHelper}.cs`
- `src/Directory.Packages.props` (verified versions), `global.json`, `docker/mysql/migrations/0022-gatehouse-lifecycle.sql`

### Secondary (MEDIUM confidence)
- [CITED: https://github.com/dotnet/aspnetcore/issues/43188] — scoped `IAuthorizationHandler` root-provider failure
- [CITED: https://learn.microsoft.com/en-us/aspnet/core/security/authorization/dependencyinjection] — DI in requirement handlers
- [CITED: https://andrewlock.net/behind-the-scenes-of-minimal-apis-1-a-first-look-behind-the-scenes-of-minimal-api-endpoints] — endpoint metadata composition (authorization data merged onto RouteEndpoint)
- [CITED: https://medium.com/@asimmon/implementing-fine-grained-access-control-with-asp-net-core-custom-endpoint-metadata-3191b6d052b7] — endpoint metadata + RequireAuthorization semantics

### Tertiary (LOW confidence)
- None — no unverified web-only claims.

### Milestone-level prior research (already code-verified, cited not re-derived)
- `.planning/research/PITFALLS.md` (2026-10-15) — Pitfalls 1–4 are this phase's core traps; 11 (mixed-role) and the schema backfill note feed the open questions
- `.planning/phases/27-resident-access-foundation/27-UI-SPEC.md` (approved) — complete frontend contract; no new research needed for the modal

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions read from `src/Directory.Packages.props` this session; zero new packages
- Architecture (login dispatch, policies, endpoint scan): HIGH — every integration point read at source; external patterns cited
- Pitfalls: HIGH — code-verified + inherits the milestone's verified PITFALLS.md

**Research date:** 2026-10-15
**Valid until:** 2026-11-14 (stable in-repo domain; re-check `src/Directory.Packages.props` if the branch merges other phases first)