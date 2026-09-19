# Project Research Summary

**Project:** ControlEasy Reborn — milestone v2.1 (Integrated Visits & Account Operations)
**Domain:** Multi-tenant condominium access-control platform (brownfield: ASP.NET Core 8 modular monolith + Angular 18 SPA + MySQL 8/DBTools)
**Researched:** 2026-09-19
**Confidence:** HIGH (stack, architecture, and pitfalls are code-verified against this worktree; features are MEDIUM via competitor/OWASP sources)

## Executive Summary

Milestone v2.1 is a brownfield integration on an already-working multi-tenant access-control platform, adding three tracks: (1) **visits data unification** — visitor QR scans and gatehouse walk-ins land as `Visit` rows so Visits becomes the single operational record, with `POST /api/v1/entry-log` re-scoped to its privacy-consent audit role; (2) **the unified Shift ledger + a `/reports` page** — one chronological stream (Visits + visitor AccessEvents + legacy ConsentAuditLog segment) feeding both the gatehouse panel and an audit-first reports page with date ranges, per-day counts, per-apartment breakdown, and CSV export; (3) **admin password management** — enumeration-safe forgot-password (temp password via SMTP, admins only) plus scoped admin resets (platform → any user, tenant admin → own gatekeepers). Market research (Envoy, Sign In App) confirms the ledger-as-source-of-truth, state stamps, search/filter/export, and self-service recovery are table stakes; the porteiro-native **shift handover trail** is a differentiator no incumbent offers.

The recommended approach is notable for what it does **not** add: exactly one NuGet package (MailKit 4.18.0), one dev Compose service (Mailpit), the built-in ASP.NET Core 8 rate-limiting middleware, and `RandomNumberGenerator.GetString` — everything else reuses existing machinery (DBTools merge idiom, `MustChangePassword` from staff lifecycle, generated OpenAPI clients, `VisitCreateModalComponent`). Integration follows five settled decisions: extend `IVisitDirectory` with `CheckInOrCreateAsync` (creation logic stays in Visits); re-scope entry-log with **no dual-write** and a cutoff constant for the legacy ledger segment; a single SQL UNION read model in `ReportReadRepository` with **explicit per-branch tenant predicates**; Security-module password handlers with a durable single-use `PasswordResetRequest` table; and a new thin `GatehousePage` composing existing components rather than stretching the 800+-line modal.

The dominant risks are all code-verified, not hypothetical: **double-counting** the merged ledger (the dashboard already double-adds ConsentAuditLog rows today — the read-model rewrite must land *with* the write-path fold); **breaking the append-only ConsentAuditLog** (DB triggers hard-fail UPDATE/DELETE — copy-forward only); **coercing append-only decision states into the Visit lifecycle enum** (use a discriminated-union view model); **SMTP hash-overwrite-then-send** stranding a locked-out admin (persist a delivery-state row in the same transaction, resend the same temp password); and **timing/message enumeration** copied from `LoginHandler`'s quick-exit bad example (uniform response + decoy BCrypt verify). Mitigations are concrete, anchored to file/line, and phase-mapped.

## Key Findings

### Recommended Stack

This milestone needs **almost no new libraries**: one NuGet package (MailKit), one Compose dev service (Mailpit), two .NET 8 built-ins, and zero npm installs. The unified ledger needs no new technology at all. See `.planning/research/STACK.md`.

