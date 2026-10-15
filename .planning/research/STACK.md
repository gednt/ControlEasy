# Stack Research

**Domain:** Condominium access-control platform — milestone v2.4 additions (resident portal auth, visitor pre-registration, gatehouse self-service lane, apartment-scoped visit history, in-app arrival notifications, printable badges)
**Researched:** 2026-10-15
**Confidence:** HIGH (versions verified against NuGet/npm on 2026-10-15; integration recommendations cross-checked against actual codebase: `Directory.Packages.props`, `package.json`, `Program.cs` rate-limiter wiring, `OpaqueTokenIssuer.cs`, `qr-pass-modal.component.ts`, `device-health.service.ts`, `ReportReadRepository.cs` UNION arms, `TenantDayBoundary.cs`)

## Recommended Stack

The headline finding mirrors v2.1: **this milestone needs essentially zero new libraries.** Every v2.4 capability rides machinery that already shipped — BCrypt ≥ 11 password hashing, JWT bearer auth, built-in partitioned rate limiting, `OpaqueTokenIssuer` verifier-only tokens, `BrowserQRCodeSvgWriter` for QR rendering, the `window.print()` + `@media print` badge pattern, the DeviceHealthService polling idiom, and the `UNION ALL` with per-branch predicates read-model precedent. **What NOT to add matters more than what to add** (see dedicated section).

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| BCrypt.Net-Next | **4.2.0** (NuGet, published ~2026-06, current stable; repo pins 4.0.3) | Hash resident portal credentials — BCrypt cost ≥ 11 maintained per key decision | Resident login is a **new, public-facing authentication surface** — the highest-stakes crypto call in v2.4. 4.2.0 is the current stable (targets net10.0 + netstandard2.0/2.1, so net8.0 resolves cleanly via netstandard2.0; `CentralPackageTransitivePinningEnabled=true` handles pinning). 4.0.3 carries **no known NuGet advisories** — the bump is cheap, optional hygiene, not a blocker. API surface used by the repo (`HashPassword`/`Verify`/`GetHashInformation` work-factor checks) is unchanged |
| Microsoft.AspNetCore.Authentication.JwtBearer | **8.0.10** (already pinned — no change) | Resident portal JWT issuance + validation, extended with per-request suspended-status revocation check | Resident auth reuses the exact Security-module machinery (15-min access tokens, refresh-token revoke-all, `tenant_id`/profile/role claims). The suspended-status check (deny an already-issued JWT on the very next request after suspension — gap-review F06) is configured via the `JwtBearerEvents.OnTokenValidated` callback or the existing tenant middleware, **not** a new package. The v2.4-specific addition is a lightweight DB status check (or cached profile-version claim) invoked per request for resident-role tokens only |
| Microsoft.AspNetCore.RateLimiting | **built into ASP.NET Core 8** (no PackageReference) | New named policies for the self-service lane + resident portal: partition on **normalized canonical document**, plus IP/endpoint fallbacks | `Program.cs:186–255` already wires `AddRateLimiter`/`UseRateLimiter` with a fixed-window policy from Phase 18 — v2.4 adds policies in the same block (e.g. `"lane-checkin"`, `"resident-login"`), using `RateLimitPartition.GetFixedWindowLimiter` partitioned on the **validated canonical document** (bounded key per the MS DoS guidance the codebase already respects). Zero dependency. Rejection writes ProblemDetails + `Retry-After` (existing pattern) |
| OpaqueTokenIssuer | **already in repo** (`AccessControl.Infrastructure.Services`, 32-byte token, HMAC-SHA256 verifier, fixed-time compare) | Pre-auth visitor codes (RES-07/08): verifier-only high-entropy codes on the self-service lane; badges reuse the same `AccessCredential` machinery | Gap review F05/F12 closed this explicitly: codes are **opaque 32-byte base64url tokens, not visitor-typable**, verified with `CryptographicOperations.FixedTimeEquals`. Badge issuance reuses `CredentialLifecycleHandlers` (VisitId-bound `SubjectKind.Visitor`, raw token returned only at issuance, no storage of plaintext). **No second token/QR subsystem** |
| DBTools 1.4.3 — `SelectRawAsync` with explicit `UNION ALL` arms | already in repo | Apartment-scoped visit history read model (Phase 30) | The v2.1-era caution against raw UNION was **superseded by shipped v2.1 code**: `ReportReadRepository.cs:264–433` runs a single `UNION ALL` query where **every arm carries an explicit `tenant_id = @p0` predicate** (interceptor-safe by construction) with X-Total-Count pagination. The Phase 30 apartment-history endpoint extends this idiom and adds **`apartment_id = @pN` predicates per branch**. `TenantDayBoundary` (Reports.Application/Time) already converts tenant-local days → UTC bounds for validity-window and "expected today" semantics (gap-review F13) |
| Angular 18 + Tailwind v4 design system + `device-health.service.ts` polling idiom | no new packages | Self-service lane pages, resident portal pages, durable in-app notification poller, badge display | Notification delivery (RES-10) is **portal polling**, decided in the gap review (F14: durable unread/read-state rows, no stream transport). The Phase 26 singleton-poll pattern (`BehaviorSubject` diff in the service, transition dedup, back-off after errors, one HTTP cycle regardless of mounted pages) is the proven in-repo template for a notification inbox with unread-badge counts. Handwritten `*ApiService` classes per the v2.3 precedent (OpenAPI regen deferred, flagged) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @zxing/browser | **0.1.5** (already pinned — do **not** bump mid-milestone) | **Rendering** the badge QR and any lane pre-auth QR via `BrowserQRCodeSvgWriter` (used by `qr-pass-modal.component.ts:284`) | Current npm version is 0.2.1 (published ~3 months ago), but 0.1.5 has no known vulnerabilities and both the scanner page and pass modal depend on its API. A 0.x major-ish bump mid-milestone is breaking-change risk for zero gain — defer to a hygiene milestone |
| FluentValidation | 11.9.0 (already pinned) | Validate pre-registration payloads, purpose codes, document formats, validity windows, `max_uses` bounds | Existing validation convention for all Application-layer commands |
| Mapster | 7.4.0 (already pinned) | DTO mapping for new endpoints | Existing convention |
| Serilog ( sinks Console/File/Seq, 6.0.0/8.0.3/4.0.2 as pinned) | already in repo | PII masking & log redaction across new personal-data surfaces (RES-14) | Existing redaction-arch-tests infra from v2.1; the v2.4 requirement extends the same masking approach to visitor names/documents/plates and verifier tokens |
| MailKit | **4.16.0** (already pinned — no v2.4 change) | Only if resident credential provisioning/first-password delivery ultimately routes through email | TenantAdmin-only password recovery + in-person credential provisioning (gate review decision) may need zero new email sends; the existing `IEmailSender`/Mailpit dev machinery covers any that arise. Advisory research from v2.1 stands: never pin below 4.15.1 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| (none new) | — | Testcontainers.MySql (4.0.0), NetArchTest (1.3.2), xUnit/FluentAssertions/NSubstitute, Playwright 1.49 + axe-core 4.11.3, Mailpit dev mail, ng-openapi-gen + `openapi-check` — all in place. v2.4 adds **negative integration suites** (deny matrix, RES-13) and fake-clock boundary tests using the existing xUnit/Testcontainers setup; Playwright covers the lane journey/badge print E2E (gap-review F15 demands browser E2E, not API fixtures) |

