# Phase 27: Resident Access Foundation - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The resident is a first-class authenticated portal user — provisioned by the TenantAdmin, logged in through the resolver-dispatched branch of the existing `LoginHandler`, and isolated to their own apartment by mechanical proof — while the trust precondition lands FIRST: every existing staff endpoint provably refuses a resident JWT before any resident-visible data surface exists. Requirements: RES-01, RES-02, RES-03, RES-13.

</domain>

<decisions>
## Implementation Decisions

### Resident Credential & Identity Model
- Resident login credentials live in NEW `ResidentCredential` rows in the Residents module (resident-scoped table: BCrypt hash, status, `MustChangePassword`) — never an `AttendantProfiles` row, never a `Users` extension
- Resident JWT carries `credential_id` + `profile_kind: "Resident"` claim instead of an `AttendantProfiles` profile id; staff endpoints require explicit staff role policies, so a resident token fails them structurally — pinned by an explicit test
- Mixed-role (TenantAdmin + Resident) precedence: staff branch wins — if the user has any staff profile, login dispatch resolves staff first; the resident credential is a separate credential and a mixed user gets a staff token on login (explicit mixed-role test)
- Apartment scope for RES-03 isolation is derived server-side per request from live apartment-occupancy/resident records via `ITenantAwareLinqFactory` — never a claim in the JWT, never a snapshot column on the credential

### Per-Request Suspension Check
- The per-request credential-status check is a custom authorization requirement/policy (`IAuthorizationRequirement` reading `ResidentCredential` status from the DB per request) — inside the normal .NET authorization pipeline, uniform ProblemDetails, integration-testable
- The check hits the DB on every request for resident endpoints (suspension correctness > latency; the "next request after suspend" test demands zero staleness); no caching in v2.4
- A suspended/revoked/missing credential gets HTTP 403 ProblemDetails with the same shape for all three (no enumeration signal); 401 is reserved for missing/invalid JWT
- The same per-request resolver also re-verifies apartment occupancy per request — move-outs revoke visibility immediately

### Deny Matrix & Architecture Enforcement
- Existing staff endpoints declare their role policy through named policy constants (e.g. `StaffPolicies.TenantAdmin`, `StaffPolicies.Porteiro`, `StaffPolicies.TenantAdminOrPorteiro`) applied per endpoint group/route; zero bare `.RequireAuthorization()` remains
- Architecture enforcement via NetArchTest + endpoint-metadata scan: every mapped endpoint in feature-module `Map*Endpoints` registrations must reference an explicit policy constant — build fails otherwise; the suite re-runs green as Phases 28–30 add endpoints
- Negative suite inventory = exactly the ROADMAP four endpoint classes (tenant-wide visit lists, direct visit/detail reads, visit mutations, reports with caller-supplied `apartmentId`): one negative integration test per class, not per route
- Resident refusal shape: RFC 7807 ProblemDetails 403, standard problem type, no tenant-wide data anywhere in the response body — asserted in the same negative tests

### Provisioning & Resident Surface Scope
- TenantAdmin provisions resident portal access in the existing `/residents` area: a "Portal Access" section on the resident create/edit flow with create/activate, suspend, revoke actions (mirrors the Phase 24 device-admin UI pattern)
- Resident-facing UI in Phase 27 is login only + the armed `MustChangePassword` flow reusing existing Phase 17/18 machinery — no portal pages yet (they arrive in Phases 28/30)
- Initial password is set by the TenantAdmin at provision time, with `MustChangePassword` armed (same constant-cost path as staff credentials)
- Password recovery is TenantAdmin-reset only: the reset endpoint extended to cover resident credentials (BCrypt ≥ 11 + `MustChangePassword` re-armed + refresh-token revoke); resident hitting any forgot-password flow gets the uniform denial with no enumeration signal

### the agent's Discretion
- Exact table/column naming for `ResidentCredential`, policy-constant naming details, internal handler/repository layout, and test file organization — within codebase conventions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing staff login machinery in the Security module (the `LoginHandler` to be resolver-dispatched, not duplicated) and `RefreshTokens` flow with revoke
- Phase 17/18 password machinery: `PasswordResetRequest` table, `MustChangePassword`, enumeration-safe uniform responses, email-partitioned rate limits
- `ITenantAwareLinqFactory` tenant-scoped query pattern used by every module; `TenantFilterInterceptor`
- NetArchTest architecture test suite in `tests/ArchitectureTests`
- Angular ce-* design system (ce-card, ce-table, ce-badge, ce-switch, modal pattern from Phase 24 `DeviceFormModalComponent`)
- Phase 24 device-admin UI pattern (Administration screen + standalone form modal + handwritten API service) as the provisioning UI analog

### Established Patterns
- Minimal API endpoints registered via `Map*Endpoints` extension methods per module with authorization policies
- Handler-based application layer (no MediatR); FluentValidation; ProblemDetails RFC 7807 everywhere
- BCrypt ≥ 11 hashing; constant-cost uniform responses on credential surfaces
- Integration tests via Testcontainers.MySql; two-apartment-fixture pattern for isolation tests (see v2.1/v2.2 suites)

### Integration Points
- `LoginHandler` (Security module) — new resident resolver branch
- Tenants module admin-reset endpoint (extend to resident credentials)
- Staff endpoint registration sites (Visits, Reports, etc.) — deny-matrix policy constants
- `/residents` Angular area — Portal Access section

</code_context>

<specifics>
## Specific Ideas

- Trust precondition ordering is a hard requirement: the deny matrix + negative integration suite land BEFORE any resident data surface in this phase.
- Suspension semantics test sequence (RES-01): issue live token → suspend → same token's NEXT request denied → reactivate → next request allowed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>