# Project Research Summary

**Project:** ControlEasy Reborn — milestone v2.4 (Resident Self-Service & Visitor Experience)
**Domain:** Multi-tenant condominium access control — resident portal, visitor pre-registration, supervised self check-in lane, notifications (Phases 27–30)
**Researched:** 2026-10-15
**Confidence:** HIGH (stack/architecture/pitfalls code-verified against current tree; features MEDIUM on Brazilian segment claims, HIGH on internal dependencies)

## Executive Summary

v2.4 adds a resident role and a visitor-facing self-service flow to an already-built access-control monolith, and the single most important research conclusion is this: **the milestone needs essentially zero new libraries.** Everything rides machinery that already shipped — BCrypt ≥ 11 + JWT bearer for resident login, `OpaqueTokenIssuer` verifier-only tokens for pre-auth codes and badges, the built-in partitioned rate limiter, `BrowserQRCodeSvgWriter` for QR rendering, the `window.print()` + `@media print` badge pattern (qr-pass-modal), the `DeviceHealthService` singleton-polling idiom for notifications, and the `UNION ALL`-with-per-branch-predicates read-model precedent for apartment-scoped history. The real v2.4 work is **gating and correctness**, not construction: a deny matrix over every existing staff endpoint, per-request resident scope derivation, apartment predicates layered on tenant predicates, and an atomic compare-and-consume inside the canonical `VisitorArrivalHandler` transaction. The `notes/v2-4-codex-gap-review.md` findings F01–F18 are all closed into recorded decisions; what survives are *implementation traps* (see Pitfalls).

Risk concentrates in one place: **a new public-ish trust boundary.** The resident role opens every pre-existing staff endpoint that today uses bare `RequireAuthorization()` (F02), apartment scoping has no interceptor safety net like the tenant filter does (F03-residue/Pitfall 3), and "suspension denies the next request" does not fall out of JWT expiry — it needs a per-request DB status check because `OnTokenValidated` is not wired and tokens live 15 minutes (Pitfall 2). The lane (Phase 29) is the highest-risk phase, consuming seven gap-review closures at once (F01, F05, F08, F10, F11, F12, F16). Mitigation is structural, not aspirational: sequence the deny matrix and scope resolver *before* any resident-facing data surface exists (Phase 27 before 28), make the negative integration suite a per-phase CI gate that must grow with every new endpoint, and keep arrival, consumption, and notification in one canonical transaction.

The Brazilian product research confirms the chosen posture is a deliberate, defensible deviation from the segment norm: competitors make the resident the remote gatekeeper (push/videochamada) and let visitors self-check-in from their own phones; v2.4 keeps **staff as gatekeeper**, ships a **supervised, gatehouse-authenticated lane** (no anonymous API — the F01/P0 freeze), and delivers notifications as durable in-app rows + polling. Table stakes (pre-registration with validity window + `max_uses`, CPF-based matching, arrival notification, apartment-scoped history, one-time QR pass) are fully covered by the four phases in the existing roadmap; badges via `AccessCredential` and masked PII-by-default (RES-14) are correctness differentiators none of the segment reliably offers. Deferred items (visitor-phone check-in, remote release, biometrics, lista de banidos, resident cadastro autonomy) all have recorded triggers and must not leak into v2.4 scope.

## Key Findings

### Recommended Stack

Zero new dependencies is the headline. The only package touch in the entire milestone is an **optional hygiene bump** of BCrypt.Net-Next 4.0.3 → 4.2.0 (no known advisories on 4.0.3; cheap, not a blocker). Critical version notes:

- **@zxing/browser stays pinned at 0.1.5** (npm current is 0.2.1) — v0.x breaking-change risk across two live features for zero gain; defer to post-v2.4 hygiene.
- **.NET 8 LTS support ends 2026-11-10 — inside v2.4's window**, but the TFM must NOT change mid-milestone; log .NET 8→10 as a v2.5 platform decision alongside the Angular upgrade.
- **No `UseForwardedHeaders()` exists today** (grep-verified) — so IP-partitioned lane rate limiting would collapse the entire gatehouse LAN into one bucket. Partition on the normalized canonical document (bounded key per MS DoS guidance) instead; the one-time ForwardedHeaders/Traefik `KnownProxies` decision may be needed once, still zero packages.