**Core technologies:**
- **MailKit 4.18.0** (NuGet, 2026-09-13) — SMTP for temp-password emails. Microsoft explicitly deprecates `System.Net.Mail.SmtpClient` for new development (DE0005). Pin ≥ 4.15.1 (earlier versions carry advisories). Mirrors the existing `S3StorageProvider` pattern: `IEmailSender` in SharedKernel, `MailKitSmtpEmailSender` in BuildingBlocks.Infrastructure. One client per send (MailKit connections are not thread-safe pooled objects). **Never in the `/health` check.**
- **Microsoft.AspNetCore.RateLimiting** — built into the ASP.NET Core 8 shared framework, no install. Named policy (`"password-reset"`, fixed window, e.g. 3/15min) partitioned on **normalized email, not raw user input** (MS DoS warning), attached via `.RequireRateLimiting()`. Caution: there is **no `UseForwardedHeaders()` in this codebase** — behind Traefik all clients share one IP, so IP-partitioned limits would throttle everyone as one bucket; partition primarily on normalized email and let the DB-backed counter be the real limiter.
- **`RandomNumberGenerator.GetString`** (.NET 8 BCL) — rejection sampling, no modulo bias; fixes the bias pattern in the existing `PlatformAdminBootstrapService`. Use an unambiguous charset (no 0/O/o, 1/l/I — readable over the phone at a gatehouse); ~12 chars ≈ 68 bits.
- **Ledger read model** — `SelectAsync` ×2 + in-memory merge is the established idiom (and both queries get automatic `TenantFilterInterceptor` filtering); **but for the paged history page use a single SQL UNION via `SelectRawAsync` with explicit `tenant_id = @p0` in every branch** (see reconciled verdict below).
- **Reports UI: no chart library.** Semantic `<table>` + CSS bar rows from design tokens (`aria-hidden` bars, count in `aria-label`). Chart.js/ng2-charts deferred until a concrete syndic requirement exists. Consume the **already-generated but idle** OpenAPI report clients.
- **Mailpit** (`axllent/mailpit`) — dev SMTP catch-all in Compose (SMTP 1025, UI 8025, accept-any auth); maintained successor to the dead MailHog; REST API lets Playwright E2E assert the temp-password email arrived. arm64 images available.

> **Reconciled verdict on UNION (STACK.md vs ARCHITECTURE.md conflict):** STACK.md lists "raw UNION" as *what NOT to use* **only because the `TenantFilterInterceptor` splices `tenant_id = @ctx_tenant` onto the last WHERE — on a multi-arm UNION that predicate binds to one arm only, silently un-filtering the other arm (multi-tenant breach).** ARCHITECTURE.md decision (c) endorses a single UNION **with explicit, parameterized `tenant_id = @p0` in every branch**, deliberately bypassing the interceptor (same as the existing occupied-apartments raw query, `ReportReadRepository.cs:99`). These agree in substance: **SQL-side UNION with per-branch explicit tenant predicates for the paged history endpoint; two-query C# merge only for small bounded sets (dashboard top-10). Never let the interceptor inject predicates into a UNION.** Also set both `TenantId` and `tenant_id` columns on fold-created Visits (Pitfall 6).

**Version requirements:** MailKit ≥ 4.15.1 (use 4.18.0, advisory-clean; transitive MimeKit 4.18.0 + System.Formats.Asn1 10.0.0 — repo precedent exists, CPM pinning handles it). Everything else is already in `Directory.Packages.props` / the shared framework.

### Expected Features

See `.planning/research/FEATURES.md` (Envoy / Sign In App landscape analysis + OWASP).

**Must have (table stakes — P1, all in this milestone):**
- Visitor QR scan → Visit create-or-check-in (unmatched scans currently vanish — the actual bug being fixed)
- Walk-in registration from the gatehouse panel → Visits, landing **directly `CheckedIn`** (person is physically present; `Pending` is for pre-registered not-yet-arrived)
- Unified Shift ledger stream (Visits + visitor AccessEvents + legacy entry-log segment) with per-row state stamps (Pending/CheckedIn/CheckedOut)
- Consolidated gatehouse panel at `/gatehouse` (scan, manual lookup, walk-in, open visits); `/visits` demoted to admin management
- Ledger filtering + server-side search (date, status, subject, destination, origin)
- `/reports` page: date ranges (Today/7d/30d/custom), visit counts by day, residents per apartment, unified history table + CSV export (reuse Phase-13 millisecond-precision pattern) — fixes the dead `dashboard.page.ts:178` link
- Forgot-my-password on login (admins only, temp password via SMTP, enumeration-safe: uniform response + uniform timing, rate-limited)
- Admin reset: platform admin → any user; tenant admin → own gatekeepers (403 not 404 on cross-tenant); one-time temp password, `MustChangePassword` re-armed, refresh tokens revoked, audit-logged

