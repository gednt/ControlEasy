# Pitfalls Research

**Domain:** Adding resident-portal authentication, self-service check-in, pre-registration lifecycles, and notification systems to an existing multi-tenant condominium access-control platform (ControlEasy Reborn v2.4 — Phases 27–30)
**Researched:** 2026-10-15
**Confidence:** HIGH (nearly all findings verified against actual source in this repo; every line/citation below was read at the current tree)

**Method note — relationship to prior work:**
- The Codex adversarial scope review (`.planning/notes/v2-4-codex-gap-review.md`, findings F01–F18) was already **closed into explicit decisions** recorded in PROJECT.md (2026-10-15). This file does **not** re-report those as open problems. Where a decision was made but the *implementation trap persists*, the pitfall is listed with its residual nature flagged (F0x residue).
- v2.1 milestone research (the previous version of this file) carried forward lessons that still apply and are **retained in the Pitfall-to-Phase Mapping** as carried rows rather than restated in full.
- Every code claim below was read from source at the current tree: `LoginHandler.cs`, `TenantResolutionMiddleware.cs`, `JwtTokenService.cs`, `VisitorArrivalHandler.cs`, `VisitDirectoryRepository.cs`, `RecordAccessScanHandler.cs`, `Resident.cs`, `OpaqueTokenIssuer.cs`, `VisitEndpoints.cs`, `ReportEndpoints.cs`, and `Program.cs` rate-limiter wiring.

---

## Critical Pitfalls

### Pitfall 1: Resident login collides with the attendant-profile requirement baked into `LoginHandler`

**What goes wrong:**
`LoginHandler.cs:60-65` resolves login through `AttendantProfileLoginSupport.ResolveActiveProfileAsync` and throws `"No active attendant profile found for user."` when none exists. Every staff login today *must* map to an AttendantProfile or TenantAdmin profile. When the first resident account is provisioned in Phase 27, the executor faces two tempting dead-ends: (a) **hack a fake attendant profile row for residents** — which then feeds `profileId` into the JWT (`JwtTokenService.cs:39-40`), `TenantContext.ProfileId`, and downstream into `Visit.CheckIn(attendantProfileId)` and audit rows, so a resident becomes a recorded "attendant" anywhere their token touches; or (b) fork a parallel login endpoint that skips BCrypt/refresh-token machinery — losing the enumeration-safe, uniform-deny, revocable properties already built (v2.1 Pitfalls 7/15).

**Why it happens:**
The login handler was written when every portal user was staff. The profile concept doubles as "authority source for tenant_id, roles, permissions" — residents have no such profile, so the natural seam appears missing.

**How to avoid:**
- Extend `AttendantProfileLoginSupport` with an explicit role-dispatched resolution path: staff → existing profile resolution; Resident → resolve the resident record (identity + apartment membership + portal-credential state) as the authorization source. One handler, two resolver branches — never a second login endpoint and never fake profile rows.
- Decide and pin the **meaning of `profile_id` (and `TenantContext.ProfileId`) for resident JWTs** in Phase 27: likely `null`/a new resident-profile claim. Every handler that treats `ProfileId` as "the actor" (Visit.CheckIn, audit writers) must be reviewed for actor-kind correctness — this is the "no fake porteiro" decision (`actor kind Visitor@Lane`) applied to tokens, not just the lane.
- Reuse the existing machinery verbatim: same validator, same `IPasswordHasher.Verify` (cost ≥ 11), same refresh-token issuance/revocation. The v2.1 uniform-envelope/constant-cost lessons apply to resident login unchanged.
- **Mixed-role (open flag):** a TenantAdmin who is also a resident will resolve through *both* branches. Define precedence and token semantics in Phase 27 (see Pitfall 11) — do not let the resident branch silently win/lose based on row order.

**Warning signs:**
- A resident provisioning migration/seed creating rows in `AttendantProfiles`.
- A second `LoginHandler`/endpoint named `ResidentLogin*` appears instead of a dispatch inside the existing one.
- `TenantContext.ProfileId` non-null for resident tokens without an explicit documented meaning.

