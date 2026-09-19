# Stack Research

**Domain:** Condominium access-control platform — milestone v2.1 additions (SMTP email, rate limiting, secure temp passwords, unified visits ledger, reports page)
**Researched:** 2026-09-19
**Confidence:** HIGH (library versions verified against NuGet/npm/MS Learn on 2026-09-19; integration recommendations cross-checked against actual codebase: `Program.cs`, `Directory.Packages.props`, `docker-compose.yml`, `ReportReadRepository.cs`, `TenantFilterInterceptor.cs`, `package.json`)

## Recommended Stack

The single biggest finding: **this milestone needs almost no new libraries.** One NuGet package (MailKit), one Compose service (Mailpit), and everything else is already inside ASP.NET Core 8 / .NET 8 BCL / the existing Angular 18 app. The unified ledger needs *zero* new technology — the existing DBTools pattern covers it.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| MailKit | **4.18.0** (NuGet, published 2026-09-13) | SMTP sending for temporary-password emails | Microsoft's own API docs say `System.Net.Mail.SmtpClient` is "not recommended for new development — use MailKit" (dotnet/platform-compat DE0005). MailKit is MIT, .NET Foundation, targets `net8.0` directly, supports STARTTLS/smtps + all SASL auth, fully async & cancellable APIs. Versions ≤ 4.14.1 carry moderate-severity advisories; **pin ≥ 4.15.1, use 4.18.0 (current, advisory-clean)** |
| Microsoft.AspNetCore.RateLimiting | **built into ASP.NET Core 8** (shared framework, no NuGet install) | Rate-limit `POST /api/v1/forgot-password` and admin-reset endpoints | Already in the `Microsoft.AspNetCore.App` shared framework this app runs on. Named policies attach to minimal-API endpoints with `.RequireRateLimiting("policy")`; `System.Threading.RateLimiting` (fixed/sliding window, token bucket, concurrency) ships alongside. Zero new dependency, framework-supported, configurable via `IConfiguration` like every other option in this codebase |
| System.Security.Cryptography.RandomNumberGenerator | **.NET 8 built-in** — `GetString()` / `GetItems<T>()` | Secure random temporary-password generation | `RandomNumberGenerator.GetString(ReadOnlySpan<char> choices, int length)` arrived in .NET 8 and uses **rejection sampling internally — no modulo bias**. This is exactly the fix for the bias present in the existing `PlatformAdminBootstrapService.GenerateRandomString` (`GetBytes(length)` + `bytes[i] % chars.Length`). No package, no new code pattern to learn |
| DBTools 1.4.3 — `SelectAsync` ×2 + in-memory merge | already in repo | Unified Shift ledger (Visits + AccessEvents as one chronological stream) | The established idiom in `ReportReadRepository.GetDashboardStatsAsync` is already "several `SelectAsync` calls merged, sorted, and truncated in C#". Both tables get **automatic `tenant_id` filtering by the `TenantFilterInterceptor`** with zero manual predicates. See "UNION analysis" below — raw `UNION` via `SelectRawAsync` is *not* worth the interceptor risk |
| Angular 18 (existing) + hand-rolled CSS/SVG bars | no new packages | Reports page: visit-counts-by-day + residents-per-apartment | The Shift Ledger design system is table/ledger-first; the two report endpoints return tiny aggregate arrays. An HTML table + a ~50-line CSS bar row (design-token colors, `aria-label` with the count) covers both datasets, keeps Karma/Jasmine unit-testable, adds no bundle weight, and honors the `ce-*` component contract |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | — | — | Password hashing (BCrypt.Net-Next 4.0.3, cost ≥ 11), validation (FluentValidation 11.9.0), OpenAPI clients (ng-openapi-gen), and DTO generation are all already present and cover the password-management flows. The reports page consumes the **already-generated but idle** OpenAPI report clients — verify with `npm run openapi-check` |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Mailpit** (`axllent/mailpit`) | Dev SMTP catch-all container for Compose | Verified at source (github.com/axllent/mailpit, 10.4k★, MIT): the actively-maintained successor to MailHog (which is dead — no releases/security updates for years). Single static Go binary; multi-arch Docker images (amd64 **and arm64** — relevant to this repo's arm64 CI task); SMTP on 1025, web UI on 8025; "accept any" SMTP-auth mode; REST API usable from Playwright E2E to assert the temp-password email arrived. No EULA required (unlike Seq) |
| Mailpit REST API | Integration/E2E assertion of email delivery | `GET /api/v1/messages` returns captured mail; lets `tests/` assert "temp password email was sent to X" without a real SMTP server |

## Installation

```bash
# Central package management — add to src/Directory.Packages.props:
#   <PackageVersion Include="MailKit" Version="4.18.0" />
# Then reference <PackageReference Include="MailKit" /> only in
# src/BuildingBlocks/ControlEasyReborn.Infrastructure (the MailKit adapter
# lives there, mirroring the S3StorageProvider pattern).

# No npm installs. No new dev dependencies.
```

**Compose addition** (`docker/docker-compose.yml`, mirroring the `adminer`/`seq` dev-service pattern):

```yaml
  mailpit:
    image: axllent/mailpit:latest
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: "1"   # accept any SMTP credentials in dev
      MP_MAX_MESSAGES: "500"
    ports:
      - "127.0.0.1:${MAILPIT_UI_PORT:-8025}:8025"   # web UI (loopback only, like other dev ports)
    # SMTP is on container port 1025, reachable from api as hostname "mailpit"
```

Wire the API to it with environment variables (same pattern as `Db__*`):

```yaml
  api:
    environment:
      Smtp__Host: mailpit
      Smtp__Port: "1025"
      Smtp__From: "noreply@controleasy.local"
      # Production: real host/creds via env vars or Docker secrets (never App.config — policy)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| MailKit 4.18.0 | `System.Net.Mail.SmtpClient` | Never for new code — Microsoft explicitly discourages it (DE0005: no modern protocol support, sync-heavy design, not recommended) |
| MailKit direct behind `IEmailSender` | FluentEmail / other mail-abstraction packages | Only if the project later needs many interchangeable senders with templating; an extra dependency tree for one email type (temp passwords) is not justified |
| Mailpit | MailHog | Never — MailHog upstream is unmaintained (no security updates); Mailpit is its documented successor |
| Built-in `AddRateLimiter` | AspNetCoreRateLimit (community NuGet) | Only if you later need per-tenant/IP allow-list persistence in DB or complex IP-range rules; built-in partitioned limiters cover forgot-password needs |
| Two `SelectAsync` + C# merge for ledger | Raw `UNION ALL` via `SelectRawAsync` | Only if a single tenant's `AccessEvents` grows to tens of thousands of rows and per-table paged queries measurably lag — and even then do per-table `ORDER BY ... LIMIT` raw queries with **explicit** `tenant_id` predicates (as `ReportReadRepository.cs:99` already does), not one big UNION |
| No chart library (table + CSS bars) | ng2-charts 10.0.0 + chart.js 4.5.1 | If stakeholders later demand canvas charts: ng2-charts is the maintained Angular wrapper (current 10.0.0, 332k weekly downloads, standalone `provideCharts()` API, peer `chart.js ^4` — current 4.5.1). ApexCharts rejected: heavier, SVG-difficult to theme against the Tailwind v4 token contract |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `System.Net.Mail.SmtpClient` | Deprecated for new development per Microsoft (DE0005); lacks modern auth/TLS extensions | MailKit `SmtpClient` (`MailKit.Net.Smtp`) |
| **Raw `UNION` SQL for the ledger** | The `TenantFilterInterceptor` appends `tenant_id = @ctx_tenant` by string-splicing onto the *last* `WHERE` (or end of statement). On a two-arm UNION the injected predicate binds to the **second SELECT arm only** — the first arm would silently lose tenant filtering. Multi-tenant isolation breach risk | Two `SelectAsync` calls (one per table) through `ITenantAwareLinqFactory.Create(_ctx)` — both arms automatically interceptor-filtered, then merge-sort in the handler |
| MediatR / hosted background queue for email | Policy: no MediatR; handlers registered as scoped services directly | `IEmailSender.SendAsync` awaited inside the handler, wrapped in try/catch → Serilog warning. Enumeration-safe design means SMTP failure must **never** change the HTTP response anyway |
| Distributed rate limiting (Redis, etc.) | Modular monolith runs as one `api` container; in-memory partitioned limiters are correct at this scale | Built-in `PartitionedRateLimiter` |
| MailHog, Papercut.SMTP (stale) | Dead or low-activity upstreams | Mailpit |
| Chart.js / ng2-charts / ApexCharts in v2.1 | Two aggregate endpoints and a ledger-first design system; a canvas lib adds bundle weight, a11y surface (the repo runs `tests/a11y` axe audits), and Karma testing friction for zero product value | Semantic `<table>` + CSS bar rows built from design tokens; revisit only with a concrete chart requirement |

## Stack Patterns by Variant

**Email sending architecture (mirror the Storage pattern — it's the proven precedent in this repo):**

- `IEmailSender` interface in `src/BuildingBlocks/ControlEasyReborn.SharedKernel/` (like `IStorageProvider`).
- `MailKitSmtpEmailSender` in `src/BuildingBlocks/ControlEasyReborn.Infrastructure/Email/` + `SmtpOptions` bound from `Smtp:*` config (like `S3StorageProvider` + `StorageOptions`).
- Module DI: `AddControlEasyEmail(builder.Configuration)` registered next to `AddControlEasyStorage` in `Program.cs`.
- `SendAsync` per message: `using var client = new SmtpClient(); await client.ConnectAsync(host, port, SecureSocketOptions.StartTlsWhenAvailable, ct); await client.AuthenticateAsync(...); await client.SendAsync(mime, ct);` — MailKit connections are **not** thread-safe pooled objects; one client per send (temp-password volume is tiny; connection reuse is a non-goal).
- `NullEmailSender` (logs only) registered in unit/integration test hosts; Playwright E2E can assert via Mailpit's REST API.
- **Do not** add SMTP to the `/health` healthcheck — an SMTP outage must not take the stack's readiness down; log + uniform-200 instead.

**Rate limiting scheme for forgot-password (concrete):**

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = /* write ProblemDetails + Retry-After (RFC 7807 policy) */;
    options.AddPolicy("password-reset", httpContext =>
    {
        // Bounded key: validated email, not raw user input (per-MS-docs DoS warning
        // about unbounded partition keys), plus IP bucket via forwarded headers.
        var email = /* normalized form body email */;
        return RateLimitPartition.GetFixedWindowLimiter(
            $"{email}", _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 3, Window = TimeSpan.FromMinutes(15), QueueLimit = 0
            });
    });
});
// Program.cs: app.UseRateLimiter(); placed with the middleware chain (endpoint-
// specific policies must come after UseRouting — minimal APIs route implicitly,
// so simply place it alongside UseAuthentication/UseAuthorization).
// Endpoint: .RequireRateLimiting("password-reset")
```

- **Critical integration fact:** the codebase has **no `UseForwardedHeaders()` anywhere** (grep-verified). Behind Traefik, `Connection.RemoteIpAddress` is the Traefik container IP — IP-partitioned limits would throttle *all* users as one bucket. Add `app.UseForwardedHeaders(new ForwardedHeadersOptions { ForwardedHeaders = XForwardedHeaders.XForwardedFor, KnownProxies = /* traefik network */ })` early in the pipeline, **or** partition primarily on the normalized email (bounded) and let the DB-side one-time-ticket state machine be the real per-account limiter.
- Application-level backstop (in-handler, not middleware): cap temp-password issues per account per rolling 24h (e.g., 3); on exceed, still return the same 200 body and skip re-emailing.

**Temp-password generation (drop-in, no modulo bias):**

```csharp
public static class TemporaryPassword
{
    // Unambiguous set (no 0/O/o, 1/l/I) — readable when read aloud over the
    // phone at a gatehouse. 54 symbols → 12 chars ≈ 68 bits, ample for a
    // one-time password that is force-changed on first login.
    private static readonly SearchValues<char> Choices =
        SearchValues.Create("abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789");

    public static string Generate(int length = 12) =>
        RandomNumberGenerator.GetString(Choices.AsSpan(), length);
}
```

- Ensure the generated string satisfies the app's own password policy (check the existing FluentValidation rules — if a symbol class is required, extend `Choices` accordingly) so the forced `MustChangePassword` flow can't reject its own temp password.
- Existing `RandomNumberGenerator.GetBytes` + modulo sites (`PlatformAdminBootstrapService`, `OpaqueTokenIssuer`, `JwtTokenService`) are out of scope for v2.1, but new code must use `GetString`/`GetItems` (rejection sampling).
- One-time + re-arm semantics live in the existing Security module (`PasswordHasher` BCrypt cost ≥ 11, `MustChangePassword` flag) — no new library.

**Unified ledger read model (DBTools analysis — question d):**

- DBTools 1.4.3 offers no typed UNION builder; `SelectAsync(fields, table, where, params)` is single-table. The repo's own answer to cross-table views already exists at `ReportReadRepository.GetDashboardStatsAsync` (Visits + ConsentAuditLog merged in C#): **two `SelectAsync` calls, project each `DataRow` to a common `LedgerEntryDto(Timestamp, Kind, Subject, Status, DestinationLabel)`, concatenate, `OrderByDescending(t => t.Timestamp)`, `Take(N)`**.
- This is *more* correct than a UNION here, not just easier: each query is automatically tenant-filtered by `TenantFilterInterceptor` (it appends `tenant_id = @ctx_tenant` to single-table SELECTs safely), whereas a UNION's trailing injected predicate would bind to only one arm (see What NOT to Use).
- Extend `GET /api/v1/dashboard/stats`'s read path (`ReportReadRepository`) rather than inventing a new endpoint — the design note's open question resolves the same way: the repository already joins multiple tables; adding the `AccessEvents` arm is a third `SelectAsync` + merge.
- Volume reality: a shift ledger is bounded by one tenant's daily gate activity (dozens–hundreds of rows) — in-memory merge is the right cost model. Revisit raw per-table paging only on measured evidence.

**Reports page (question e):**

- Consume the existing generated clients (`ng-openapi-gen` output is already present but idle) — `visit-counts-by-day` + `residents-per-apartment` — and fix `dashboard.page.ts:178` routing to `/reports`. No new npm dependency.
- Chart rendering: `<table>` of `{Date, Count}` with a CSS `width: calc(count / max * 100%)` bar cell, colored from `docs/penpot/tokens.json` tokens. Accessible by construction (data is the table; the bar is decoration with `aria-hidden`). If a sparkline is wanted later, inline SVG polyline from the same data — still zero dependencies.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| MailKit 4.18.0 | .NET 8 ✓ (targets net8.0 + netstandard2.0) | Transitive: MimeKit 4.18.0 + System.Formats.Asn1 10.0.0. Mixing a 10.x BCL package on net8.0 has precedent in this repo (`Microsoft.Extensions.*` 10.0.1 already in `Directory.Packages.props`); `CentralPackageTransitivePinningEnabled=true` handles pinning |
| MailKit ≤ 4.14.1 | — | Flagged with moderate-severity advisories on NuGet — do not pin below 4.15.1 |
| Microsoft.AspNetCore.RateLimiting | ASP.NET Core 8 shared framework ✓ | Included in `Microsoft.AspNetCore.App` — no PackageReference needed. (If a *non-web* project ever needs the limiter types directly, add `System.Threading.RateLimiting` 8.0.x explicitly — hedged, MEDIUM confidence on that edge case only) |
| ng2-charts 10.0.0 (deferred) | chart.js ^4 (peer; current 4.5.1) | Only if charts are adopted later; standalone `provideCharts(withDefaultRegisterables())` registration |

## Sources

- NuGet — MailKit 4.18.0 package page (version, dates, target frameworks, advisory flags, SMTP feature list) — fetched 2026-09-19 — **HIGH**
- Microsoft Learn — `System.Net.Mail.SmtpClient` API reference, Remarks (SmtpClient not recommended; MailKit named; DE0005 reference) — fetched 2026-09-19 — **HIGH**
- Microsoft Learn — Rate limiting middleware in ASP.NET Core (aspnetcore-8.0 moniker: `AddRateLimiter`, named policies, `RequireRateLimiting`, `PartitionedRateLimiter.Create`, OnRejected, partition-key DoS warning) — fetched 2026-09-19 — **HIGH**
- Microsoft Learn — `RandomNumberGenerator.GetString(ReadOnlySpan<char>, int)` API reference (net-8.0; rejection-sampling semantics per GetItems docs) — fetched 2026-09-19 — **HIGH**
- GitHub — `axllent/mailpit` README (maintained successor to MailHog, multi-arch Docker, ports 1025/8025, accept-any auth, REST API) — fetched 2026-09-19 — **HIGH** (verified at source)
- npm — `ng2-charts` 10.0.0 (current, published ~2026-03, 332k weekly downloads, standalone API, Angular compat table); `chart.js` 4.5.1 (latest) — fetched 2026-09-19 — **HIGH**
- Codebase (HIGH, read directly): `src/Directory.Packages.props` (CPM, no MailKit/rate-limit packages present), `src/Host/ControlEasyReborn.Api/Program.cs` (middleware chain, no `UseRateLimiter`/`UseForwardedHeaders`), `docker/docker-compose.yml` (service pattern, no SMTP service), `src/Modules/Reports/.../ReportReadRepository.cs` (multi-query merge idiom + `SelectRawAsync` JOIN precedent), `src/BuildingBlocks/.../TenantFilterInterceptor.cs` (predicate injection mechanics → UNION hazard), `src/Host/.../PlatformAdminBootstrapService.cs` (modulo-bias generator precedent), `src/Web/ControlEasyReborn.Web/package.json` (no chart lib, ng-openapi-gen present)

---
*Stack research for: milestone v2.1 — integrated visits, reports page, password management*
*Researched: 2026-09-19*