**Should have (differentiators — v1.x):** shift handover trail with the `handover-transfer` interaction (no surveyed VMS has a first-class handover surface — porteiro-native differentiator); refused scans/security events in the ledger stream with origin stamps; pre-registration matching by document (CPF); purpose codes feeding per-day breakdowns; "on-site now" occupancy count; resident-facing read-only visit history.

**Defer / anti-features (v2+ or never):** badge printing (hardware, conflicts with the hardware-free v2.x constraint); reset-token email links (temp-password machinery already covers it — a second credential subsystem); visitor self-registration (attack surface); over-charted reports and real-time chart push (audit-first tables win; real-time belongs to the gatehouse panel); cross-tenant report rollups (tenant isolation); automatic retention/deletion timers (breaks append-only audit philosophy).

### Architecture Approach

Five integration decisions, all verified against source (see `.planning/research/ARCHITECTURE.md`): (a) extend `IVisitDirectory` with `CheckInOrCreateAsync` — Visit state-machine rules stay in the Visits module, AccessControl only requests them; (b) `POST /api/v1/entry-log` is **re-scoped, not deleted** — gatehouse walk-ins move to `POST /api/v1/visits` with `CheckInNow: true`; entry-log keeps recording consent/photo evidence (append-only triggers make it permanently safe); legacy ledger rows handled as a read-only segment below a cutoff constant, no backfill mutation; (c) unified ledger = one SQL UNION in `ReportReadRepository` (CQRS-lite read module that already reads foreign tables), paged server-side, `GET /api/v1/reports/history`; (d) password flows live in Security (`/auth/forgot-password` anonymous + scoped admin resets) with `User.ResetPassword` (arms `MustChangePassword` — existing `SetPasswordHash` does **not**), `RevokeAllForUserAsync` on refresh tokens, and a non-tenant-scoped `PasswordResetRequest` repository (plain `IAsyncSqlClient`, like `RefreshTokenRepository`) because the anonymous flow has no tenant context; (e) new thin `GatehousePage` composing existing components — do **not** stretch `CeEntryWorkflowComponent`.

**Major components:**
1. **Visits module** — `Visit.RegisterWalkIn(...)` walk-in factory (lands `CheckedIn`, existing `Pending → CheckedIn` guards untouched); `IVisitDirectory.CheckInOrCreateAsync` + repository impl; `CheckInNow` on `CreateVisitRequest`
2. **AccessControl handlers** — `RecordAccessScanHandler` / `RecordManualAccessHandler` call `CheckInOrCreateAsync` (small diffs at known lines)
3. **Reports read repository** — UNION history endpoint, dashboard-stats simplification (Visits-only counts, delete the de-dup set and silent catch), `Visits(tenant_id, CreatedAtUtc)` index migration
4. **Security password flows** — `ForgotPasswordHandler` / admin-reset handlers, `IEmailSender` + MailKit infra, single-use `PasswordResetRequest` table (delivery state + durable rate-limit counters), refresh-token revoke-all
5. **Angular** — `GatehousePage` (tabs: Scan QR / Manual lookup / Walk-in / Open visits), `/reports` route + page with generated clients, login forgot-link + admin reset buttons

### Critical Pitfalls

Top 5 of 15 (full list with code anchors, warning signs, and phase mapping in `.planning/research/PITFALLS.md`):