**Core technologies (all existing):**
- `OpaqueTokenIssuer` (32-byte base64url, HMAC verifier, `FixedTimeEquals`) — pre-auth codes AND badge QRs; **no second token/QR subsystem** (F05/F12).
- Built-in `PartitionedRateLimiter` — new `"lane-checkin"` / `"resident-login"` policies in the existing `Program.cs` block; ProblemDetails + `Retry-After`.
- DBTools `SelectRawAsync` with explicit `UNION ALL` arms + per-branch `tenant_id = @p0` (shipped precedent in `ReportReadRepository.cs:264–433`) — Phase 30 apartment history adds `apartment_id = @pN` per branch; `TenantDayBoundary` covers tenant-local day semantics.
- Angular polling on the `DeviceHealthService` idiom — notifications are **polling, not SignalR/SSE** (F14 decision).
- Browser print reusing qr-pass-modal's CSS pattern — badges, no PDF pipeline, no printer hardware.

**What NOT to add (enforced):** SignalR/SSE, push/FCM/WhatsApp, Redis, MediatR, EF Core, anonymous visitor-phone API, server-side QR generation, jsPDF/headless-Chromium, background expiry sweeps (expired is derived at read time), new chart libs.

### Expected Features

All v2.4 requirements (RES-01…RES-14) map to table stakes confirmed across Porter, eCondos, Condfy, Acesso Inteligente, CONDO+, Lello, MaqPronAPP (BR residential) and Gallagher Kenai / Genetec ClearID (kiosk VMS):

**Must have (table stakes — all four phases, none droppable):**
- TenantAdmin-provisioned resident login (RES-01) with uniform constant-cost denials and next-request suspension (F06)
- Apartment-owned pre-reg CRUD with validity window + `max_uses` (default 1, per-tenant cap), expiry **derived at read time** (RES-04/05, F04)
- Purpose codes: immutable identity + historical label snapshot (RES-06, F18)
- Typed canonical document identity with CPF check-digit (RES-04 matching, F08)
- Supervised gatehouse-Authenticated self check-in lane (RES-07) — no anonymous route (F01/F11)
- In-app arrival notifications tied to the committed arrival identity (RES-10, F14)
- Apartment-scoped visit history from the same unified ledger (RES-03), masked documents (RES-14)

**Differentiators (correctness properties the segment lacks):**
- Pre-reg-bound arrival; same-document cross-apartment conflicts **never auto-resolve** (F03)
- Atomic consumption — exactly one arrival per permitted use, bounded idempotent replay (F10)
- Badge = verifier-only `AccessCredential` credential, reprint = new staff-authorized print (F12/F15)
- Deny matrix as a *provable* property — negative integration suite per phase (RES-13)
- Masked-by-default visitor PII on resident surfaces (LGPD defensible posture)

**Defer (with recorded triggers — do not let these into v2.4):** visitor-phone self check-in (needs delivery channel), remote real-time release (conflicts with staff-first posture; F11), facial biometric (constitutionally reserved), lista de banidos (**top v2.5+ candidate** — composes with refused-scan machinery), resident cadastro autonomy (after RES-13 proves out; F07 membership semantics), retention duration (owed legal/product review, already an open flag).

### Architecture Approach

**No new module.** v2.4 is a per-module extension of the existing five (Security, Residents, Visits, AccessControl, Reports) plus migrations `23-/0023+` (visitor_pre_registrations, purpose_codes, resident_notifications, resident profile binding, new Visit columns). Five load-bearing patterns, each riding an existing precedent:

1. **Server-side scope derivation** — never bake `ApartmentId` into the JWT; `IScopedResidentContext` resolves profile → apartment per request. This is the load-bearing new component of the milestone.
2. **Apartment predicate layered on tenant predication** — `ITenantAwareLinqFactory` splice stays mandatory; apartment predicates hand-written on top, with cross-apartment leak tests.
3. **Handler-mirroring, not handler-forking** — `LaneSelfCheckInHandler` does consent-gate/policy front-matter itself, then delegates the arrival mutation to `VisitorArrivalHandler`, exactly as `RecordAccessScanHandler` composes with it.
4. **Verifier-only secrets** — codes and badges; raw token shown once, reprint mints a new credential.
5. **Derived state, no background sweeps** — consumed/expired/expected-today computed at read time (v2.3 heartbeat doctrine), using a shared tenant-time-instant helper.

The single-surface invariant: `VisitorArrivalHandler` is the spine of Phases 28–30 — modified once (pre-reg identity binding + purpose snapshot + in-transaction notification emission), everything else composes with it. Extend the v2.3 arch-test grep (no direct Visit writes) to the lane/portal modules.