## Installation

```bash
# Central package management — src/Directory.Packages.props:
#   Optional hygiene bump (the ONLY .NET change this milestone):
#     <PackageVersion Include="BCrypt.Net-Next" Version="4.2.0" />
#   (4.0.3 also acceptable — no known advisories; bump is low-cost, low-risk)
#
# Everything else v2.4 needs is already pinned or in the shared framework.
# No npm installs. No new Compose services. No new dev dependencies.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-rolled canonical document value object (CPF check-digit in ~30 lines of tested domain code) | CPF validation NuGet packages (e.g. `CpfCnpjValidation`-style helpers), or a normalization library | Only if requirements expand to many country-specific document types with per-territory check-digit rules. The gap review (F08) scoped v2.4 to **typed canonical identity + CPF check-digit** — a small, fully testable pure function; a package adds a transitive dependency for math one can test exhaustively |
| Per-request DB status check for suspended residents (via `JwtBearerEvents.OnTokenValidated` or role-scoped middleware) | Shorter-lived tokens (e.g. 1-min) to approximate revocation, or session-version claims alone | Session-version claims are the right *complement* (cheap on hot path), but the authoritative check for "already-issued JWT denied on next request" must hit the DB (the resident credential is the write surface). Gap review F06 made this an acceptance criterion in Phase 27 |
| Angular HTTP polling (existing singleton idiom) for arrival notifications | SignalR/WebSocket streams, Server-Sent Events | Only if multi-replica scale-out or sub-second delivery becomes a real product need. v2.4 explicitly chose durable unread/read-state + polling (F14); SSE through Traefik adds proxy buffering/compression config per browser for marginal value |
| Browser print (`window.print()` + `@media print` print-only card, extending `qr-pass-modal`'s proven CSS) | jsPDF/pdfmake or server-side headless-Chromium/wkhtmltopdf PDF service in Compose | Only if a condominium demands archived PDF badges. That is a whole new Compose service + headless browser runtime for zero product value in v2.4 |
| Reuse `AccessCredential` + `CredentialLifecycleHandlers` for badges | Second credential subsystem / decorative VisitId-only QR | Never — decided (F12): VisitId-bound, verifier-only, reprint = new staff-authorized print, no plaintext persisted |
| `max_uses` + validity window consumed at read time; `uses_used` counter checked-and-incremented inside the canonical transaction | Background hosted-service sweep flagging "expired" rows | Never — decided: "expired" is **derived at read time** (window closed), no background sweep; matches the v2.3 heartbeat-derived-status decision class |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| SignalR / SSE / any WebSocket infrastructure | F14 decided portal polling; single `api` container makes streams pure complexity: hub auth across resident/staff role policies, WS upgrade buffering config in Traefik, reconnect state machines — all for a delivery SLA polling satisfies (durable rows + seconds-level SLA) | Durable `Notification` rows inserted in the canonical transaction + resident-portal poll on the `device-health.service.ts` idiom |
| Push services (OneSignal, FCM, native app) | Explicitly Out of Scope ("resident-facing mobile app / push notifications — v2.4 delivers in-app portal notifications only") | In-app unread inbox |
| Redis / distributed cache or distributed rate limiting | Modular monolith runs as one `api` container; in-memory partitioned limiters and `IMemoryCache` are correct at this scale (documented single-instance tradeoff, consistent with v2.1) | Built-in `PartitionedRateLimiter` + in-process cache |
| MediatR / hosted background queues | Repo policy: no MediatR; handlers registered as scoped services directly; no second write path | Direct scoped-handler invocation inside the canonical transaction |
| EF Core / `MySql.Data` (or any non-DBTools data access) | Constitutional/AGENTS.md prohibition | `IAsyncSqlClient` / `Linq<T>` with per-branch tenant predicates |
| A public/anonymous visitor-phone check-in API | Gap review F01/PROJECT.md decision: self check-in ships as a **supervised, gatehouse-Authenticated self-service lane**; the visitor-phone path is deferred (gated on a parked delivery channel); anonymous endpoints also lack tenant context (`TenantMiddleware` skips anonymous users) | Gatehouse-authenticated lane page where the visitor enters document / verifier code |
| Server-side QR generation (QRCoder NuGet, `qrcode` npm, badge images rendered by the API) | `@zxing/browser`'s `BrowserQRCodeSvgWriter` already renders QRs client-side in this app (established at qr-pass-modal); a second QR library doubles bundle weight and splits rendering logic | Same `BrowserQRCodeSvgWriter` component |
| jsPDF / pdfmake / wkhtmltopdf / headless Chromium in Compose | Badge printing is browser print reusing the existing `ce-qr-pass-modal` print pattern — no PDF pipeline needed; a headless-browser Compose service is large new infrastructure | `#printable-badge` + `@media print { body * { visibility: hidden } ... }` + `window.print()` (precedent at `qr-pass-modal.component.ts:225–304`) |
| Background sweep for expired/consumed pre-registrations | Decided: expired is derived at read time; a sweep adds a timer component with tenant-day clock hazards and no product value | Window-vs-now comparison in the endpoint, using `TenantDayBoundary` for tenant-local day boundaries |
| `@zxing/browser` 0.2.x upgrade | v0.x library with breaking-change risk across the live scanner page and qr-pass modal; current pinned version has no known vulnerabilities | Defer to post-v2.4 hygiene task |
| New chart/calendar libraries for the resident history view | Design system is table/ledger-first (same reasoning as v2.1 reports page) | Semantic tables + design-token styling |
| Identity-scanner hardware, biometric packages | Out of scope (explicit); arch tests fail the build on biometric keywords | Entered document matched against pending authorization |

