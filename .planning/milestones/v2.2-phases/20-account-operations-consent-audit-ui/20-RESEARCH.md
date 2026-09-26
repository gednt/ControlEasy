# Phase 20: Account Operations & Consent Audit UI - Research

**Researched:** 2026-09-24
**Domain:** ASP.NET Core 8 modular monolith (Security + Photos modules) + Angular 18 SPA — credential operations UI and consent-audit review/export UI
**Confidence:** HIGH (source-of-truth is the shipped code in this worktree; all key seams read directly)

## Summary

Phase 20 wires two TenantAdmin-reachable surfaces on top of backends that shipped in v2.1 Phase 18 (password reset) and v2.0 Phase 13 (consent-audit read path). Grounding the actual code reveals the shipped backends are **closer than the requirements assume, but with three concrete gaps** that the planner must not paper over.

On the **account-operations** side, `POST /api/v1/security/users/{userId}/reset-password` already exists and is guarded by `.RequireAuthorization()` (any authenticated caller) with a role check **inside** `ResetUserPasswordHandler` — NOT `platformAdmin-only`. That role check currently restricts a TenantAdmin to resetting **Porteiro accounts only** (`throw new ForbiddenException("Tenant admins can only reset gatekeeper passwords.")`), which directly contradicts ACCNT-01 ("reset another admin's or porteiro's password"). The handler also **does not send SMTP email** — it returns the temp password in the response body and writes a `PasswordResetRequest` with `deliveryState: "Sent"` hardcoded, never invoking `IEmailSender`. The frontend reset UI exists **only** on the platform-admin `condominiums.page.ts` (`platformAdminGuard`); the TenantAdmin `administration.page.ts` has no reset surface.

On the **consent-audit** side, `GET /api/v1/entry-log` and `/export` are shipped and consumed by `audit.page.ts`, but the backend filter set is `{entryState, subjectType, fromUtc, toUtc, skip, take}` — **`porteiro` is absent** (CONSU-01 gap). CSV export already emits millisecond-precision `recorded_at` (`yyyy-MM-dd HH:mm:ss.fff`) — CONSU-03 is effectively done. Evidence rendering (CONSU-02) is largely present via `ce-entry-state-badge`/`ce-audit-row`, but the "porteiro" cell renders the raw `performedByProfileId` GUID, not a name.

**Primary recommendation:** Treat this phase as a **small backend delta + frontend wiring**, not a from-scratch build: (1) lift the porteiro-only restriction in `ResetUserPasswordHandler` and add SMTP dispatch there (or explicitly re-confirm the on-screen-copy delivery contract), (2) add a TenantAdmin-reachable staff-list surface, (3) add a `porteiro` filter param to the entry-log read path and resolve porteiro names for the audit row, and (4) reuse `ce-audit-filters`/`ce-audit-row`/`ce-photo-lightbox` as-is.

## User Constraints

> Copied verbatim from `20-CONTEXT.md`.

### Locked Decisions

#### ACCNT-01 — TenantAdmin-reachable reset
- A TenantAdmin can reset another admin's or porteiro's password from the condominium management UI. The caller must sit behind a TenantAdmin-reachable guard (NOT platformAdmin-only). Backend reset endpoint exists from v2.1 Phase 18 (PASS-03); this phase wires the UI caller.
- BCrypt ≥ 11 for the temp/next password; enumeration-safe; refresh-token revocation on reset (already backend-shipped).

#### ACCNT-02 — Delivery feedback + MustChangePassword
- Reset flow shows delivery feedback (temp password dispatched via SMTP).
- Reset user is forced to change password at next login (`MustChangePassword` re-armed).

#### CONSU-01 — Consent audit filters
- Audit review UI: filter by date range, category, entry state, and porteiro.

#### CONSU-02 — Evidence rendering
- `entered_with_consent` → photo thumbnail with lightbox.
- `entered_override` → highlighted with reason + porteiro.
- `gatehouse_only` → "no entry" badge; `denied` → "refused" badge.

#### CONSU-03 — CSV export
- CSV export with millisecond-precision `recorded_at`.

### the agent's Discretion
- Exact placement of the reset surface within the condominium management UI.
- Whether audit review reuses existing `ce-audit-filters`/`ce-audit-row` components (Phase 13 shipped them) or extends them.

### Deferred Ideas (OUT OF SCOPE)
- Webhook/WhatsApp temp-password delivery (Meta approval + per-tenant numbers) — deferred.
- Reset-token email links (temp-password machinery covers it).
- Custom override reason codes (hardcoded emergency/vouched only).
- Door integration, biometrics — other milestones.

## Project Constraints (from AGENTS.md)

Binding directives the planner MUST honor; these are constitutional (`.specify/memory/constitution.md` v1.7.0 wins over any conflict):