### Critical Pitfalls (top 5 of 15 + residues)

1. **`LoginHandler` requires an attendant profile** (`LoginHandler.cs:60-65`) — resident login must be a role-dispatched resolver branch inside the *existing* handler; never a fake `AttendantProfiles` row, never a second login endpoint. Decide `profile_id` semantics for resident JWTs and define mixed-role (TenantAdmin+Resident) precedence. **Phase 27.**
2. **Live-token suspension doesn't work via JWT expiry** — no `OnTokenValidated` callback; 15-min tokens. Implement per-request resident status/membership checks scoped to resident surfaces; integration test must be *issue token → suspend → same token → 403*. **Phase 27.**
3. **Apartment isolation has no mechanical safety net** — the tenant interceptor gives false confidence; reused tenant-wide directory queries (`FindLatestByDocumentAsync`) would leak 302's visitors to 101. Resident-surface arch test + two-apartment fixtures mandatory. **Phase 27 (created), reused 28/29/30.**
4. **Deny matrix vs. drift** — every existing staff endpoint (`VisitEndpoints.cs:15-17`, `ReportEndpoints`, etc.) currently admits resident JWTs. The negative suite is the enforcement mechanism, not a one-time artifact; every new endpoint declares its policy in the same commit. **Phase 27 + continuously 28–30.**
5. **Cross-apartment document selection in arrival** — `VisitorArrivalCommand` carries no pre-reg identity; the Pending-reuse branch would check the visitor in at the wrong apartment. Thread the authorization id through the command (signature change is the acceptance signal), ambiguity = staff disambiguation denial. **Phase 29** (binding), Phase 30 (panel uses the *distinct* staff-disambiguation query).
6. **Consent gate lives in `RecordAccessScanHandler`, not `VisitorArrivalHandler`** — a "direct" lane call skips the policy. Lane composes the full canonical pipeline with policy-parity tests; actor kind `Visitor@Lane`, never `Guid.Empty` or a real porteiro id at the lane. **Phase 29.**
7. **Atomicity of consume → Visit → notification** — DBTools repo methods are separate connections today; compare-and-consume must be one canonical transaction (or durable intent row), with concurrency (two lane calls, `max_uses=1` → exactly one admission) and lost-response replay tests. **Phase 29; Phase 30's staff one-click reuses the same contract.**
8. **Verifier-only vs. reprint** — never persist the raw badge token "for reprint convenience"; reprint = revoke + mint new staff-authorized credential. **Phase 29.**
9. **Derived-state in write predicates** — expiry math goes inside the consumption predicate (`uses_consumed < max_uses AND @now < window_end_instant`), computed from raw persisted inputs via one shared boundary helper with fake-clock tests; never persist a derived `Consumed`/`Expired` flag. **Phase 28 (schema/helper), 29 (predicate).**
10. **Non-sargable panel document matching** — `REPLACE()` in `SearchPendingByDocumentAsync` full-scans the Visits table on what becomes a per-arrival hot path; fix via canonical normalized-document column + `(tenant_id, normalized_document, status)` index. **Phase 28 (column/index), 30 (consumer).**

Plus cross-cutting: PII fingerprints-only in denial audits and log redaction extensions (Phase 28/29); lane rate-limit partitioning traps — forged headers / kiosk-IP collapse / no hard-lockout (Phase 29); mixed-role token journeys (Phase 27 decision); badge validity tied to visit state so a stale badge scans as refused.

## Implications for Roadmap

The existing ROADMAP structure for v2.4 (Phases 27–30) is **validated by research with one structural emphasis**: the order is correct and load-bearing — the deny matrix and scope resolver must precede any resident-visible data surface, and arrival-handler binding (28-04) must precede any consumer. Roadmapper should preserve the sequence and carry the intra-phase task ordering below as the expected plan skeleton.

### Phase 27: Resident Access Foundation
**Rationale:** Trust precondition, not a feature. Adding resident-portal read endpoints while staff APIs still admit resident JWTs widens exactly the hole F02 flags. Everything later is only safe because this phase's negative suite exists.
**Delivers:** `ResidentPortalProfile` + repo, role-dispatched login inside existing `LoginHandler` (no fake profiles), `IScopedResidentContext` per-request scope + suspension resolver, `residentGuard` + portal shell, **deny-matrix policy pass over every existing staff endpoint + negative integration suite**, mixed-role precedence decision.
**Addresses:** RES-01, RES-13 (table stakes), F06/F07.
**Avoids:** Pitfalls 1–4. Open issues that must *decide* here (not defer): `profile_id` semantics for resident tokens, mixed-role precedence.