**Phase to address:** Phase 27 (the login dispatch change is the phase's first backend task, not an afterthought).

---

### Pitfall 2: "Suspended next request is denied" fails silently on live access tokens — there is no token-time DB callback

**What goes wrong:**
"Next-request revocation" is a stated requirement (RES-01), but the runtime does not currently support it end-to-end: `Program.cs` wires `AddJwtBearer` at line 82 with **no `OnTokenValidated` callback** (verified — no match in the file), and access tokens live 15 minutes (`JwtTokenService.cs:30`). Two failure shapes:
1. Executor *assumes* JWT expiry = revocation, so suspension takes up to 15 minutes to bite — the success criterion "after revocation the resident's next request is denied" fails whenever the token is still live.
2. Executor "fixes" it by stamping the apartment/membership into the JWT so endpoints can trust claims — but membership changes (move-out, suspension, reassignment, `Resident.UpdateDetails` freely rewrites `ApartmentId`, Resident.cs:38-46) then silently **do not reach live tokens**, and the stale-claim isolation hole is exactly the "resident of 101 reading 302" scenario.

**Why it happens:**
The staff surface never needed request-time revalidation — revocation for staff flows through refresh-token revoke-all + admin resets, and a 15-minute staff token window was an accepted blast radius. Residents are lower-trust and higher-churn (household changes), so the accepted staff tradeoff is not safe here.

**How to avoid:**
- Enforce suspension **at request time inside the resident authorization path**: resident endpoints resolve the resident record server-side per request (status + active + apartment membership) before any data access. This is the already-decided "per-request suspended-status checks" — implement it as middleware/endpoint-policy, not as a check sprinkled per handler.
- **Do not persist apartment membership in the JWT.** `JwtTokenService` currently carries no apartment claim — keep it that way. Any "optimization" that adds `apartment_id` to the token creates a stale-membership vulnerability; derive the apartment from the resident record on every request, with a short, named cache TTL if the DB hit matters, and tests proving a membership change lands within the cache window.
- Integration test must exercise the exact sequencing: issue token → suspend → call with the *same* token → assert 403 — not "suspend → re-login → assert."

**Warning signs:**
- A diff adding an apartment claim to `GenerateAccessToken`.
- Suspension test logs out before re-testing (masks the live-token case).
- `OnTokenValidated` added but hitting the DB on *every* request globally (perf regression on staff endpoints) instead of scoping to resident surfaces.

**Phase to address:** Phase 27 (resident authorization policy design + integration test with the token-already-issued sequence).

---

### Pitfall 3: Apartment scoping is a NEW isolation dimension with no interceptor safety net — tenant-filter protection gives false confidence

**What goes wrong:**
`TenantFilterInterceptor` guarantees tenant isolation mechanically for generated queries. **Nothing** guarantees apartment isolation: every resident-reachable query must hand-write the apartment predicate. The subtle failure: an executor builds a resident endpoint, sees it "work" (tenant filter active, ProblemDetails, tenant-aware factory used per Phase 27 criterion 4), and ships — while the query selects tenant-wide rows (e.g., reusing `VisitDirectoryRepository.SearchPendingByDocumentAsync` / `FindLatestByDocumentAsync`, which are tenant-wide by design) and lists apartment 302's visitors to a resident of 101. A cross-apartment leak *inside* the tenant violates RES-03 but passes every existing tenant-isolation test.

**Why it happens:**
The repo's strongest habit — "always use `ITenantAwareLinqFactory`" — reads as if it were the isolation story. Apartment predicates are a second, smaller, and nowhere-mechanized rule.

**How to avoid:**
- Extend the architecture-test pattern (`AccessControlTenantRulesTests` enumerates owner tables) with a **resident-surface rules test**: every repository consumed by a resident endpoint must require an apartment predicate, and every resident endpoint must derive the apartment id server-side from the resident record — never from a payload/query param (`ReportEndpoints` already accepts a caller-supplied `apartmentId`; that pattern must not spread).
- New resident-scoped repositories should filter on the resident-record-derived apartment explicitly in the WHERE clause; treat any repository reuse that lacks an apartment parameter as a review blocker.
- The cross-lease/move-out semantics (open flag F07 residue): decide whether visits/pre-regs history follows the *person* or the *unit* across reassignment, and encode that in membership queries — `Resident.ApartmentId` alone cannot express occupancy periods.

**Warning signs:**
- A resident endpoint whose handler never mentions the apartment id.
- Green tests that only ever exercise one apartment per tenant fixture.
- An Angular service passing `apartmentId` as a parameter for resident endpoints.

**Phase to address:** Phase 27 (arch test + fixture pattern created here and reused by Phases 28/29/30); Phase 30 re-applies it to history reads.

---

### Pitfall 4: The deny matrix is a decision, but every *existing* staff endpoint is an open implementation surface (F02 residue)

**What goes wrong:**
RES-13's deny matrix is agreed — but the endpoints it must cover are the *pre-existing* ones: `VisitEndpoints.cs:15-17` (`RequireAuthorization()` only, no role policy), `ReportEndpoints` (authenticated + caller-supplied apartment filtering), apartment/resident/vehicle management endpoints, and `/gatehouse` panel routes guarded only by the anonymous-shell-level Angular guard (`app.routes.ts`). A resident JWT *satisfies all of them today*. The trap is sequencing: Phases 28–30 add new endpoints under time pressure and default to `RequireAuthorization()` (copy-nearest-example), while the matrix hardening from Phase 27 drifts out of sync — each new endpoint silently becomes another resident-admissible door.

**Why it happens:**
Role policies via `.AddPolicy(...)` exist in Program.cs (Permission_/PlatformAdmin policies) but most modules never opted in; the codebase precedent for "authenticated-only, authorization derived later" dominates.

**How to avoid:**
- Phase 27 delivers the deny matrix as **both** an endpoint policy inventory (every staff endpoint names its role policy) **and** the negative integration suite proving resident tokens get 403 — run that suite on every phase's CI, and extend it with every new endpoint added in 28–30 (the suite is the matrix's enforcement mechanism, not a one-time artifact).
- New lane/panel endpoints (Phases 29/30) declare their policy *in the same commit* as the endpoint; a policy TODO in an endpoint file should fail the arch test.
- Angular: resident-only pages get route-level role guards (not menu hiding); navigation to `/gatehouse` with a resident-only token must be blocked at route level since the API will 403.

**Warning signs:**
- A new endpoint group with plain `RequireAuthorization()` and no policy name.
- The negative suite not growing when endpoints grow (diff stat check: +N endpoints, +0 negative cases).
- A page reachable by a resident token where all its calls 403 — broken UX that menu-hiding masked.