- **No EF Core** — DBTools 1.4.3 (`Linq<TModel>`, `IAsyncSqlClient`) is the only data-access library. LINQ-first; raw SQL only for stored procs (ADR 0002). `[VERIFIED: AGENTS.md]`
- **No MediatR** — handlers registered as scoped services directly. `[VERIFIED: AGENTS.md]`
- **No MVC controllers** — Minimal API endpoint classes only. `[VERIFIED: AGENTS.md]`
- **All tenant-scoped reads/writes via `ITenantAwareLinqFactory`** — no cross-tenant data access. `[VERIFIED: AGENTS.md]`
- **BCrypt cost ≥ 11** for password hashing (BCrypt.Net-Next 4.0.3). `[VERIFIED: AGENTS.md + Directory.Packages.props]`
- **`ProblemDetails` (RFC 7807)** for all error responses; domain exceptions `NotFoundException`, `ValidationException`, `ConflictException`. `[VERIFIED: AGENTS.md]`
- **Serilog** structured logging to Console (JSON) + Seq. `[VERIFIED: AGENTS.md]`
- **Synthetic test data only** — never copy user-supplied document numbers/names/contacts into tests/seeders. `[VERIFIED: AGENTS.md]`
- **Secrets never in `App.config`** — env vars or Docker secrets. `[VERIFIED: AGENTS.md]`
- **Mapping: Mapster; Validation: FluentValidation; Tests: xUnit + FluentAssertions + NSubstitute + Testcontainers.MySql; Angular: Karma + Jasmine.** `[VERIFIED: AGENTS.md + STACK.md]`
- **Angular**: standalone components, `OnPush`, signals, `ce-` prefix, kebab-case; DTOs via `ng-openapi-gen`, no shared domain models. `[VERIFIED: AGENTS.md]`
- **Mandatory Local CI Verification Gate** — `scripts/verify-ci-local.sh --fast` per turn; full 6-stage suite at task completion. `[VERIFIED: AGENTS.md + .opencode/rules/local-ci-verification.md]`
- **Concurrency budget:** max 3 sub-agents in flight per level. `[VERIFIED: AGENTS.md]`

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACCNT-01 | TenantAdmin can reset another admin's or porteiro's password from condominium management UI (UI caller behind TenantAdmin-reachable guard, not platformAdmin-only) | Reset endpoint exists (`POST /api/v1/security/users/{userId}/reset-password`, `.RequireAuthorization()`); handler `ResetUserPasswordHandler` restricts TenantAdmin to Porteiro-only — must lift. No TenantAdmin-reachable staff-list or reset UI exists (platform `condominiums.page.ts` is platformAdmin-guarded). |
| ACCNT-02 | Reset flow shows delivery feedback (temp password dispatched via SMTP) + enforces `MustChangePassword` | `ResetPassword` sets `MustChangePassword=true` and revokes refresh tokens (backend-shipped). BUT handler returns temp password inline, **does not** call `IEmailSender` — SMTP dispatch is a gap. `ForgotPasswordHandler` shows the SMTP pattern to mirror. |
| CONSU-01 | Audit review UI: filter by date range, category, entry state, porteiro | Backend `GET /api/v1/entry-log` supports `entryState, subjectType, fromUtc, toUtc, skip, take` — **`porteiro` param absent**. Frontend `ce-audit-filters` has date/category/state but no porteiro. Both are gaps. |
| CONSU-02 | Audit rows render state-appropriate evidence (thumbnail+lightbox / highlight+reason+porteiro / badges) | Largely present: `ce-audit-row` renders override highlight + photo thumbnail + reason + state badge; `audit.page.ts` wires lightbox. Gap: porteiro cell shows raw `performedByProfileId` GUID, not a name; state-vocabulary drift (`gatehouse_only`/`denied` in spec vs `entered_without_consent`/`exited` in domain). |
| CONSU-03 | CSV export with millisecond-precision `recorded_at` | Done: `ExportEntryLogCsvHandler` emits `yyyy-MM-dd HH:mm:ss.fff` (InvariantCulture); `EntryLogEndpointTests.ExportCsv_ReturnsCsvWithMillisecondPrecision` asserts it; `audit.page.ts` already has an "Export CSV" button. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Password reset (credential operation) | API / Backend (Security module) | — | BCrypt hash + refresh-token revocation + tenant isolation must live server-side; the UI only triggers it |
| Reset authorization (TenantAdmin vs PlatformAdmin, porteiro-only vs admin+porteiro) | API / Backend | — | Role check inside `ResetUserPasswordHandler`; must not be re-implemented in the browser |
| Temp-password delivery (SMTP) | API / Backend | — | `IEmailSender`/MailKit is a server concern; browser must never see/relay SMTP |
| Staff list for reset targets (admins + porteiros) | API / Backend (Tenants + Security modules) | — | TenantAdmin needs a tenant-scoped staff list; currently `ListTenantAdminsHandler` is platformAdmin-guarded, `ListPorteirosHandler` and `ListAttendantProfilesHandler` are tenant-scoped |
| Reset surface UI (button, confirmation, delivery feedback) | Browser / Client (Angular) | — | New surface under a TenantAdmin-reachable route |
| Consent-audit read (list + filters) | API / Backend (Photos module) | — | `ConsentAuditLogRepository.ListAsync` is the filter source; porteiro filter must be added server-side |
| Audit review UI (filters, rows, badges, lightbox) | Browser / Client | — | Reuse `ce-audit-filters`, `ce-audit-row`, `ce-photo-lightbox`, `audit.page.ts` |
| CSV export | API / Backend (Photos module) | — | Already shipped (`ExportEntryLogCsvHandler`), ms precision |

## Standard Stack

No new external packages are required — this phase is a closeout on already-shipped backends. All packages below are already present and verified in `src/Directory.Packages.props` / `.planning/codebase/STACK.md`.

### Core (already installed — do not add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| DBTools | 1.4.3 | LINQ/SQL data access (`IAsyncSqlClient`, `Linq<TModel>`) | Only data-access library (ADR 0002); no EF Core |
| BCrypt.Net-Next | 4.0.3 | Password hashing (work factor ≥ 11) | Constitutional requirement |
| MailKit / MimeKit | 4.16.0 | SMTP email delivery (`IEmailSender`) | Already shipped in Phase 18; `MailKitEmailSender` + Mailpit dev container |
| FluentValidation | 11.9.0 | Request validation | Project convention |
| Mapster | 7.4.0 | Object mapping | Project convention (pinned, not yet referenced in all code) |
| ASP.NET Core 8 (JWT Bearer) | 8.0.x | Minimal API endpoints, authz | Project stack |
| Angular 18.2 + RxJS 7.8 | 18.2 | Standalone components, signals | Project stack |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xUnit + FluentAssertions + NSubstitute | 2.9.2 / 8.2.0 / 5.1.0 | Backend tests | Handler/validator/repository tests |
| Testcontainers.MySql | 4.0.0 | Integration tests | Endpoint tests against real MySQL |
| NetArchTest.Rules | 1.3.2 | Architecture constraints | Redaction/tenant-isolation rules |
| Jasmine + Karma | 5.2 / 6.4 | Angular unit tests | `*.spec.ts` for new/extended components |
| lucide-angular | 0.454 | Icons | Badges/buttons |

**Installation:** none expected. If any package is added, it must be declared in `src/Directory.Packages.props` (central package management) — do not add `<PackageReference Version=...>` directly in a `.csproj`.

**Version verification:** All versions above read directly from `src/Directory.Packages.props` (lines 13-16, 55-56) and `.planning/codebase/STACK.md` this session — not from training data.