### Phase 28: Visitor Pre-Registration & Purpose Codes
**Rationale:** Consumable authorizations must exist — and the schema must be right — before any consumer. This is the cheapest moment for LGPD/redaction hooks and the normalized-document index.
**Delivers:** `VisitorPreRegistration` aggregate + repo (tenant+apartment predicated), CRUD handlers with resident endpoints under `/api/v1/portal/*`, `PurposeCode` aggregate + TenantAdmin endpoints, canonical CPF typed identity + normalized indexed column, `VisitorArrivalHandler` signature change to carry pre-reg identity (+ purpose snapshot, informational plate snapshot), migrations `23-/0023+`, shared tenant-time-instant boundary helper with fake-clock tests.
**Addresses:** RES-04/05/06, F04/F08/F18; sets up F17.
**Avoids:** Pitfalls 9, 14, 15; re-applies apartment-isolation fixtures (Pitfall 3).

### Phase 29: Visitor Self Check-In (Supervised Lane + Badge)
**Rationale:** The highest-risk phase — F15 demands the visitor-facing page/route ships *here*, not later, and seven gap-review closures are consumed at once. Must not start before Phase 28's pre-reg contract is proven by tests.
**Delivers:** `LaneSelfCheckInHandler` (resolve code/document → validate window/uses with compare-and-consume → consent via existing evaluator → delegate to `VisitorArrivalHandler`, all one canonical transaction with bounded idempotent replay), `LaneEndpoints` (`/api/v1/lane/*`, gatehouse-auth, actor `Visitor@Lane`), badge via `IssueCredentialHandler` (zero new AccessControl code), rate-limit partitions on normalized document/token, lane page + badge browser-print + Playwright E2E of the full journey, staff recovery/next-day fallback (F16), policy-parity test suite.
**Addresses:** RES-07/08, F01/F05/F10/F11/F12/F15/F16.
**Avoids:** Pitfalls 5–8, 13.

### Phase 30: Resident Visibility, Notifications & Gatehouse Panel
**Rationale:** Read-only scoped history is safe to land first; notifications are cheap *only after* Phase 29's transactional arrival commits — emission lives inside `VisitorArrivalHandler`'s canonical transaction (no-op replays notify nothing); the panel consumes everything last.
**Delivers:** Apartment-scoped history via modified Reports UNION arms with forced apartment predicate (resident `apartmentId` param demoted to staff-only), `ResidentNotification` aggregate + endpoints + `ResidentNotificationService` singleton poller, gatehouse panel "pending today" pre-regs tab + document matching (staff-disambiguation query) + one-click check-in via the same arrival seam + badge print trigger, OpenAPI client regen in phase wrap.
**Addresses:** RES-03/09/10, RES-13 (suite grows), F03 (staff side), F13/F14.
**Avoids:** Pitfalls 10 (consumer), 15, 16; extends arch-test single-write-path coverage to notifications.

### Phase Ordering Rationale

- **Deny matrix before pre-reg CRUD:** Phases 28–30 add endpoints under time pressure and would default to bare `RequireAuthorization()`; Phase 27's suite is what makes every later door provably closed to resident tokens.
- **Arrival-handler binding last in Phase 28:** `VisitorArrivalHandler` is touched once, wired before any Phase 29/30 consumer depends on its transactional contract.
- **Lane before history/notifications:** notifications inherit Phase 29's transaction quality; history is the safest landing (read-only) but shares the scope resolver and index work with 28/29.
- **RES-14 masking/redaction is cross-cutting**, landing with each surface — never deferred to a final-phase batch.
- **No external dependencies:** the entire feature set rides existing machinery (unified arrival path v2.1, AccessCredential, password/SMTP v2.1, consent gates v2.0); v2.2/v2.3 phases have no overlap.

### Research Flags

Phases likely needing `/gsd-plan-phase --research-phase`:
- **Phase 27:** authorization design has three open decisions that must be settled in planning — resident profile/login dispatch shape, mixed-role precedence, per-request check placement (middleware vs `OnTokenValidated` vs endpoint policy); plus the deny-matrix endpoint inventory (enumeration task).
- **Phase 29:** highest complexity — transaction seam design for compare-and-consume within DBTools must be designed *before* endpoint code; rate-limit partitioning + ForwardedHeaders proxy-trust decision owed.
- **Phase 30:** UNION-arm extension pattern + ReadState semantics; openapi-regen-vs-handwritten decision.