## Stack Patterns by Variant

**If the resident portal hits the existing staff endpoint surface (RES-13 deny matrix):**
- Add explicit role policies (`Policy("TenantStaff")` = TenantAdmin/Porteiro) over *every* existing staff endpoint; resident JWTs get `RequireAuthorization` → forbidden.
- The deny matrix is a **authorization-policy + negative-integration-test deliverable**, not a library: extend the Security module's policy registration from v2.1 (`role` claim checks) — no new authentication technology.
- Constant-cost uniform denials: run the BCrypt verify against a decoy hash when the profile is unknown (the `ForgotPasswordHandler`/`LoginHandler` precedent already established the pattern in this codebase — extend, don't reinvent).

**If the lane needs rate limiting that survives multi-source abuse (F05 budgets):**
- Partition on the **normalized canonical document** (bounded, validated key) at the handler level *and* attach a fixed-window named policy at the endpoint; do **not** trust unconfigured `X-Forwarded-For` — the codebase still has **no `UseForwardedHeaders()`** (grep-verified 2026-10-15), so IP buckets would throttle the whole gatehouse LAN as one. If an IP dimension is wanted behind Traefik, add `UseForwardedHeaders` with explicit `KnownProxies` in the same change — that is a *decision this milestone may need once*, still zero packages.
- Bounded backoff on the verifier (attempt budget per code), and audit-volume caps on refused-attempt logging — all app-level, no packages.

**If atomic consumption must be proven (F10):**
- Compare-and-consume (`UPDATE ... SET UsesUsed = UsesUsed + 1 WHERE ... AND UsesUsed < MaxUses` rowcount check) + Visit advance + notification insert in **one `IAsyncSqlClient` transaction** through the canonical `VisitorArrivalHandler`; bounded idempotent replay keyed on (preRegistrationId, visitorRequest) — reuses the scan-attempt idempotency precedent (`RecordAccessScanHandler:99–119`). No outbox needed: notification rows are durable *in* the transaction, not asynchronously delivered.

**If OpenAPI client generation is applied to v2.4 endpoints:**
- Follow the v2.3 handwritten-`DevicesApiService` precedent for speed, but note the standing `⚠️ Revisit`: the `openapi-check` gate requires regen before `git diff --exit-code` passes. Either (a) regenerate generated clients for the resident-portal endpoints (they are the stable, long-lived surface) while hand-writing only lane endpoints, or (b) run `npm run openapi-gen` and commit the new generated files — both satisfy the gate; pick in Phase 27 planning, no new tooling either way.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| BCrypt.Net-Next 4.2.0 | net8.0 ✓ (targets net10.0 + netstandard2.0/2.1); net8.0 resolves via netstandard2.0 | No dependencies. 4.1.0/4.2.0 are the first two releases (4.1.0 ~May 2026, 4.2.0 ~June 2026) after the repo's 4.0.3; API surface used in this repo unchanged. Project is preparing V5 upstream — do not preempt a pre-release |
| @zxing/browser 0.1.5 (pinned) | @zxing/library 0.21.3 (peer pair, both pinned) | npm current is 0.2.1 (~2026-07/10); stay on 0.1.5 for v2.4 — v0.x, breaking changes between 0.1.x→0.2.x, zero security exposure, used by two live features |
| Microsoft.AspNetCore.* 8.0.10 (pinned) | .NET 8 runtime | ⚠️ .NET 8 LTS support ends **2026-11-10** — inside v2.4's window but the TFM must NOT change mid-milestone. Log as a post-v2.4 platform task (v2.5 planning should include a .NET 8→10 TFM decision alongside the Angular upgrade question) |
| MailKit 4.16.0 (pinned) | .NET 8 ✓ | Advisory-clean per v2.1 research (≥ 4.15.1); no v2.4 trigger to bump — do it opportunistically, not as v2.4 scope |
| MySqlConnector 2.3.7 / DBTools 1.4.3 | .NET 8 ✓ | No new types needed for v2.4; transactions via existing `IAsyncSqlClient` seams |

## Sources

- NuGet — BCrypt.Net-Next 4.2.0 (current stable, ~2026-06, 62M downloads, netstandard2.0/2.1 + net10.0 targets, no advisories flagged) and 4.1.0 release existence — fetched 2026-10-15 — **HIGH**
- npm — `@zxing/browser` 0.2.1 current (published ~3 months ago; 0.1.5 in version list; MIT; contains the `BrowserQRCodeSvgWriter` writer API); `@zxing/library` 0.23.0 current vs repo 0.21.3 — fetched 2026-10-15 — **HIGH**
- Codebase (HIGH, read directly 2026-10-15): `src/Directory.Packages.props` (CPM; BCrypt.Net-Next 4.0.3, MailKit 4.16.0, JwtBearer 8.0.10, no rate-limit packages); `src/Web/ControlEasyReborn.Web/package.json` (@zxing/browser 0.1.5, @zxing/library 0.21.3, no chart/QR/pdf/push/SignalR packages); `src/Host/ControlEasyReborn.Api/Program.cs:186–255` (AddRateLimiter fixed-window precedent, no `UseForwardedHeaders`); `src/Modules/AccessControl/.../OpaqueTokenIssuer.cs` (32-byte base64url token, HMAC verifier, `FixedTimeEquals`); `src/Web/.../qr-pass-modal.component.ts` (BrowserQRCodeSvgWriter QR rendering + `@media print` + `window.print()` badge precedent); `src/Web/.../device-health.service.ts` (singleton polling + transition dedup + back-off idiom); `src/Modules/Reports/.../ReportReadRepository.cs` (shipped `UNION ALL` arms with explicit per-branch tenant predicates, lines 264/295/314/348/404/424/433); `src/Modules/Reports/.../TenantDayBoundary.cs` (tenant-local day↔UTC bounds utility)
- `.planning/research/STACK.md` (v2.1 research — MailKit advisory floor ≥ 4.15.1, Mailpit dev tooling, rate-limiter DoS-bounded-key guidance, no chart library rationale — all still in force) — **HIGH**
- `.planning/PROJECT.md` v2.4 section + `.planning/notes/v2-4-codex-gap-review.md` findings F01–F18 (decisions baked into recommendations above: supervised lane, max_uses, apartment-owned, derived expiry, verifier-only codes, atomic compare-and-consume, AccessCredential badge reuse, polling notifications) — **HIGH**

---
*Stack research for: milestone v2.4 — Resident Self-Service & Visitor Experience (STACK decision inputs)*
*Researched: 2026-10-15*