## Package Legitimacy Audit

> No new packages are installed in this phase. The audit below covers the only dependency touched conceptually (MailKit — already shipped, used to dispatch the reset email).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| MailKit (NuGet) | nuget.org | 9+ yrs (jstedfast) | high | github.com/jstedfast/MailKit | [VERIFIED: Directory.Packages.props] | Approved — already installed at 4.16.0 |
| MimeKit (NuGet) | nuget.org | 9+ yrs | high | github.com/jstedfast/MimeKit | [VERIFIED: Directory.Packages.props] | Approved — transitive of MailKit at 4.16.0 |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

> Note on the seam run: a `package-legitimacy check --ecosystem npm mailkit mimekit` query returned `SUS`/`SLOP` because those are **npm** packages (unrelated to the **NuGet** `MailKit`/`MimeKit` this project uses). This is the documented cross-ecosystem confusion vector. The project's MailKit/MimeKit are NuGet packages already pinned in `Directory.Packages.props` and shipped in Phase 18 — the npm results are irrelevant and should not gate anything. No new package decisions exist for this phase.

## Architecture Patterns

### System Architecture Diagram

```text
 TenantAdmin (browser, Angular SPA)
     │
     ├─ (ACCNT) "Reset pw" action ──────────────────────────────┐
     │         in condominium-management UI                      │
     │                                                            ▼
     │   ┌──────────────────────────────────────────────────────────────┐
     │   │ Security module (minimal API)                                 │
     │   │  POST /api/v1/security/users/{userId}/reset-password          │
     │   │   └─ RequireAuthorization()  (any authenticated)              │
     │   │   └─ ResetUserPasswordHandler                                 │
     │   │       ├─ role check (PlatformAdmin | TenantAdmin)             │
     │   │       ├─ [GAP] TenantAdmin currently Porteiro-only            │
     │   │       ├─ BCrypt≥11 temp hash → User.ResetPassword(MustChange) │
     │   │       ├─ refresh-token RevokeAllForUserAsync                  │
     │   │       ├─ [GAP] IEmailSender not invoked (inline temp pwd)     │
     │   │       └─ PasswordResetRequest (deliveryState)                 │
     │   └──────────────────────────────┬───────────────────────────────┘
     │                                  │ DBTools / ITenantAwareLinqFactory
     │                                  ▼  MySQL (Users, PasswordResetRequests)
     │
     ├─ (CONSU) audit review ────────────────────────────────────┐
     │                                                            ▼
     │   ┌──────────────────────────────────────────────────────────────┐
     │   │ Photos module (minimal API, Permission_Photos.Read)           │
     │   │  GET /api/v1/entry-log        (entryState, subjectType,       │
     │   │                               fromUtc, toUtc, skip, take)     │
     │   │  GET /api/v1/entry-log/export (same filters, text/csv)        │
     │   │   └─ ConsentAuditLogRepository.ListAsync (tenant-scoped)      │
     │   │        └─ [GAP] no porteiro filter                            │
     │   └──────────────────────────────┬───────────────────────────────┘
     │                                  │ append-only ConsentAuditLog (triggers)
     │                                  ▼  MySQL
     │
     Angular reuse: ce-audit-filters / ce-audit-row / ce-entry-state-badge / ce-photo-lightbox
```

### Recommended Project Structure

No new module is created. Changes land in existing seams:

```text
src/Modules/Security/.../
├── Api/Endpoints/SecurityEndpoints.cs            # reset endpoint (already mapped)
├── Application/Handlers/ResetUserPasswordHandler.cs   # [EDIT] lift porteiro-only; add email
├── Application/Contracts/SecurityDtos.cs         # [MAYBE EDIT] delivery feedback in response
src/Modules/Photos/.../
├── Api/Endpoints/EntryLogEndpoints.cs            # [EDIT] add porteiro filter param
├── Application/Handlers/EntryLogHandlers.cs      # [EDIT] thread porteiro filter
├── Application/Abstractions/IPhotoRepository.cs  # [EDIT] ListAsync signature + porteiro
├── Infrastructure/Persistence/ConsentAuditLogRepository.cs # [EDIT] porteiro WHERE
src/Web/ControlEasyReborn.Web/src/app/
├── features/administration/administration.page.ts      # [EDIT] TenantAdmin reset surface
├── features/audit/audit.page.ts                        # [EDIT] porteiro filter + name resolution
├── features/entry-log/entry-log.service.ts             # [EDIT] porteiro param + name join
├── design-system/components/audit-filters/...          # [EDIT] porteiro dropdown
├── design-system/components/audit-row/...              # [EDIT] porteiro name (not GUID)
tests/...
├── ControlEasyReborn.UnitTests/Modules/Security/ResetUserPasswordHandlerTests.cs  # [ADD/EDIT]
├── ControlEasyReborn.IntegrationTests/EntryLogEndpointTests.cs                    # [EDIT] porteiro filter
├── ControlEasyReborn.IntegrationTests/Security/PasswordResetTests.cs              # [EDIT] TenantAdmin admin-reset
```

### Pattern 1: Minimal API endpoint → scoped handler → DBTools repository
**What:** A static endpoint class maps a route, injects a `sealed` handler, the handler validates + orchestrates, and the repository uses `ITenantAwareLinqFactory.Create(_ctx)` (never raw `IAsyncSqlClient`).
**When to use:** Every new/modified endpoint in this phase (porteiro filter on entry-log; any staff-list helper).
**Example (existing, authoritative):**
```csharp
// Source: src/Modules/Photos/ControlEasyReborn.Modules.Photos.Api/Endpoints/EntryLogEndpoints.cs
group.MapGet("/", async (
    string? entryState, string? subjectType, DateTime? fromUtc, DateTime? toUtc,
    int? skip, int? take, ListEntryLogsHandler handler, CancellationToken ct) =>
{
    var entries = await handler.HandleAsync(entryState, subjectType, fromUtc, toUtc, skip ?? 0, take ?? 50, ct);
    return Results.Ok(entries);
})
.RequireAuthorization("Permission_Photos.Read");
```