**Phase to address:** Phase 27 (matrix + suite), continuously enforced in 28–30.

---

### Pitfall 5: Cross-apartment selection via the document index — `FindLatestByDocumentAsync` has no pre-registration discriminator (F03 residue)

**What goes wrong:**
The gatehouse-matching and lane flows will consume `VisitorArrivalHandler`, which resolves its target by document only: `VisitorArrivalHandler.cs:54-65` calls `FindLatestByDocumentAsync` and branches; `VisitDirectoryRepository.cs:38-54` picks **latest `CreatedAtUtc`** with tenant + document predicates but no apartment/authorization discriminator. The Codex scenario (pre-reg for 101, same document pending/checked-in at 302) would silently select 302's visit: the Pending branch checks it in at 302 and the CheckedIn branch no-ops while consuming 101's authorization — wrong household admitted/notified, right visitor stranded. The *decision* is settled (pre-reg-bound arrival; porteiro disambiguates conflicts), but nothing in the current handler/repository signature enforces it.

**Why it happens:**
`VisitorArrivalCommand` carries no pre-registration identity and no command-purpose application to the Pending-reuse branch (`Arrival:60-64` ignores `command.Purpose`) — the existing single-write-path contract predates pre-registrations and looks compatible from the call site.

**How to avoid:**
- Thread the pre-registration/authorization id (and the resulting **explicit** VisitId→pre-reg link) through the command; the arrival branch must select by **authorization id first**, document only as a cross-check. If the handler's signature does not change, the criterion is missed — treat unchanged signature as a red flag.
- Ambiguity is a *denial to be resolved by staff*, never an auto-selection: a same-document/different-apartment Pending or CheckedIn match → return a disambiguation-needed outcome containing **no other apartment's identity data** (masked minimal info for the porteiro only).
- Gatehouse panel Phase 30 uses `SearchPendingByDocumentAsync` for CPF matching — it *should* surface cross-apartment pendings to the porteiro (their job); the lane/portal must not consume that query. Name the two query surfaces distinctly so a future executor cannot reuse the panel query behind the lane.

**Warning signs:**
- `VisitorArrivalCommand` unchanged; lane endpoint constructing it from raw document + apartment.
- Arrival result not carrying the consumed pre-reg id.
- Any test fixture with two apartments and the same document returning data cross-apartment.

**Phase to address:** Phase 29 (arrival binding), Phase 30 (panel matching uses the staff-disambiguation query).

---

### Pitfall 6: The consent gate lives in `RecordAccessScanHandler`, not in `VisitorArrivalHandler` — direct lane invocation bypasses the policy

**What goes wrong:**
Consent-policy evaluation (`_policy.EvaluateAsync`, `RecordAccessScanHandler.cs:156-187`) runs on the scanner path *before* arrival is registered. `VisitorArrivalHandler.HandleAsync` itself has no consent check and writes `CheckedIn` directly (Arrival:52-84). A Phase 29 lane endpoint that calls `IVisitDirectory.RegisterArrivalAsync` (or the handler) directly — the shortest distance to "same unified write path" — skips consent/policy checks entirely: consent-required visitors get admitted, residents get notifications, and occupancy/history records admission that never happened. Also note the existing `Guid.Empty` attendant substitution on the Pending branch (`Arrival:62`) and how decision "actor kind `Visitor@Lane`" must propagate — a bare call also mis-attributes the actor.

**Why it happens:**
"Rides the unified write path" is read as "calls `VisitorArrivalHandler`" — but the *full* canonical path is GatehouseValidator → idempotency → credential/policy → arrival → event+audit. The handler is a segment of the path, not the path.

**How to avoid:**
- The lane invokes the **same command pipeline the scan path uses** (or an explicit composition that performs the policy evaluation with the same evaluator and the same outcomes: Permit/RequiresAction/Refused handling), so decision "consent policy runs unchanged through the lane" is implemented by construction, not by convention.
- Record actor as `Visitor@Lane` (typed actor kind, not a fake `AttendantProfileId`), and separately record the trusted location (gatehouse lane) — audit attribution stays truthful.
- An integration test that proves a consent-refused visitor cannot arrive via the lane, symmetrical to the existing scan-path refusals.

**Warning signs:**
- `RecordAccessScanHandler` is not on (nor composed by) the lane's call graph.
- A lane arrival for a consent-refused visitor succeeded in tests.
- `AttendantProfileId = Guid.Empty` in lane-created Visits.