1. **Double-counting in the merged ledger (exists today)** — Visits and ConsentAuditLog rows have different Guids, so the current `existingVisitIds` dedupe can never match the same real-world entry; once walk-ins fold into Visits, every consent-state walk-in counts twice. **Avoid:** `VisitId` correlation column on AccessEvents; after the fold, dashboard counts come from Visits only; **land the read-model rewrite in the same phase as the write-path fold** (a double-counting window between phases is the trap).
2. **Status-model coercion** — mapping `entered_without_consent` → "Cancelled" / `gatehouse_only` → "CheckedOut" (what `MapConsentAuditEntry` does today) produces a ledger where a hard refusal reads as a cancelled visit. **Avoid:** discriminated-union view model (`source`, `kind`, native status, `occurredAt`); render each source's native state in the Angular layer; never merge enums.
3. **Breaking the append-only ConsentAuditLog** — DB triggers reject UPDATE/DELETE (verified by integration tests). **Avoid:** copy-forward only (new Visit rows referencing `ConsentAuditLogId`, marked for idempotency); any migration script containing `UPDATE/DELETE ConsentAuditLog` is rejected in review; post-migration trigger test.
4. **SMTP hash-overwrite-then-send stranding the admin** — BCrypt is one-way; DB-updated-then-SMTP-failed = locked-out admin with no recovery. **Avoid:** persist hashed temp password + delivery state (Pending/Sent/Failed) in the same transaction as the hash change; background retry or idempotent "resend" re-delivering the *same* temp password; never log the temp password (redaction arch test, pattern exists in AccessControl); demo no-op sender via `Demo.DisableOutboundEmail`.
5. **Enumeration timing + cross-tenant reset + rate-limit durability** — `LoginHandler`'s quick-exit is the bad example (measurable BCrypt timing delta); forgot-password must run a constant-cost decoy verify and return uniform body/status; authorization matrix is handler-level policy (platform → any, tenant admin → own only, foreign → 403); in-memory counters are wiped by container restarts and don't survive horizontal scaling — the durable per-account counter ships with the endpoint, and accounts are **never locked out** in response to reset floods (OWASP).