### Pattern 2: Tenant-scoped filter building with parameterized WHERE
**What:** Repository builds `whereParts`/`parameters` lists and joins with `AND`; tenant isolation comes from `TenantFilterInterceptor` (no manual `tenant_id`), and datetime filters are formatted as `yyyy-MM-dd HH:mm:ss.fff`.
**When to use:** Adding the `porteiro` filter to `ConsentAuditLogRepository.ListAsync`.
**Example (existing, authoritative):**
```csharp
// Source: src/Modules/Photos/.../Infrastructure/Persistence/ConsentAuditLogRepository.cs (lines 41-91)
if (!string.IsNullOrWhiteSpace(entryState)) { whereParts.Add($"EntryState = @param{n}"); parameters.Add(entryState); }
if (fromUtc.HasValue) { whereParts.Add($"RecordedAt >= @param{n}"); parameters.Add(fromUtc.Value.ToString("yyyy-MM-dd HH:mm:ss.fff")); }
var whereClause = whereParts.Count == 0 ? "1=1" : string.Join(" AND ", whereParts);
```

### Pattern 3: SMTP delivery via `IEmailSender` (the pattern the reset handler should mirror)
**What:** Handler injects `IEmailSender`; wraps `SendEmailAsync` in try/catch; on failure marks `PasswordResetRequest` `Failed` and continues (does not fail the reset).
**When to use:** Adding SMTP dispatch to `ResetUserPasswordHandler` for ACCNT-02.
**Example (existing, authoritative — ForgotPasswordHandler):**
```csharp
// Source: src/Modules/Security/.../Application/Handlers/ForgotPasswordHandler.cs (lines 150-167)
try {
    await _emailSender.SendEmailAsync(toEmail: user.Email, toName: user.DisplayName ?? user.Email,
        subject: "ControlEasy - Recuperação de Senha",
        bodyHtml: $"<p>Olá, {user.DisplayName}.</p><p>Sua senha temporária de acesso é: <strong>{tempPassword}</strong></p>...",
        ct: ct);
    resetRequest.MarkSent();
    await _passwordResetRequests.UpdateAsync(resetRequest, ct);
} catch (Exception ex) {
    _logger.LogWarning(ex, "Failed to deliver temporary password email to {Email}", normalizedEmail);
    resetRequest.MarkFailed(ex.Message);
    await _passwordResetRequests.UpdateAsync(resetRequest, ct);
}
```