**Phase to address:** Phase 29 (the lane endpoint's composition), verified by policy-parity tests against both paths in the same suite.

---

### Pitfall 7: Compare-and-consume must be atomic *within DBTools's seams* — concurrent lane/staff/kiosk consumption double-admits or strands

**What goes wrong:**
Self lane, gatehouse panel staff "one click" (Phase 30), and a simultaneous kiosk attempt can all target the same pre-registration. The consumption write (max-uses decrement), the Visit mutation (`VisitorArrivalHandler.UpdateAsync`/`AddAsync`), and the future notification insert each go through separate repository calls (`_visits.UpdateAsync`, `_visits.AddAsync`) with **no shared transaction** in the current code — DBTools repository methods issue their own commands per v2.1's verified non-atomicity. Failure shapes: consume-succeeds-then-Visit-fails (valid visitor stranded, uses burned); two concurrent consumers both pass a read-then-write check (double admission); lost HTTP response turns a retry into an "exhausted" denial after the check-in committed; notification insert as a separate post-commit write disappears on crash (resident never notified but visitor arrived).

**Why it happens:**
The v2.1 pitfall 5 (idempotency keyed on one store ≠ end-to-end idempotency) was fixed for the *scan* path (replay re-reads `VisitId` off the persisted AccessEvent — RecordAccessScanHandler.cs:99-119), but the lane has no ScanAttemptId of its own, so the natural implementation reverts to read-check-then-write on a new table.

**How to avoid:**
- Use the **compare-and-consume** SQL pattern established in v2.1 research: `UPDATE ... SET uses_consumed = uses_consumed + 1 WHERE id = @p AND status = pending AND uses_consumed < max_uses AND window open` inside one transaction; `0 rows affected` = expired/exhausted/revoked (uniform denial). The affected-rows count is the lock — never a prior SELECT.
- Include the Visit create/advance and the notification-insert (or its durable intent row) **in the same canonical transaction** — DBTools transaction/unit-of-work seam must be established for the lane path in design, before endpoint code. If a single transaction is truly impossible across seams, use a durable intent/outbox row within the transaction to drive the post-commit delivery with bounded replay.
- Bounded idempotent replay for a lost response: define the idempotency key for the lane request (e.g., pre-reg id + presented identity or a per-attempt id from the caller) and make replay return the same committed outcome — mirroring the `RecordAccessScanHandler` replay shape.
- Concurrency tests: two parallel lane calls with `max_uses = 1` produce exactly one admission; cancel-during-check-in resolves to at-most-one.

**Warning signs:**
- A lane handler calling three repositories sequentially with no transaction token/ambient transaction.
- Replay path returns "exhausted" after a committed check-in (test the lost-response case explicitly).
- Notification rows duplicated for one arrival.

**Phase to address:** Phase 29 (consumption tx + replay contract), Phase 30 extends with the staff "one click" through the same contract — not a second one.

---

### Pitfall 8: Verifier-only token doctrine vs the reprint feature — persisting the raw QR payload is the tempting but forbidden shortcut (F12 residue)

**What goes wrong:**
`OpaqueTokenIssuer.Issue` returns the raw token **once**; storage holds only the HMAC verifier (`OpaqueTokenIssuer.cs:21`, verify via `FixedTimeEquals`). A badge QR is an `AccessCredential` of this shape. When the porteiro needs to *reprint* (paper jam, lost badge), the credential's raw payload is gone. The trap: store the raw token in a column "just for reprint" — which violates the verifier-only doctrine, the `access-api.md` prohibition on later raw-token disclosure, and `.specs/qr-entrance-exit-access/data-model.md` (no persisted plaintext QR).

**Why it happens:**
Reprint *looks* like a display feature. Credential issue code returns the plaintext exactly once and code paths around it (CredentialLifecycleHandlers rejecting an existing active credential) were built for cards/QRs where one active credential per subject is the norm.

**How to avoid:**
- Follow the recorded decision: reprint = **new staff-authorized credential** replacing the old (revoke + issue new, same AccessCredential subsystem, VisitId binding preserved). The reprint button mints, never retrieves.
- Badge validity must be **consistent with the pre-reg window/visit state**: expire the credential at checkout/consumed window end, and prove a fresh entrance scan with a stale badge is refused (`RecordAccessScanHandler` credential-inactive + window checks already do this for `AccessCredential` — reuse them, don't bypass).
- Test matrix: badge scanned after checkout; lost badge replaced while old is revoked; reprint race (two reprints within seconds).

**Warning signs:**
- Any column named `raw_token`/`qr_payload` on credentials/badges beyond the verifier store.
- Badge generation code calling a "get raw credential" repository method.

**Phase to address:** Phase 29 (badge lifecycle at check-in), Phase 30 (staff print trigger uses replace-on-reprint).

---

### Pitfall 9: `max_uses`/window state mixes derived flags into write predicates — "expired" is read-derived but consumption is a write (F04 residue)

**What goes wrong:**
Decisions: `max_uses` (default 1, per-tenant cap) inside the validity window; "expired" **derived at read time**, no background sweep. The trap: implementing consumption as `UPDATE ... WHERE status = 'pending'` — where `status` was *derived* in application code from window/uses at read time — re-materializes a flag that nobody persists, producing predicates that don't match reality in SQL (derived state lives only in C#). Combined with date-only windows (start/end *dates*), the expiry boundary decision (end-of-day inclusive? tenant-local midnight?) leaks into whether a same-day lane arrival at 22:00 is admitted. Boundary bugs here surface as: visitors refused at 23:59, admitted 00:01 of a "closed" day, or `max_uses` enforcement that can be raced (see Pitfall 7).

**Why it happens:**
"Derived at read time" and "consumed = uses exhausted or window closed" are easy to satisfy in the *read path* and easy to forget in the *write path's WHERE clause*.

**How to avoid:**
- Persist **raw inputs only**: `max_uses`, `uses_consumed`, `window_start`, `window_end`. Never persist a derived `Consumed`/`Expired` flag; never filter updates on derived state. Expiry math belongs in the parameterized predicate (`uses_consumed < max_uses AND @now < window_end_instant`) computed once in a shared boundary helper.
- Define the boundary contract once: exclusive end instant converted from the tenant-local date, validated against a fake-clock test set (tenant midnight, window start/end, the multi-day overlap case) — mirroring `AccessCredential.IsUsableAt`'s exclusive-expiration precedent (`Credential:123-128`), which is the in-repo convention for validity instant math.
- Cap and validate `max_uses` against the per-tenant admin setting at creation, and give the schema an explicit constraint so a stray `max_uses = 0`/null row cannot make a pre-reg permanently unconsumable.

**Warning signs:**
- A `Status` column with a `Consumed` value alongside `uses_consumed` counters (double bookkeeping).
- Two different end-of-day computations in the codebase (one for panel "expected today", one for window expiry).
- A date-parsed window end used as `< end_of_day` in one query and `<= end_of_day` in another.

**Phase to address:** Phase 28 (schema + shared boundary helper), Phase 29 (consumption predicate).

---

## Moderate Pitfalls

### Pitfall 10: Tenant clock granularity — Phase 19's tenant-day basis is not enough for validity windows (open flag)

The Phase 19 tenant-day boundary exists for reporting. Validity windows and "expected today" (Phase 30 panel) need **instant-level** math: the v2.1 audit documented this exact failure class (tenant-day vs UTC). Reuse/refine the tenant-day helper into a tenant *time-instant* helper (UTC in, tenant-local rules out, explicit exclusivity). Add fake-clock integration tests at: tenant-local midnight, window edges, an arrival exactly at boundary. Do not let "expected today" be computed in the Angular layer with the browser clock. **Phase: 28 (helper + tests), 30 (panel consumes helper).**

### Pitfall 11: Mixed-role user journeys (TenantAdmin who is also a resident) — undefined precedence (open flag)

`user.Roles` is a comma-string flattened into role claims (`JwtTokenService.cs:43-47`, `LoginHandler.cs:67`). A dual-role token will satisfy *both* the staff policies *and* resident endpoints — the deny matrix needs an explicit precedence rule (and a deliberate decision on whether dual-role is permitted at all). Also: password flows straddle (TenantAdmin reset UI is still PASS-03-partial); suspension of the *resident* side must not deactivate the *staff* side's `User.Active`. Decide in Phase 27's authorization design: role precedence policy, a mixed-role integration test, and whether the resident portal UI renders for a mixed-role token. **Phase: 27 (decision + test), 30 (mixed-role visibility in notifications/history).**

### Pitfall 12: PII retention/erasure for new surfaces (LGPD open flag) — denial audits will otherwise capture attempted CPFs indefinitely

The lane's denied attempts (unknown code, forged pre-auth codes, exhausted brute-force) create `RefusedScanAttempts` and audit rows where the natural impulse is to store the attempted document verbatim. Existing precedent: `RefusedScanAttempt.Record` carries `credentialFingerprint: null` — refused scans deliberately avoid persisting raw material. Extend that precedent: denial paths store **fingerprints/flags, never attempted full documents**; pre-reg records, notifications, and badge data carry names/documents/plates that need a retention decision (open flag: duration owed a product/legal review — do not invent a number in code; at minimum, mask on the resident portal per RES-14 and keep the redaction arch test covering all new handlers). Schema design in Phase 28 is the cheapest moment to add masking/retention hooks; retrofitting redaction is far costlier. **Phase: 28 (schema + redaction arch test extension), 29 (denial path no-document rule), pending open flag on duration.**

### Pitfall 13: Rate-limiter partitioning traps for the lane — header-trust and kiosk-IP collapse

The existing limiter (Program.cs:186-207) partitions `forgot-password` on an **email header if present, else RemoteIpAddress** — trusting an unauthenticated header is a partition-rotation bypass (attacker varies the header; fresh budget each request). The lane will need partitioning on the normalized document / presented pre-auth token (settled decision). Two traps: (a) per-source limits using `RemoteIpAddress` behind the Traefik proxy without `UseForwardedHeaders` collapse *all* lane visitors into one proxy-IP bucket — or bypass when headers are honored but untrusted; (b) an abusive visitor at the kiosk hard-locks the shared lane budget for everyone (DoS on arrivals — never hard-lock a pre-registration on flood; throttle per-token, not per-lane, and prefer bounded backoff over permanent lockout per F05's resolution). **Phase: 29.**

### Pitfall 14: Document canonicalization gaps — `VisitorDocument` validates only blankness/length (F08 residue)

`VisitorDocument.cs` retains raw input; `VisitDirectoryRepository` strips only `.` and `-`. Type CPF (check-digit + repeated-digit validation) with a canonical stored representation added as an **indexed normalized column** — also fixing the perf trap below. Ambiguity policy is settled (porteiro disambiguates); the implementation pitfall is treating all documents with a one normalization function. Foreign documents (passports) — decide supported types now in Phase 28 and reject others explicitly with ProblemDetails, rather than "best-effort normalize everything." **Phase: 28.**

### Pitfall 15: Panel document-matching query is non-sargable — `REPLACE()` on the column full-scans the Visits table

`SearchPendingByDocumentAsync` matches with `(VisitorDocument = @p OR REPLACE(REPLACE(VisitorDocument,'.',''),'-','') = @p)` — the REPLACE arm defeats every index, so each porteiro match (expected as a per-arrival hot path in Phase 30) scans the tenant's entire Visits table. Pitfall 14's canonical-column fix is also this fix: match on `(tenant_id, normalized_document, status)` with a composite index. Same for any new pre-reg matching query — pre-registrations get their own normalized-document index. **Phase: 28 (column + index design), 30 (panel matching consumes it).**

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Fake AttendantProfile row for resident login | LoginHandler unchanged | Residents become recorded "attendants" in Visit/audit rows; profile concept polluted platform-wide | Never — dispatch inside the resolver (Pitfall 1) |
| Apartment id in the JWT for cheap scoping | No per-request membership read | Stale membership on live tokens = cross-apartment hole | Never — derive server-side per request (Pitfall 2) |
| Plain `RequireAuthorization()` on new endpoints "for now" | Endpoints up quickly | Resident tokens admitted; matrix drifts one door per endpoint | Never — policy declared in same commit (Pitfall 4) |
| Reusing tenant-wide directory queries for resident/portal reads | Zero new repositories | Cross-apartment leaks | Never (Pitfall 3) |
| Storing raw QR/badge token for reprint | Reprint works via display | Violates verifier-only doctrine; plaintext credential in DB | Never — replace-on-reprint (Pitfall 8) |
| Separate connections for consume/Visit/notification | No transactional seam needed in DBTools | Half-admissions, duplicate lost notifications | Never — canonical tx or durable intent row (Pitfall 7) |
| Handwriting new Angular services while regen debt accrues | Matches Devices-module pattern (v2.3 audit TODO) | `openapi-check` drift compounds past 20 endpoints | Acceptable per-phase if regen scheduled in Phase 30 wrap; not past milestone close |
| Browser-clock "expected today" on the portal | No backend round-trip | Resident/porteiro disagree about pending lists near midnight | Never — server-computed windows (Pitfall 10) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| DBTools transaction seams (consume→Visit→notification) | Sequential repo calls each on their own connection | Single canonical transaction (or durable intent row) for consumption + Visit mutation + notification insert; bounded idempotent replay for lost responses |
| `TenantFilterInterceptor` | Assuming it also scopes apartments, or splicing into new UNION/cross-module shapes | Tenant from interceptor/factory; apartment predicates hand-written per query; explicit leak tests for the resident surfaces |
| `RecordAccessScanHandler` / scan pipeline | Lane bypassing the pipeline and calling `VisitorArrivalHandler` directly | Compose the lane through the same policy/idempotency gates; policy-parity integration tests against both paths |
| ASP.NET rate limiter (Program.cs:186) | Header-trusted partition keys; proxy-IP bucket collapse for the kiosk | Trust only configured proxy hops; partition lane limits on token/normalized document + bounded backoff, never hard lock |
| Serilog/Seq redaction | Logging visitor PII (attempted documents, pre-reg contents) in denial handlers | Extend the AccessControl redaction arch test to all new resident/visitor handlers; log ids/outcomes only |
| Badge printer (browser print) | Assuming the lane's own browser prints to the gatehouse printer | Decide route ownership: lane prints its own session's badge; staff print trigger lives in Phase 30 — one journey, one route |
| Demo seed / mode | Demo tenant without resident accounts/pre-regs; lane flows unusable; `DisableOutboundEmail` analogies untested | Seed resident users + pre-regs in 11-demo-seed path; synthetic fixtures only (AGENTS.POLICY.md) |
| OpenAPI client regen | Phases 27–30 endpoints handwritten without regen | Schedule regen in Phase 30 wrap; extend `openapi-check` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Non-sargable REPLACE document matching (panel hot path) | Each porteiro match scans tenant's Visits; rising latency through the day | Canonical normalized-document column + index (tenant, normalized_doc, status) | Immediately at real volume — thousands of visits/tenant |
| Resident history reads without `(tenant_id, apartment_id, created)` composite index | Resident portal history slow as apartment history grows | Add composite index in the Phase 28/30 schema work | Months of traffic per apartment |
| Per-request resident record lookup with no cached TTL | Every portal token request adds a DB read | Short named cache TTL + membership-change invalidation test | 10k+ resident requests/day (early but gradual) |
| Notification polling per open tab instead of per-session singleton | N× poll cycles per resident (tabs open) | Singleton service pattern (v2.3 `DeviceHealthService` precedent) | Every resident with 2+ tabs |
| Denied-attempt audit volume unbounded | Audit tables bloat from brute-force attempts at the lane | Bounded attempt audit + rate limiting on document/token; fingerprint-only refusal data | First persistent attack |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting a client-supplied tenant/apartment id in lane requests | Cross-tenant admission from a public-ish surface | Tenant bootstrap only via validated token/QR; integration test with token from another tenant before any lookup (deny-matrix suite) |
| Distinguishing denial reasons (unknown vs expired vs revoked) in lane responses | Valid pre-reg enumeration + forged probing | Uniform denial envelope + constant-cost path; distinction exists only in audit logs, never in the response |
| Document lookup as authorization (pre-reg matched by CPF alone without token/binding) | Any known neighbor CPF unlocks another household's visit data | Pre-reg-bound arrival (Pitfall 5); document-only matching is staff-disambiguation only |
| Fake staff attribution (`AttendantProfileId = Guid.Empty` or staffer identity on self-service flow) | Audit trail useless in disputes; consent records blame wrong actor | Typed actor kind `Visitor@Lane` + trusted location; reject Guid.Empty on the lane path |
| Live-token gap on suspension (up to 15 min) | Suspended resident keeps reading apartment data | Per-request status checks; same-token-then-suspend test (Pitfall 2) |
| Raw visitor PII in denial audits/logs | LGPD exposure + storage-abuse path | Fingerprint-only refusal data; redaction arch test extension (Pitfall 12) |
| Badge QR that outlives checkout | Stale badge scans as fresh arrival | Credential validity tied to visit/checkout; post-checkout scan test |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Resident portal shows full neighbor documents/pre-reg names (own apartment is fine; others leak via UI bugs) | Cross-household PII exposure | Masked display per RES-14; masked server responses, not client-side masking |
| Uniform denial copy at the lane that reads "system error" | Visitors panic, retry storm hits rate limits | Uniform but human-meaningful copy ("present document to the porteiro") without revealing *why* |
| Badge paper/print fails at the lane, flow has no fallback | Visitor arrives, lane consumed the pre-reg, no badge → dispute | Staff recovery path: porteiro can reprint (new staff-authorized credential) without re-consuming uses |
| Notification badge counts as "arrival happened" proof | Resident waits for visitor whose arrival was a no-op replay or never committed | Notification tied to committed VisitId (Pitfall 15's twin); read-state per user vs per unit decided |
| Mixed-role user loses track of which portal they're in | TenantAdmin-resident edits their own household as admin accidentally | Explicit context indicator in the UI when roles overlap |

## "Looks Done But Isn't" Checklist

- [ ] **Resident login:** Often missing the profile-dispatch change — verify a resident account with *no* AttendantProfile logs in (Pitfall 1).
- [ ] **Suspension:** Often missing the live-token test — verify suspend → *same token* → 403 within the claim window (Pitfall 2).
- [ ] **Apartment isolation:** Often missing two-apartment fixtures per test class — verify a one-apartment fixture can hide 101→302 leaks (Pitfall 3).
- [ ] **Deny matrix:** Often missing *negative* cases against pre-existing endpoints — verify resident JWT → 403 on EVERY staff endpoint, enumerated (Pitfall 4).
- [ ] **Pre-reg-bound arrival:** Often missing the same-document/different-apartment fixture — verify neither Pending-reuse nor CheckedIn no-op selects the other unit; handler signature actually changed (Pitfall 5).
- [ ] **Consent parity:** Often missing the policy-parity test — verify consent-refused visitor cannot arrive via the lane (Pitfall 6).
- [ ] **Atomic consumption:** Often missing the concurrency test — verify two simultaneous lane calls with max_uses=1 admit exactly one (Pitfall 7).
- [ ] **Lost-response replay:** Often missing failure injection — verify retry after committed check-in returns the committed outcome, not "exhausted" (Pitfall 7).
- [ ] **Verifier-only reprint:** Often missing the anti-persistence check — verify no raw token column exists; reprint mints a new staff-authorized credential with old revoked (Pitfall 8).
- [ ] **Window boundaries:** Often missing fake-clock boundary tests — verify tenant-local midnight and end-of-window instants behave per the exclusive-end contract (Pitfall 9/10).
- [ ] **Denial redaction:** Often missing the log scan — verify no attempted/pre-registered document appears in Seq/console during denial flows (Pitfall 12).
- [ ] **Notification fidelity:** Often missing the no-op-replay dedupe — verify a replayed arrival does not re-notify; notifications carry the committed visit identity (Pitfall 15 / notification design).
- [ ] **Lane route/session:** Often missing kiosk session cleanup — verify the lane route resets between visitors and cannot be reached by portal tokens.
- [ ] **Mixed-role:** Often missing the dual-role precedence test — verify the deny matrix holds for a TenantAdmin-resident token either way it's resolved (Pitfall 11).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Resident admitted via existing staff endpoint (Pitfall 4 drift) | LOW | Add policy to endpoint + negative case to suite; no data damage if caught early — check audit logs for resident-role access to staff endpoints on suspicion |
| Cross-apartment data shown to a resident (Pitfalls 3/5) | LOW–MEDIUM | Fix predicate/query; audit what they saw; notify affected households per LGPD duty if PII crossed units |
| Double admission / stranded visitor (Pitfall 7) | MEDIUM | Staff recovery path: porteiro admits with staff override, audit-logged; reconcile pre-reg `uses_consumed` vs Visits; fix transaction seam before reopening lane |
| Raw badge token persisted (Pitfall 8) | MEDIUM | Drop the column, rotate all issued badges (new credentials), extend arch test to forbid the pattern |
| Consent bypassed by lane (Pitfall 6) | MEDIUM | Audit lane-created visits missing policy checks vs ConsentAuditLog; re-run consent resolution for affected visits; composition fix |
| Residents became "attendants" in audit rows (Pitfall 1) | MEDIUM | Identify lane/portal audit rows with resident profileIds; re-attribute actor kinds; clean profile rows |
| Stale membership leak from JWT apartment claim (Pitfall 2) | HIGH | If already shipped with apartment claims: invalidate all resident tokens (force re-login), strip claims, rebuild scope derivation |
| Audit table bloat from denied attempts (Pitfall 12/limiter) | LOW | Retention/anonymization task on refused-scan tables; tighten limiter partitioning |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Resident login / profile dispatch (+ mixed role) | Phase 27 | Resident account with no staff profile logs in; no fake profile rows; mixed-role precedence test |
| 2. Live-token suspension; no apartment claim | Phase 27 | Same-token-then-suspend integration test; arch test forbids apartment claim in `GenerateAccessToken` |
| 3. Apartment-isolation dimension (no interceptor net) | Phase 27 (created) · 28/29/30 (reused) | Resident-surface arch test; two-apartment fixture mandatory per endpoint test |
| 4. Deny matrix over existing + new endpoints (F02 residue) | Phase 27 + continuously in 28–30 | Enumerated negative suite runs per phase; suite grows with endpoint count |
| 5. Pre-reg-bound arrival; no cross-apartment selection (F03 residue) | Phase 29 | Handler signature carries pre-reg id; same-doc/other-apartment Pending + CheckedIn tests return no other unit's data |
| 6. Consent parity on the lane (F11 residue) | Phase 29 | Policy-refused visitor cannot arrive via lane; actor kind `Visitor@Lane` on all lane-created rows |
| 7. Atomic compare-and-consume + replay | Phase 29 (26/Phase 30 reuses same contract) | Concurrency test admits exactly one with max_uses=1; lost-response replay returns committed outcome |
| 8. Verifier-only reprint (F12 residue) | Phase 29 | No raw-token persistence (arch test); post-checkout badge scan refused; reprint = revoke+issue |
| 9. max_uses/window write predicates (F04 residue) | Phase 28 (schema) · 29 (predicate) | No persisted derived status; boundary predicate shared helper; constraints on limits |
| 10. Tenant clock granularity (open flag) | Phase 28 | Fake-clock tests at tenant midnight/window edges; shared instant helper |
| 11. Mixed-role journeys (open flag) | Phase 27 (decision) · 30 (visibility) | Dual-role token passes deny matrix and lands the decided precedence |
| 12. PII retention/redaction (open flag) | Phase 28 (schema + arch test) · 29 (denial rule) | No attempted raw documents in refusal rows/logs; masking on portal surfaces in place |
| 13. Lane rate-limit partitioning (F05 residue) | Phase 29 | Forged-header rotation ineffective; kiosk flood throttles only the abusive token; no hard pre-reg lockout |
| 14. Document canonicalization (F08 residue) | Phase 28 | CPF check-digit validation; typed canonical column; foreign-doc policy explicit |
| 15. Non-sargable panel matching | Phase 28 (column/index) · 30 (consumer) | EXPLAIN shows index use on panel document match |
| 16. Notification delivery/read-state contract (F14 residue) | Phase 30 | No-op replay does not re-notify; notification carries committed VisitId; read-state semantics per decision |
| 17. Lane/badge UI journey + route ownership (F15 residue) | Phase 29 (minimal journey) · 30 (staff print trigger) | Playwright E2E of the complete resident→share→check-in→badge journey |
| 18. Carry-over from v2.1: enumeration-safe denials, transaction seams, tenant predication in raw SQL, redaction, OpenAPI regen, UTC/tenant-day boundaries | All phases (carried lessons) | v2.1 PITFALLS.md checklist items re-run against new surfaces |

## Sources

- **Code-verified (HIGH):** `src/Modules/Security/.../LoginHandler.cs` (attendant-profile requirement, quick-exit precedent 49-53); `src/Modules/Security/.../JwtTokenService.cs` (claims inventory, no apartment claim, 15-min TTL); `src/BuildingBlocks/.../TenantResolutionMiddleware.cs` (anonymous bypass 24-28, claim-derived context); `src/Modules/Visits/.../VisitorArrivalHandler.cs` (document-only selection, Guid.Empty attendant, Pending-reuse ignoring purpose, no tx); `src/Modules/Visits/.../VisitDirectoryRepository.cs` (non-sargable REPLACE matching, tenant-wide queries); `src/Modules/AccessControl/.../RecordAccessScanHandler.cs` (consent gate location 156-187, scan replay idempotency 99-119, VisitId link); `src/Modules/AccessControl/.../OpaqueTokenIssuer.cs` (verifier-only, fixed-time compare); `src/Modules/AccessControl/.../CredentialLifecycleHandlers.cs` (rejects existing active credential); `src/Modules/Residents/.../Resident.cs` (single mutable ApartmentId); `src/Modules/Visits/.../VisitEndpoints.cs` + `ReportEndpoints` (plain RequireAuthorization); `src/Host/.../Program.cs` (AddJwtBearer no OnTokenValidated; rate limiter partitions 186-207 incl. header-trusted email key; no UseForwardedHeaders); `.planning/codebase/` intel (dual tenant columns; feature pages without component specs).
- **Planning-verified (HIGH):** `.planning/PROJECT.md` (v2.4 goal, gap-closure decisions, open flags PII-tenancy/tenant-clock, key decisions incl. 4-tuple idempotency precedent and single-write-path doctrine); `.planning/ROADMAP.md` Phases 27–30 success criteria; `.planning/notes/v2-4-codex-gap-review.md` (F01–F18, resolved-into-decisions status); `.planning/research/PITFALLS.md` v2.1 edition (carried lessons); `.specs/qr-entrance-exit-access/data-model.md` (verifier-only, no persisted plaintext QR).
- **Not externally fetched this round:** all pitfalls here are code-internal; no web sources were needed beyond the OWASP cheat sheets already digested in the v2.1 research and the Codex review.

---
*Pitfalls research for: ControlEasy Reborn v2.4 — resident self-service & visitor experience on an existing multi-tenant access-control platform*
*Researched: 2026-10-15*