Phases with standard patterns (light research only):
- **Phase 28:** mostly established CRUD/aggregate patterns; needs no external research, but the boundary-helper + schema constraints come with PITFALLS.md precision — planning should cite Pitfall 9/14/15 directly.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against NuGet/npm 2026-10-15; every "reuse" recommendation cross-checked against actual repo files (Directory.Packages.props, Program.cs, OpaqueTokenIssuer.cs, etc.) |
| Features | MEDIUM | Segment claims from competitor product pages + LGPD guidance (HIGH-MEDIUM); internal dependency/complexity claims HIGH from repo inspection + gap review |
| Architecture | HIGH | Every placement claim code-verified; recommendations explicitly flagged where they are proposals (e.g., `IScopedResidentContext` shape, login dispatch) |
| Pitfalls | HIGH | All 15 pitfalls verified against source with line citations; F01–F18 residues distinguished from settled decisions |

**Overall confidence:** HIGH — this is integration research over a well-understood codebase; the risk lives in execution discipline, not unknowns.

### Gaps to Address

- **Mixed-role tokens (TenantAdmin who is also a resident):** precedence + whether the resident portal renders for dual-role tokens — decide in Phase 27 planning with an explicit test.
- **F07 membership/move-out semantics:** does visit history follow the person or the unit across apartment reassignment? v2.4 pins "single apartment per portal identity" but occupancy-period queries are undefined; keep the history-read answer honest and note the residual.
- **PII retention duration:** no number in code — masking everywhere in v2.4; duration (pre-reg records, notifications, badge data, denial audits) is an owned product/legal review already flagged in PROJECT.md. Don't invent a value.
- **ForwardedHeaders / Traefik proxy-trust for lane IP dimensions:** one-time decision owed in Phase 29 planning; default is document/token-based partitioning (safe with no header trust).
- **OpenAPI client regen strategy for new endpoints:** pick regen-portal/handwrite-lane vs. full regen in Phase 27/30 planning; the `openapi-check` gate makes this non-optional before milestone close.
- **.NET 8 EOL (2026-11-10):** log the 8→10 TFM decision as a v2.5 platform task; do not act inside v2.4.

## Sources

### Primary (HIGH confidence)
- Codebase (read in full, 2026-10-15): `LoginHandler.cs`, `JwtTokenService.cs`, `TenantResolutionMiddleware.cs`, `VisitorArrivalHandler.cs`, `VisitDirectoryRepository.cs`, `RecordAccessScanHandler.cs`, `CredentialLifecycleHandlers.cs`, `OpaqueTokenIssuer.cs`, `Visit.cs`, `VisitEndpoints.cs`, `ReportEndpoints.cs`/`ReportReadRepository.cs`, `Program.cs`, `TenantDayBoundary.cs`, `app.routes.ts`/guards, `gatehouse-panel.page.ts`, `qr-pass-modal.component.ts`, `device-health.service.ts`, `Directory.Packages.props`, `package.json`, `docker/mysql/migrations/`
- `.planning/PROJECT.md` v2.4 goal + resolved gap-closure decisions; `.planning/ROADMAP.md` Phases 27–30; `.planning/notes/v2-4-codex-gap-review.md` (F01–F18, all closed into decisions); `.specs/qr-entrance-exit-access/` (verifier-only doctrine); v2.1 research files (carried lessons)
- NuGet/npm package listings — BCrypt.Net-Next 4.2.0, @zxing/browser 0.2.1 (pinned at 0.1.5), fetched 2026-10-15

### Secondary (MEDIUM confidence)
- BR residential competitor product pages: Porter, eCondos, Condfy, Acesso Inteligente, CONDO+, Lello, MaqPronAPP (2026-10-15)
- Enterprise kiosk VMS docs: Gallagher Kenai, Genetec ClearID, elia.io

### Tertiary (LOW confidence — validate if relevant)
- LGPD guidance corpus (AABIC 2021, Lello cartilha 2021, Serpro 2020) — positions cited are consistent; retention-duration specifics remain an open legal review

---
*Research completed: 2026-10-15*
*Ready for roadmap: yes*