### Anti-Patterns to Avoid
- **Raw `IAsyncSqlClient` in handlers:** bypasses tenant interceptor and repository boundary — always go through `ITenantAwareLinqFactory` in a repository. `[VERIFIED: ARCHITECTURE.md]`
- **Manual `tenant_id` in every query:** rely on `TenantFilterInterceptor`. `[VERIFIED: ARCHITECTURE.md]`
- **Porteiro-only TenantAdmin restriction kept as-is:** violates ACCNT-01. Lift in the handler, not in the UI.
- **Rendering raw `performedByProfileId` GUID as "porteiro":** CONSU-02 requires a human-readable porteiro name; resolve via `AttendantProfiles`/`Users` (tenant-scoped).
- **Introducing a second credential subsystem (reset-token email links):** settled out of scope; temp-password machinery covers it. `[VERIFIED: 20-CONTEXT.md Deferred]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | custom salt/derive loop | BCrypt.Net-Next 4.0.3 at work factor ≥ 11 (`IPasswordHasher`) | Constitutional; timing/rainbow-table safety is a solved, audited problem |
| Temp-password generation | hand-rolled RNG/char picking | `ITempPasswordGenerator` (`RandomNumberGenerator.GetString`, unambiguous charset, no 0/O, 1/l/I) | Already shipped; unambiguous charset avoids support-ticket typos |
| SMTP delivery | raw `SmtpClient` in handler | `IEmailSender` + `MailKitEmailSender` (MailKit 4.16.0) + Mailpit dev catch-all | Already shipped; TLS/STARTTLS + async handled |
| Enumeration-safe reset responses | ad-hoc error strings | uniform response + constant-cost decoy BCrypt verify (ForgotPasswordHandler) | PASS-01/04 pattern; avoids timing side-channel |
| CSV building | manual string escaping | `ExportEntryLogCsvHandler` (already handles comma/quote/newline escaping + `yyyy-MM-dd HH:mm:ss.fff`) | Already shipped and integration-tested |
| Photo lightbox | new overlay component | `ce-photo-lightbox` (already wired in `audit.page.ts`) | Already shipped; keyboard/Escape/backdrop handling done |
| State badges | new badge markup | `ce-entry-state-badge` (success/warning/neutral/danger tokens) | Already shipped; dark-theme inherits tokens |

**Key insight:** The phase's risk is not "what library to build" but "which already-shipped seam is authoritative and what small delta it needs." Hand-rolling any of the above re-introduces solved security/complexity problems.

## Runtime State Inventory

> **Not applicable.** This is not a rename/refactor/migration phase. No stored-data, live-service, OS-registered, secret, or build-artifact state carries a renamed string. The ConsentAuditLog write path was already retired in v2.1 (Phase 16) — this phase is read-only on that table plus a credential operation. No inventory action required.

- Stored data: **None** — no rename; no new tenant data added (reset writes `PasswordResetRequests` rows, already in schema `16-password-reset-requests.sql`).
- Live service config: **None**.
- OS-registered state: **None**.
- Secrets/env vars: **None new** — SMTP config already in `Smtp` options (`SmtpOptions.SectionName`), delivered via env vars.
- Build artifacts: **None**.

## Common Pitfalls

### Pitfall 1: Assuming the reset endpoint is platformAdmin-only
**What goes wrong:** A planner might treat ACCNT-01 as "add a new endpoint with a TenantAdmin guard." The endpoint already exists with `.RequireAuthorization()`; the gate is a role check *inside* the handler.
**Why it happens:** The `20-CONTEXT.md` phrasing ("must sit behind a TenantAdmin-reachable guard (NOT platformAdmin-only)") reads like the endpoint is platform-admin-gated.
**How to avoid:** Read `ResetUserPasswordHandler` first. The real work is (a) lifting the `isPorteiro` restriction and (b) adding SMTP dispatch — plus a TenantAdmin-reachable UI caller.
**Warning signs:** A plan that says "create `POST .../reset-password`" — that endpoint is already shipped and tested.

### Pitfall 2: Missing the porteiro filter gap
**What goes wrong:** CONSU-01 assumes porteiro filtering exists because the spec (`CONSENT-03`) promised it. The shipped `ListAsync`/`ListEntryLogsHandler` accept only `entryState`, `subjectType`, `fromUtc`, `toUtc`.
**Why it happens:** The spec predates the read-path implementation; porteiro was never threaded through.
**How to avoid:** Add a `porteiro` (or `performedByProfileId`) param end-to-end: endpoint → handler → `IConsentAuditLogRepository.ListAsync` → `ConsentAuditLogRepository` WHERE clause, plus the frontend dropdown.
**Warning signs:** Frontend dropdown that sends a `porteiro` query param the backend silently ignores.

### Pitfall 3: Porteiro rendered as a raw GUID
**What goes wrong:** `ce-audit-row` currently renders `entry().performedByProfileId || '—'` — a GUID. CONSU-02 requires "reason + porteiro" (a name).
**Why it happens:** `EntryLogResponse.PerformedByProfileId` is a `Guid?`; no name join was built in Phase 13.
**How to avoid:** Resolve porteiro names tenant-scoped (via `ListAttendantProfilesHandler`/`GET /api/v1/security/attendant-profiles`, which returns `DisplayName`, or a `Users`-join) and map `profileId → displayName` in the row or page. Note this is read-only enrichment — do not add a name column to `ConsentAuditLog`.

### Pitfall 4: State-vocabulary drift (`gatehouse_only`/`denied` vs `entered_without_consent`/`exited`)
**What goes wrong:** The spec (`CONSENT-02`) names `gatehouse_only` and `denied`, but the Photos domain `EntryStates` constants are `entered_with_consent`, `entered_without_consent`, `entered_override`, `exited` (no `gatehouse_only`, no `denied`). The frontend `EntryState` type has `gatehouse_only` and `entered_without_consent` ("Refused" badge).
**Why it happens:** The consent-gatehouse spec's state model and the shipped `ConsentAuditLog`/Reports read-model diverged during v2.1 visits-unification.
**How to avoid:** Confirm the post-cleanup contract first (SATISFIED 2026-09-26 — both cleanup branches merged to `main`, PRs #10/#11; the `20-CONTEXT.md` sequencing note is satisfied). Map: `denied` ↔ `entered_without_consent` ("Refused"), `gatehouse_only` ↔ "No entry" badge. Do not invent new stored states.
**Warning signs:** A task that adds a `gatehouse_only` value to the domain constants without reconciling the Reports read model (`ReportReadRepository` already CASE-maps `gatehouse_only` and `entered_without_consent`).

### Pitfall 5: Reset returns temp password inline but CONTEXT says "dispatched via SMTP"
**What goes wrong:** The shipped handler returns `ResetUserPasswordResponse(UserId, TempPassword, MustChangePassword)` inline (the platform `condominiums.page.ts` shows a "copy temp password" modal). `20-CONTEXT.md` ACCNT-02 says "temp password dispatched via SMTP".
**Why it happens:** Phase 18 shipped the platform-admin reset with on-screen copy; the SMTP path (`ForgotPasswordHandler`) exists only for self-service forgot-password.
**How to avoid:** This is a genuine contract fork. Either (a) add `IEmailSender` dispatch to `ResetUserPasswordHandler` (matching ACCNT-02's wording, and mirroring `ForgotPasswordHandler`), or (b) flag it as an open question for the planner/user. Recommendation: dispatch via SMTP AND keep a delivery-state feedback surface; do not return the plaintext temp password in the JSON response body if SMTP is the delivery mechanism (avoids leaking it to the resetting admin's browser log).

## Code Examples

Verified patterns from the shipped source (this worktree):

### Administrative reset handler (authorization + revoke + MustChangePassword) — needs the porteiro-only lift
```csharp
// Source: src/Modules/Security/.../Application/Handlers/ResetUserPasswordHandler.cs (lines 38-99)
var isPlatformAdmin = _tenantContext.IsPlatformAdmin || _tenantContext.Roles.Contains("PlatformAdmin");
var isTenantAdmin = _tenantContext.Roles.Contains("TenantAdmin");
if (!isPlatformAdmin && !isTenantAdmin) throw new ForbiddenException("Insufficient permissions to reset user passwords.");
// ...
if (isTenantAdmin && !isPlatformAdmin) {
    if (targetUser.TenantId != _tenantContext.TenantId) throw new ForbiddenException("Cannot reset user password for another condominium.");
    var roles = targetUser.Roles.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
    var isPorteiro = roles.Contains("Porteiro", StringComparer.OrdinalIgnoreCase);
    if (!isPorteiro) throw new ForbiddenException("Tenant admins can only reset gatekeeper passwords."); // ← ACCNT-01 conflict
}
targetUser.ResetPassword(_passwordHasher.Hash(_tempPasswordGenerator.Generate(12)));
await _users.UpdateAsync(targetUser, ct);
await _refreshTokenRepository.RevokeAllForUserAsync(targetUser.Id, ct);
return new ResetUserPasswordResponse(targetUser.Id, tempPassword, true);
```

### CSV export with millisecond precision (CONSU-03 — already done)
```csharp
// Source: src/Modules/Photos/.../Application/Handlers/ExportEntryLogCsvHandler.cs (lines 23-35)
sb.AppendLine("id,entry_state,override_reason,photo_id,subject_type,subject_name,subject_document,performed_by_profile_id,recorded_at");
// ...
sb.Append(Escape(e.RecordedAt.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture)));
```

### Angular signal-driven audit page (reuse reference)
```typescript
// Source: src/Web/ControlEasyReborn.Web/src/app/features/audit/audit.page.ts (lines 187-197, 261-289)
filters = signal<AuditFilters>({ skip: 0, take: 50 });
entries = signal<EntryLogResponse[]>([]);
lightboxPhotos = computed(() => this.entries().filter((e) => !!e.photoId).map((e) => ({ id: e.photoId!, /* ... */ })));
async exportCsv(): Promise<void> { /* firstValueFrom(this.entryLogService.export(this.filters())) → blob → anchor download */ }
```

### State badge mapping (CONSU-02 — already present)
```typescript
// Source: .../design-system/components/entry-state-badge/entry-state-badge.component.ts (lines 12-22)
entered_with_consent: { tone: 'success', icon: 'check-circle', label: 'With consent' },
entered_override: { tone: 'warning', icon: 'alert-triangle', label: 'Override' },
gatehouse_only: { tone: 'neutral', icon: 'package', label: 'No entry' },
entered_without_consent: { tone: 'danger', icon: 'x-circle', label: 'Refused' },
exited: { tone: 'neutral', icon: 'log-out', label: 'Exit' },
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PlatformAdmin-only reset UI (`condominiums.page.ts`, `platformAdminGuard`) | TenantAdmin-reachable reset surface in condominium-management UI | Phase 20 (this phase) | ACCNT-01 |
| On-screen temp-password copy (inline response) | SMTP-dispatched temp password + delivery feedback | Phase 20 (ACCNT-02) — contract to confirm | Matches self-service forgot-password UX |
| Entry-log filters: entryState/subjectType/date only | + porteiro filter | Phase 20 (CONSU-01) | Spec parity |
| Porteiro cell shows raw GUID | Porteiro display name | Phase 20 (CONSU-02) | Readable audit |
| CSV export with ms precision | (unchanged — already shipped) | Phase 13 | CONSU-03 satisfied |