Also load-bearing: non-atomic QR→Visit half-writes (single transaction or make the visit side-effect idempotent on replay — Pitfall 5); UTC-vs-local day boundaries (21:30 BRT arrival lands on the wrong UTC day; compute tenant-local boundaries in the handler, group by shift window with `CrossesMidnight` — Pitfall 12); missing `Visits(tenant_id, CreatedAtUtc)` index and full-table `1=1` scans (Pitfall 13); the `**` wildcard silently eating the dead `/reports` route (route + guard + E2E as the phase's first task — Pitfall 14); single-use temp passwords consumed by affected-rows `UPDATE`, never by check-then-act (Pitfall 15).

## Implications for Roadmap

Based on combined research, suggested phase structure (three phases; Phase 3 is independent and may run in parallel with 1–2):

### Phase 1: Visits Unification Backend (walk-ins + QR→Visit + ledger read model)
**Rationale:** The write paths and the read-model rewrite must land **together** — the ledger is only *honest* after unmatched QR scans and walk-ins create Visit rows, and the double-counting window (Pitfall 1) exists between the fold and the stats simplification. This is the root dependency of everything else; it is also where the settled domain decisions (direct `CheckedIn`, state-machine preservation) are implemented. Covers architecture slices 1–4 (grouping 3+4 into the same phase rather than splitting them across A/B, per the Pitfall-1 phase mapping).
**Delivers:** `Visit.RegisterWalkIn` factory + `IVisitDirectory.CheckInOrCreateAsync`; `CheckInNow` on `POST /api/v1/visits`; scan/manual handlers repointed; entry-log re-scoped to consent-audit role (panel stops posting walk-ins there); ledger cutoff constant; `GET /api/v1/reports/history` UNION endpoint with explicit per-branch tenant predicates; dashboard-stats simplification (Visits-only counts, delete silent catch + dedupe set); `Visits(tenant_id, CreatedAtUtc)` index migration.
**Addresses:** FEATURES "Visitor QR → Visit", "Walk-in → Visits (direct CheckedIn)", "Unified Shift ledger stream" (backend).
**Avoids:** Pitfalls 1 (double-count), 2 (state coercion), 3 (append-only), 4 (state machine), 5 (non-atomic write), 6 (tenant scoping in raw SQL — two-tenant leak-assertion test per new query).

### Phase 2: Gatehouse Panel + Reports Page (frontend-heavy)
**Rationale:** Angular consumes the API shapes settled in Phase 1; building reports before the ledger read model would force a second read-model refactor (FEATURES dependency notes). This is the largest frontend slice.
**Delivers:** `GatehousePage` at `/gatehouse` (tabs composing existing components, deep-link parity, `VisitCreateModalComponent`-derived walk-in form); `/visits` demoted to management/reporting; dashboard button repoints; `/reports` route **inside the auth guard** (first task: route + guard + Playwright assertion on the dashboard link — Pitfall 14) with date ranges, by-day counts, per-apartment table, unified history + CSV export, generated OpenAPI clients; tenant-local day-boundary helper shared by ledger and reports (Pitfall 12); SQL-side aggregation per Pitfall 13.
**Addresses:** "Consolidated gatehouse panel", "Ledger filtering + search", "/reports page", differentiators "handover trail" and "refused scans as ledger context".
**Avoids:** Pitfalls 12, 13, 14; anti-feature drift (no charts, no real-time).

### Phase 3: Password Management (backend + frontend; independent — may run in parallel)
**Rationale:** Zero data dependency on visits (FEATURES dependency graph); new handlers in Security with one new infra leaf (`IEmailSender` + MailKit). Smallest risk surface, fully specified by OWASP + existing staff-lifecycle machinery (`MustChangePassword`, `changePasswordGuard` already work end-to-end).
**Delivers:** `POST /auth/forgot-password` (anonymous, admins only, uniform response + decoy verify), scoped admin resets (platform → any; tenant admin → own; 403 matrix tests), `User.ResetPassword` (arms `MustChangePassword`), `RevokeAllForUserAsync`, single-use `PasswordResetRequest` table (TempHash, ConsumedAtUtc, DeliveryState, EmailHash, RequestIp) doubling as the durable rate-limit counter, in-memory `AddRateLimiter` named policy, MailKit sender + Mailpit Compose service + REST-API E2E assertions, redaction arch test, demo no-op sender.
**Addresses:** "Forgot-my-password", "Admin reset", "One-time temp password + forced change", "Enumeration-safe responses".
**Avoids:** Pitfalls 7–11, 15; anti-features (no token tables, no lockout on floods).

### Phase Ordering Rationale

- **Dependencies discovered:** QR→Visit and walk-in→Visit must land before ledger extension is meaningful ("without them the unified stream is a lie"); `/reports` consumes the same read model, so ledger first; password management has no data dependency and is explicitly parallel-safe.
- **Grouping rationale:** keeping the ledger read model in the same phase as the write-path fold eliminates the double-counting window (Pitfall 1's explicit phase mapping); Phase 2 is grouped as one frontend slice because the gatehouse panel and reports page share the same read model and OpenAPI regeneration; Phase 3's isolation makes it schedulable by capacity.
- **Pitfall avoidance by construction:** every new raw query gets the two-tenant leak assertion (Phase 1 onward); the redaction arch test lands with the first password handler (Phase 3); route/guard/E2E is Phase 2's first task, not an afterthought.

### Research Flags

Phases likely needing deeper research during planning: **none via `/gsd-plan-phase --research-phase`** — all four documents are code-verified against this worktree. However, these **spec/design decisions must be resolved during phase discussion** (open questions from ARCHITECTURE.md):
- **Phase 1:** visitor identity for unmatched QR scans (what does `IssueCredentialHandler` store — name/document? if nothing usable, adopt the explicit "Visitante" label convention); walk-in landing status confirmation (direct `CheckedIn` assumed); ledger cutoff as build constant vs config (demo seeding); dashboard stats DTO shape (recommended: add `kind` discriminator).
- **Phase 3:** consolidate the reset persistence into **one** `PasswordResetRequest` table (ARCHITECTURE.md's rate-limit-keyed `PasswordResetAttempts` and PITFALLS.md's single-use delivery row overlap — one table with EmailHash + UserId + TempHash + ConsumedAtUtc + DeliveryState serves both; the email-hash key covers unknown-email rate limiting, the per-user row count the durable per-account counter); tenant-admin permission string for `attendant-profiles/{id}/reset-password`.

Phases with standard patterns (skip research-phase): **all three** — Phase 1 (repo-internal patterns verified at file/line), Phase 2 (existing component composition + generated-client pipeline + established E2E/a11y harness), Phase 3 (OWASP-documented patterns + existing `RefreshTokenRepository` non-tenant-scoped precedent; MailKit/Mailpit are thoroughly documented).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against NuGet/npm/MS Learn on 2026-09-19; every integration claim cross-checked against actual source (`Program.cs`, `Directory.Packages.props`, `docker-compose.yml`, `ReportReadRepository.cs`, `TenantFilterInterceptor.cs`). One MEDIUM edge: explicit `System.Threading.RateLimiting` package needed only if a non-web project wants limiter types directly. |
| Features | MEDIUM | Competitor claims from product marketing pages (Envoy, Sign In App) + OWASP cheat sheets (HIGH); internal dependency claims verified HIGH from repo inspection. No user research behind prioritization. |
| Architecture | HIGH | All five decisions verified against source in this worktree; recommendation confidence noted per section; open questions explicitly flagged above. |
| Pitfalls | HIGH | Nearly all findings code-verified with file/line anchors; OWASP guidance from official cheat sheets; timezone/MySQL DATETIME claims MEDIUM (community-documented, consistent with read code). |

**Overall confidence:** HIGH

### Gaps to Address

- **Visitor identity for unmatched QR scans** — verify during Phase 1 planning what `IssueCredentialHandler` stores for visitor subjects; if unusable, adopt an explicit "Visitante" label convention as a spec decision (ledger must never silently drop an unmatched scan — that is the bug being fixed).
- **Reset-table consolidation** — merge `PasswordResetAttempts` (rate-limit keyed by EmailHash) and the single-use delivery row into one `PasswordResetRequest` design during Phase 3 planning; concurrent-issuance supersession semantics ("newest email is the only valid one") stated in email copy.
- **Day-boundary semantics** — existing `GetVisitCountsByDayAsync` groups by UTC day (wrong for BRT evenings); fix in Phase 2 with a tenant-timezone setting (default `America/Sao_Paulo` as a named constant/tenant setting, never scattered literals); state which boundary historical rows used.
- **Ledger cutoff constant vs config** — build constant is simplest; switch to config only if demo seeding must create legacy-looking rows.
- **Anonymous-flow tenant handling** — forgot-password has no JWT/tenant context; dedicated non-tenant-scoped repository with explicit parameterized SQL (precedent: `RefreshTokenRepository`); never fight `HttpTenantContext`.
- **Forwarded headers** — no `UseForwardedHeaders()` exists; behind Traefik, IP-based limiter partitions collapse to one bucket. Either add it early in the pipeline with known proxies, or partition on normalized email only (recommended for v2.1).

## Sources

### Primary (HIGH confidence)
- Codebase (read directly, this worktree): `ReportReadRepository.cs`, `RecordAccessScanHandler.cs`, `RecordManualAccessHandler.cs`, `Visit.cs` + `VisitDirectoryRepository.cs`, `LoginHandler.cs` + `UserRepository.cs`, `TenantFilterInterceptor.cs`, `Program.cs` + `appsettings.json`, `docker/mysql/init/{05,06,09b,11,12}-*.sql`, `SecurityEndpoints.cs`, `RefreshTokenRepository.cs`, `entry-workflow.component.ts`, `dashboard.page.ts`, `app.routes.ts`, `package.json`, `Directory.Packages.props`, `docker-compose.yml`
- Microsoft Learn — `SmtpClient` DE0005 deprecation, Rate limiting middleware (aspnetcore-8.0), `RandomNumberGenerator.GetString`
- NuGet — MailKit 4.18.0 (version, target frameworks, advisory flags)
- GitHub — `axllent/mailpit` README (verified at source)
- OWASP Forgot Password Cheat Sheet + Authentication Cheat Sheet (fetched 2026-09-19)
- Repo-internal: `.planning/notes/integrated-visits-flow.md`, `.planning/todos/pending/integrated-visits-flow.md`, `DESIGN.md`, `PROJECT.md` Key Decisions, tenant staff lifecycle commit `55377a0`

### Secondary (MEDIUM-HIGH confidence)
- Envoy Visitors product page, Sign In App features page — market table stakes / differentiators (marketing sources)
- npm — ng2-charts 10.0.0 / chart.js 4.5.1 (HIGH quality, but deferred decision)
- ASP.NET Identity docs — security-stamp / lockout patterns (context only; no Identity used)

### Tertiary (MEDIUM confidence)
- MySQL DATETIME/timezone behavior and .NET DateTime kind semantics (community-documented; consistent with code read)
- Data-store unification/dedup industry patterns (grounded by the concrete dedupe-by-Id defect found in `ReportReadRepository`)

---
*Research completed: 2026-09-19*
*Ready for roadmap: yes*