**Deprecated/outdated:**
- **Legacy `POST /api/v1/entry-log` write path:** already retired (returns 404/405; `EntryLogEndpointTests.Post_IsRetired_ReturnsNotFoundOrMethodNotAllowed` asserts this). Do not resurrect. `[VERIFIED: EntryLogEndpoints.cs + EntryLogEndpointTests.cs]`
- **`X-Total-Count` approximation (`entries.length`):** `audit.page.ts` still approximates pagination totals; backend does not emit `X-Total-Count`. This is a known tech-debt shim (LEDGER-05 / Phase 19 territory), not Phase 20 scope — but do not break the existing pagination while adding the porteiro filter.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ACCNT-02's "temp password dispatched via SMTP" means the **administrative reset** handler should send email (not just the self-service forgot-password path). The shipped `ResetUserPasswordHandler` does not send email. | Standard Stack / Pitfall 5 / ACCNT-02 | If the user actually wants on-screen copy (as shipped), adding SMTP is scope creep and changes the delivery contract. This is the single biggest contract fork — must be confirmed before locking tasks. |
| A2 | The porteiro filter should key on `PerformedByProfileId` (a GUID), not a display name, at the DB/endpoint layer. | CONSU-01 | If porteiro filtering is meant by name (fuzzy match), the WHERE clause differs (requires a join to AttendantProfiles/Users). |
| A3 | CONFIRMED: Porteiro name resolution reuses the `AttendantProfile` seam (`GET /api/v1/security/attendant-profiles` returns `Id`/`UserId`/`DisplayName`, tenant-scoped); the Plan 20-01 staff list joins `AttendantProfiles` so `StaffMemberResponse.ProfileId` carries the `AttendantProfile.Id` used by both the CONSU-01 filter and the CONSU-02 name map. | CONSU-02 | If that seam were wrong (e.g. profiles porteiro-only while admins also appear in audit rows), the name join would need a `Users`-join — the staff-list join covers admins with profiles too (ProfileId null when absent, UI falls back to '—'). |
| A4 | The post-cleanup audit-state vocabulary will make `gatehouse_only`/`denied` vs `entered_without_consent`/`exited` consistent; Phase 20 does not itself add new stored states. | CONSU-02 / Pitfall 4 | RESOLVED 2026-09-26 — cleanup branches merged to `main` (PRs #10/#11) with no changes to Photos-module state constants (`git diff HEAD...origin/main` clean on the seam paths); badge mapping can proceed against the shipped contract. |
| A5 | No new NuGet/npm packages are required (MailKit already present). | Standard Stack / Package Audit | If a porteiro-name join needs a new helper package, none should be added — use existing DBTools/endpoints. |

## Open Questions (RESOLVED — resolved by Phase 20 plans 2026-09-26)

1. **ACCNT-02 delivery contract: SMTP dispatch vs on-screen copy?** — RESOLVED: SMTP dispatch (Plan 20-01).
   - What we know: `ResetUserPasswordHandler` returns the temp password inline (no email); `ForgotPasswordHandler` sends SMTP. `20-CONTEXT.md` says "temp password dispatched via SMTP."
   - Resolution: Dispatch via SMTP, mirroring `ForgotPasswordHandler` (create PasswordResetRequest with deliveryState "Pending", send, MarkSent/MarkFailed in try/catch), and remove the plaintext temp password from `ResetUserPasswordResponse` — the response exposes `DeliveryState` instead. Implemented in Plan 20-01 Task 1.

2. **TenantAdmin staff list source for the reset surface** — RESOLVED: new tenant-scoped `GET /api/v1/security/staff` (Plan 20-01).
   - What we know: `GET /api/v1/tenants/{id}/porteiros` and `/admins` are behind `PlatformAdminRequirement.PolicyName` (group-level), so a TenantAdmin cannot call them. `GET /api/v1/security/attendant-profiles` is tenant-scoped but porteiro-only.
   - Resolution: Add a Security-module tenant-scoped staff endpoint (`GET /api/v1/security/staff`) listing the caller tenant's TenantAdmin + Porteiro users, restricted to TenantAdmin/PlatformAdmin callers, with each member's `AttendantProfile.Id` exposed as `ProfileId` (joined via `IAttendantProfileRepository`). Implemented in Plan 20-01 Task 2; consumed by Plans 20-02 (reset UI) and 20-04 (name map).

3. **Porteiro filter semantics** — RESOLVED: exact `PerformedByProfileId` equality filter, keyed on `AttendantProfile.Id` (Plans 20-03/20-04).
   - What we know: `ConsentAuditLog.PerformedByProfileId` is a GUID; no name is stored on the row.
   - Resolution: Exact `PerformedByProfileId = @p` parameterized filter (dropdown of the tenant's staff), consistent with the other equality filters. KEY-SPACE: `PerformedByProfileId` is an `AttendantProfile.Id` (`tenantContext.ProfileId`), so the dropdown values and the name map key on `StaffMemberResponse.ProfileId` (AttendantProfile.Id), never `User.Id`. Implemented in Plan 20-03 (filter threading + dropdown) and Plan 20-04 (name map). Assumption A3 confirmed: `GET /api/v1/security/attendant-profiles` returns `Id`/`DisplayName` and was reused (via the repository) as the profile-id/name source; the staff list cross-references `ProfileId` so one call feeds filter + names.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | Backend build/tests | ✓ | 8.0.131 | — |
| Node.js | Angular build/tests | ✓ | 22.22.1 | — (20+ required; 22 present) |
| npm | Angular deps | ✓ | 10.9.4 | — |
| Docker | Compose stack + Testcontainers | ✓ | 29.8.1 (daemon OK) | — |
| git | Worktree ops | ✓ | 2.34.1 | — |
| MySQL | Integration tests | ✓ (via Docker) | mysql:8.0 image | Testcontainers pulls it |
| Mailpit (dev SMTP) | ACCNT-02 email verification | ✓ (docker-compose `mailpit`) | — | Seq/`IEmailSender` NoOp in demo mode |
| gsd-tools | Workflow seam | ✓ | present | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

> Environment audit conclusion: this is a code/config-only closeout — all runtime dependencies are already present (host has .NET 8 / Node 22 / Docker; MySQL and Mailpit run inside Docker). No new external tools required. `[VERIFIED: host probes this session]`

## Validation Architecture

> Nyquist validation is enabled (`.planning/config.json` → `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | xUnit 2.9.2 + FluentAssertions 8.2.0 + NSubstitute 5.1.0 + Testcontainers.MySql 4.0.0 |
| Frontend framework | Jasmine 5.2 + Karma 6.4 (co-located `*.spec.ts`) |
| E2E | Playwright 1.49 (`src/Web/ControlEasyReborn.Web/e2e/`) |
| Config file | `tests/Directory.Build.props` / `tests/Directory.Packages.props` (backend); `angular.json` → `test` (frontend) |
| Quick run command | `./scripts/verify-ci-local.sh --fast` (format + Release build + unit/arch tests) |
| Full suite command | `./scripts/verify-ci-local.sh` (6-stage: format, build, unit+arch, Testcontainers MySQL integration, Angular prod build, OpenAPI drift) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACCNT-01 | TenantAdmin resets an **admin's** (not just porteiro's) password; cross-tenant target → 403 | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~PasswordResetTests"` | ✅ (must ADD admin-reset case) |
| ACCNT-01 | Reset endpoint not platformAdmin-only; non-admin role → 403 | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~PasswordResetTests"` | ✅ (extend) |
| ACCNT-02 | Reset dispatches SMTP email; `MustChangePassword` re-armed | unit + integration | `dotnet test tests/ControlEasyReborn.UnitTests --filter "FullyQualifiedName~ResetUserPasswordHandler"` | ❌ Wave 0 (new handler tests) |
| ACCNT-02 | TenantAdmin reset UI shows delivery feedback | Angular unit | `npm test -- --no-watch --browsers=ChromeHeadless` (new `*.spec.ts`) | ❌ Wave 0 |
| CONSU-01 | entry-log filters by porteiro | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~EntryLogEndpointTests"` | ✅ (extend with porteiro) |
| CONSU-01 | audit page porteiro dropdown emits filter | Angular unit | `npm test` → `audit-filters.component.spec.ts` | ✅ (extend) |
| CONSU-02 | override row shows reason + porteiro **name**; thumbnail → lightbox; badges | Angular unit | `npm test` → `audit-row.component.spec.ts`, `entry-state-badge.component.spec.ts` | ✅ (extend) |
| CONSU-03 | CSV export ms precision | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ExportCsv_ReturnsCsvWithMillisecondPrecision"` | ✅ already passing |

### Sampling Rate
- **Per task commit:** `./scripts/verify-ci-local.sh --fast`
- **Per wave merge:** `dotnet test src/ControlEasyReborn.sln` + `npm test -- --no-watch --browsers=ChromeHeadless`
- **Phase gate:** full `./scripts/verify-ci-local.sh` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/ControlEasyReborn.UnitTests/Modules/Security/ResetUserPasswordHandlerTests.cs` — covers ACCNT-02 (SMTP dispatch + MustChangePassword + porteiro/admin role lift). **Does not exist** (only `ForgotPasswordHandlerTests.cs` exists).
- [ ] `tests/ControlEasyReborn.IntegrationTests/Security/PasswordResetTests.cs` — extend with "TenantAdmin resets admin" + "TenantAdmin resets porteiro of another tenant → 403".
- [ ] `tests/ControlEasyReborn.IntegrationTests/EntryLogEndpointTests.cs` — extend with porteiro-filter case.
- [ ] Angular `*.spec.ts` for the new TenantAdmin reset surface (feature page) and porteiro name resolution in `audit-row`.
- [ ] No new framework install needed — existing infra covers the phase.

## Security Domain

> `security_enforcement` is enabled (absent → enabled). This phase touches credential operations (highest-sensitivity) and privacy-audit evidence.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | BCrypt.Net-Next 4.0.3 (work factor ≥ 11); JWT bearer; `MustChangePassword` re-arm; refresh-token revocation on reset |
| V3 Session Management | yes | `RevokeAllForUserAsync` on reset; refresh-token rotation; `MustChangePassword` forces re-auth |
| V4 Access Control | yes | Role check in `ResetUserPasswordHandler` (TenantAdmin vs PlatformAdmin); cross-tenant 403 (not 404); `ITenantAwareLinqFactory` tenant isolation |
| V5 Input Validation | yes | FluentValidation 11.9.0 (e.g. `ForgotPasswordRequestValidator`); `[FromBody]` DTO binding |
| V6 Cryptography | yes | BCrypt ≥ 11 (`IPasswordHasher`); `RandomNumberGenerator.GetString` unambiguous temp passwords — never hand-roll |

### Known Threat Patterns for ASP.NET Core 8 + Angular 18 + DBTools/MySQL
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User enumeration via reset (different error for "no such user") | Information Disclosure | Uniform response + constant-cost decoy BCrypt verify (`ForgotPasswordHandler` PASS-01); port this mindset to admin reset (never reveal target existence cross-tenant — already 403/404 handled) |
| TenantAdmin resetting a user in another condominium (privilege escalation) | Elevation of Privilege | Cross-tenant `TenantId != _tenantContext.TenantId` → 403 (already in handler); verify via `CrossTenant_*` integration test |
| Temp password leaked in browser/response body | Information Disclosure | Dispatch via SMTP; remove plaintext `tempPassword` from JSON response (per ACCNT-02 contract, A1) |
| Reset flood / brute-force | Denial of Service | `forgot-password` rate limiter (partitioned on normalized email) + durable `PasswordResetRequests` counter (PASS-04) |
| Append-only audit tampering | Tampering | DB triggers on `ConsentAuditLog` (no UPDATE/DELETE); CHECK constraint `entered_with_consent → PhotoId NOT NULL` |
| Cross-tenant audit data leak | Information Disclosure | `TenantFilterInterceptor` via `ITenantAwareLinqFactory`; existing `CrossTenant_EntryLog_TenantCannotSeeOtherTenantEntries` test |
| SQL injection via filter params | Tampering | Parameterized WHERE clauses (`@param{n}`) in `ConsentAuditLogRepository` — never string-concatenate user filters |

## Sources

### Primary (HIGH confidence — read directly from the worktree this session)
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Api/Endpoints/SecurityEndpoints.cs` — reset/forgot-password/attendant endpoints + guards
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/ResetUserPasswordHandler.cs` — porteiro-only restriction, no email, revoke + MustChangePassword
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/ForgotPasswordHandler.cs` — SMTP dispatch pattern, enumeration-safe, rate-limit
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Contracts/SecurityDtos.cs` — `ResetUserPasswordResponse` shape
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Domain/Entities/User.cs` — `MustChangePassword`, `ResetPassword`
- `src/Modules/Photos/ControlEasyReborn.Modules.Photos.Api/Endpoints/EntryLogEndpoints.cs` — filter params + export
- `src/Modules/Photos/ControlEasyReborn.Modules.Photos.Application/Handlers/EntryLogHandlers.cs` — list mapping
- `src/Modules/Photos/ControlEasyReborn.Modules.Photos.Application/Handlers/ExportEntryLogCsvHandler.cs` — ms-precision CSV
- `src/Modules/Photos/ControlEasyReborn.Modules.Photos.Domain/Entities/ConsentAuditLog.cs` — entry states + constants
- `src/Modules/Photos/ControlEasyReborn.Modules.Photos.Infrastructure/Persistence/ConsentAuditLogRepository.cs` — filter building, tenant scope
- `src/Modules/Photos/ControlEasyReborn.Modules.Photos.Application/Abstractions/IPhotoRepository.cs` — `IConsentAuditLogRepository.ListAsync` signature
- `src/Web/ControlEasyReborn.Web/src/app/features/audit/audit.page.ts` — existing audit page + lightbox + export
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/audit-filters/audit-filters.component.ts` — filter UI
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/audit-row/audit-row.component.ts` — row rendering (GUID porteiro)
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/entry-state-badge/entry-state-badge.component.ts` — badges
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-lightbox.component.ts` — lightbox
- `src/Web/ControlEasyReborn.Web/src/app/features/entry-log/entry-log.service.ts` — frontend filter/export wiring
- `src/Web/ControlEasyReborn.Web/src/app/features/platform/condominiums.page.ts` — platform-admin reset UI (existing)
- `src/Web/ControlEasyReborn.Web/src/app/features/administration/administration.page.ts` — TenantAdmin surface (no reset UI)
- `src/Web/ControlEasyReborn.Web/src/app/core/services/security-api.service.ts` + `auth.service.ts` — `resetUserPassword`
- `src/Web/ControlEasyReborn.Web/src/app/app.routes.ts` + `core/guards/{syndic,tenant-admin,platform-admin}.guard.ts` — route guards
- `src/Modules/Tenants/.../Api/Endpoints/TenantEndpoints.cs` — staff-list endpoints (platformAdmin-guarded)
- `src/Modules/Security/.../Application/Permissions/Permissions.cs` — `Photos.Read` policy
- `docker/mysql/init/09b-consent-schema.sql` — `ConsentAuditLog` schema, ms precision, append-only triggers, CHECK constraint
- `tests/ControlEasyReborn.IntegrationTests/EntryLogEndpointTests.cs` — ms-precision + append-only + cross-tenant coverage
- `src/Directory.Packages.props` — MailKit/MimeKit/BCrypt/FluentValidation/Mapster versions

### Secondary (MEDIUM confidence — referenced official project docs)
- `.planning/phases/20-account-operations-consent-audit-ui/20-CONTEXT.md` — locked decisions (copied verbatim)
- `.planning/milestones/v2.2-REQUIREMENTS.md` — ACCNT-01/02, CONSU-01/02/03
- `.planning/ROADMAP.md` — Phase 20 goal + success criteria
- `.planning/STATE.md` — password-reset decisions + blockers
- `.specs/consent-gatehouse/requirements.md` — CONSENT-03 contract
- `.planning/milestones/v2.1-phases/18-password-management/18-{CONTEXT,03-SUMMARY}.md` — PASS-03 backend reset contract
- `.planning/codebase/{STACK,ARCHITECTURE,TESTING}.md` — stack/patterns/testing
- `AGENTS.md` + `.opencode/rules/local-ci-verification.md` — constitutional constraints

### Tertiary (LOW confidence — flagged for user confirmation)
- None beyond the Assumptions Log (A1–A5), which are explicitly `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions read from `Directory.Packages.props`/`STACK.md` this session (no training-data versions)
- Architecture: HIGH — every seam read directly from shipped source in this worktree
- Pitfalls: HIGH — pitfalls derived from reading the actual handler/repository/page code (not generic guidance)
- Assumptions (delivery contract, porteiro name source, vocabulary): LOW/MEDIUM — flagged in Assumptions Log for user confirmation

**Research date:** 2026-09-24
**Valid until:** 2026-10-24 (30 days — stable domain, closeout phase; the cleanup branches have landed with no change to the audit-state vocabulary — verified 2026-09-26)
