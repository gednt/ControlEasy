# Pitfalls Research

**Domain:** Adding integrated visits flow (data-store unification), reports & history page, and password management to an existing multi-tenant condominium access-control system (ControlEasy Reborn v2.1)
**Researched:** 2026-09-19
**Confidence:** HIGH (nearly all findings verified against actual source in this repo; OWASP guidance fetched from official cheat sheets; timezone/general claims MEDIUM)

**Method note:** Every pitfall below was grounded in the actual code (`ReportReadRepository.cs`, `RecordAccessScanHandler.cs`, `Visit.cs`, `UserRepository.cs`, `LoginHandler.cs`, `TenantFilterInterceptor.cs`, schema files `docker/mysql/init/*.sql`). Line references are given so executors can verify. External best-practice claims come from OWASP's Forgot Password and Authentication cheat sheets (fetched 2026-09-19).

---

## Critical Pitfalls

### Pitfall 1: Double-counting in the merged ledger — the dashboard already does this today

**What goes wrong:**
`ReportReadRepository.GetDashboardStatsAsync` (src/Modules/Reports/.../ReportReadRepository.cs:148–205) currently adds ConsentAuditLog entries **on top of** Visits: `todayVisits + additionalTodayVisits` and `openVisits + additionalOpenVisits`. When the walk-in fold makes every entry-log event also create a Visit row, the same real-world entry is counted **twice** — once as a Visit, once as a ConsentAuditLog row. The unified Shift ledger (decision 5 in `.planning/notes/integrated-visits-flow.md`) risks the same: summing Visits + AccessEvents without a correlation key counts one visitor entry as two ledger rows.

**Why it happens:**
The existing code "merges" by concatenating two DataTables and deduping by row `Id` (`existingVisitIds.Contains(id)`) — but Visits rows and ConsentAuditLog rows have **different Guids**, so that dedupe can never match the same *person/event*, only the same *row* re-read. Developers carry this pattern into the new unified stream.

**How to avoid:**
- Add a `VisitId` (nullable FK) column to `AccessEvents` (and keep `CorrelationId` on both) so a visitor QR scan that creates/checks-in a Visit links the two records explicitly. The ledger excludes an AccessEvent from the operational stream when it is linked to a Visit (or shows it as the same entry's audit side).
- For the dashboard transition period: pick **one** source of truth per metric. After the fold, `todayVisits`/`openVisits` come from Visits only; ConsentAuditLog counts disappear from the stats handler entirely (its remaining role is privacy-consent audit, per settled decision 3).
- Dedupe heuristic (only if explicit links are impossible): `(tenant_id, normalized VisitorDocument, time window < 5 min, same gatehouse)` — never bare Id.

**Warning signs:**
- Demo seed data (11-demo-seed.sql) shows a walk-in twice in the ledger.
- "Today visits" number on dashboard jumps the day the fold ships with no traffic change.
- Unit test comparing ledger row count before/after fold fails by exactly the number of folded walk-ins.

**Phase to address:** Integrated visits flow phase — the ledger read-model rewrite must land **together with** the walk-in fold in the same phase, not in a later reports phase.

---

### Pitfall 2: Status-model mismatch — coercing append-only decision states into the Visit lifecycle enum

**What goes wrong:**
Three incompatible state vocabularies collide: `VisitStatus` (Pending/CheckedIn/CheckedOut/Cancelled — mutable lifecycle), `EntryStates` (entered_with_consent / entered_without_consent / entered_override / gatehouse_only / exited — append-only decision records), and AccessEvent's `PolicyOutcome` + `CycleDirection` + `ScanDecisionKind` (Recorded/Refused/PolicyActionRequired). The current dashboard mapping already does a **lossy, misleading** coercion (`MapConsentAuditEntry`: "entered_without_consent" → status "Cancelled", "gatehouse_only" → "CheckedOut" — ReportReadRepository.cs:303–310). Extending that pattern into the unified ledger produces a ledger where a consent-refused event looks like a "Cancelled visit" — semantically wrong and operationally confusing for gatehouse staff.

**Why it happens:**
One UI column wants one badge. The temptation is to map everything into `VisitStatus` instead of modeling the stream properly.

**How to avoid:**
- The unified ledger must use a **discriminated union view model**: `{ source: Visit | AccessEvent | RefusedScan, kind, status-native-to-source, occurredAt, subject, destination }`. Never merge enums; render each source's native state.
- The ledger query itself is a SQL UNION of Visits and AccessEvents (both tenant-scoped, both timestamped), projecting to a common shape **with a discriminator column**, then ordered by time. Do the status mapping in the Angular presentation layer, keyed by discriminator.
- Keep AccessEvent's decision states immutable; keep Visit's state machine mutable. Never write AccessEvent rows from the walk-in fold (the fold writes Visit rows only).

**Warning signs:**
- A DTO like `UnifyStatus(string entryState)` appears in Reports/Application.
- Ledger row "Cancelled" appearing where staff saw a hard gate refusal.
- Snapshot tests / ledger screenshots show coerced statuses.

**Phase to address:** Integrated visits flow phase (ledger read model), reinforced in reports phase (page reuses the same view model — do not invent a second mapping).

---

### Pitfall 3: Breaking the append-only audit trail while folding walk-ins in

**What goes wrong:**
`ConsentAuditLog` is append-only, enforced by MySQL triggers `trg_consent_audit_log_no_update` / `trg_consent_audit_log_no_delete` (docker/mysql/init/09b-consent-schema.sql:28–40; proven by integration tests EntryLogEndpointTests.cs:127–181 which assert UPDATE and DELETE fail). A naive fold tries to "migrate" historical walk-in rows into Visits via UPDATE, backfill UPDATEs by joining, or DELETEs "orphaned" audit rows after copying — all of which hard-fail on the triggers in production, and all of which are wrong anyway.

**Why it happens:**
"Fold into Visits" is read as "move the data". The correct reading (settled decision 3) is: *going forward* walk-ins write Visit rows; ConsentAuditLog *reverts to* its privacy-consent role; history stays where it is.

**How to avoid:**
- Historical ConsentAuditLog rows are **read-only historical context**: the ledger renders them (read-only UNION member) or a one-time idempotent backfill INSERTs *new* Visit rows derived from them **copying, never deleting or rewriting** the originals. Mark backfilled rows (`SourceSystem = 'entry_log_backfill'`) so re-runs are detectable.
- Make the backfill idempotent on a natural key so running it twice doesn't duplicate rows (re-check: does a Visit already exist for this audit row id? store `ConsentAuditLogId` on the backfilled Visit).
- Never reuse row Ids across tables (`existingVisitIds.Contains(id)` in the current code is exactly this trap — different tables, different Id spaces).

**Warning signs:**
- Integration test asserting trigger rejection starts failing during the fold migration.
- Backfill run twice → duplicate Visits.
- Any migration script containing `UPDATE ConsentAuditLog` or `DELETE FROM ConsentAuditLog` — reject in review immediately.

**Phase to address:** Integrated visits flow phase (schema/migration step), verified with an arch/integration test that ConsentAuditLog still rejects UPDATE/DELETE after the fold ships.

---

### Pitfall 4: Walk-in state machine breakage — `Visit.CheckIn` only accepts Pending, and handlers must not patch the domain

**What goes wrong:**
`Visit.CheckIn` throws unless `Status == Pending` (src/Modules/Visits/.../Visit.cs:56–66), and `VisitDirectoryRepository.CheckInAsync` silently returns `false` for non-Pending (VisitDirectoryRepository.cs:65–76). The settled design leans toward walk-ins landing **directly as CheckedIn** (person physically present). If an executor "fixes" this by relaxing the entity guard (making `CheckIn` accept any status), the QR check-in path *and* the manual check-in path silently change semantics: a Cancelled or CheckedOut visit could be re-checked-in, corrupting the operational ledger.

**Why it happens:**
The fastest path is editing the guard instead of adding a domain operation. The guard exists to protect a real invariant; loosening it for one flow breaks all callers.

**How to avoid:**
- Add an explicit domain method, e.g. `Visit.RegisterWalkInCheckIn(attendantProfileId, gatehouseId)` that is only callable on a `Pending`-equivalent fresh creation — i.e., the walk-in factory method creates the Visit already-CheckedIn with `CheckedInAtUtc = now`, leaving the existing transition guards untouched.
- Alternatively two-step in one transaction: create Pending → CheckIn. Two writes are acceptable **if wrapped in the same transaction/unit-of-work**; two-step across requests is not.
- Add unit tests pinning the invariant: Cancelled/CheckedOut visits can never transition to CheckedIn, regardless of entry path.

**Warning signs:**
- A diff that edits the guard inside `Visit.CheckIn` instead of adding a method.
- Integration test where a Cancelled visit accepts a check-in.

**Phase to address:** Integrated visits flow phase — decide the walk-in state landing in design (spec decision), implement as a domain method.

---

### Pitfall 5: Non-atomic visitor QR→Visit flow — the existing idempotency check hides a half-completed write

**What goes wrong:**
`RecordAccessScanHandler` (RecordAccessScanHandler.cs:194–199) persists the AccessEvent, **then** calls `_visits.CheckInAsync(...)` as a separate, non-transactional write. If the second call throws, the AccessEvent is already persisted; on retry, the idempotency gate (`FindByScanAttemptAsync` → early return, lines 85–104) returns the cached success and **never retries the visit check-in**. Result: a visitor is inside per the audit trail but the Visit row still says Pending — the ledger shows a ghost. The new feature (visitor-only QR **creating** Visit rows) adds even more steps: credential resolution → policy → event insert → visit create/check-in. More steps = bigger half-write window.

**Why it happens:**
Idempotency keyed on one store (AccessEvents, `uq_access_events_scan_attempt`) is mistaken for end-to-end idempotency. Cross-module side effects appended after the idempotent write are invisible to the replay.

**How to avoid:**
- Wrap event insert + visit create/check-in in a **single DB transaction** (same `IAsyncSqlClient`/connection scope). If DBTools makes cross-repository transactions awkward, the access event insert becomes the *last* write, not the first — or a local outbox row drives the visit mutation with a compensating replayer.
- On idempotent replay, **re-run the visit side-effect check** (is there a Visit linked via ScanAttemptId? if not, create/check-in it) instead of returning early. Make the visit side-effect itself idempotent: `INSERT ... ON DUPLICATE KEY` on a natural key, or check-link-then-create.
- Add `VisitId` to AccessEvents (Pitfall 1's correlation column doubles as the idempotency marker for the visit side-effect).

**Warning signs:**
- Integration test killing the process between event insert and visit check-in, then replaying the scan → ledger mismatch.
- Ops reports: "visitor scanned, entered, but not on the visits list."

**Phase to address:** Integrated visits flow phase — this is the core new write path; test the failure-injection case explicitly in integration tests.

---

### Pitfall 6: Tenant-scoping bugs in cross-module queries — dual tenant columns, interceptor substring matching, and SELECT JOIN ambiguity

**What goes wrong:**
Three concrete, verified hazards:
1. **Dual tenant columns.** Every table carries both `TenantId` (PascalCase) and `tenant_id` (snake_case) — e.g. Visits has `IX_Visits_TenantId` and `IX_Visits_tenant_id` with different default semantics (06-visits-schema.sql). The `TenantFilterInterceptor` only recognizes the **lowercase** `tenant_id = ` substring when deciding whether to skip injection (TenantFilterInterceptor.cs:59–67). A query that filters on PascalCase `TenantId = @param0` gets a *second* injected `tenant_id` predicate — if the two columns ever disagree (backfill scripts write both, defaults differ historically), rows vanish or multiply silently.
2. **JOIN ambiguity.** The interceptor appends a bare `tenant_id = @paramN` (InjectPredicate, line 78–88) with **no table qualifier**. The unified ledger must join Visits + AccessEvents (+ Apartments for labels); a bare predicate on a multi-table query is a MySQL error (`Column 'tenant_id' in where clause is ambiguous`) — or worse, silently binds to the wrong table in some shapes.
3. **Raw SQL bypass.** `SelectRawAsync` queries (like the occupied-apartments query, ReportReadRepository.cs:99–102) carry explicit tenant predicates because raw SQL paths don't reliably pass through the interceptor. Every new raw unified-stream query must re-derive tenant scoping by hand.

**Why it happens:**
The interceptor is a string-level patch, not an ORM-level filter. Cross-module queries are new SQL shapes the interceptor was never exercised against.

**How to avoid:**
- For the unified stream, write the tenant predicate **explicitly on every table alias** in raw SQL (`v.tenant_id = @p AND e.tenant_id = @p`) exactly like the occupied-apartments query already does — and add a query-shape integration test per new query that cross-tenant rows never leak (two tenants, seed both, assert only tenant A's rows).
- Add an architecture test extending `AccessControlTenantRulesTests` (which already enumerates owner tables, line 125) to require tenant predicates in any repository method reading Visits + AccessEvents together.
- Normalize the write path: when the fold creates Visits from AccessControl flow, set **both** `TenantId` and `tenant_id` from `command.TenantId` — never from defaults.

**Warning signs:**
- "Ambiguous column" SQL errors in dev — treat as a red flag, not a nuisance.
- A test tenant's data appearing in another tenant's ledger during integration runs.
- Any new repository method whose WHERE clause doesn't mention tenant explicitly while using raw SQL.

**Phase to address:** Integrated visits flow phase (ledger query) and reports phase (every new report query). Add a shared integration test helper: "cross-tenant leak assertion" reused by both.

---

### Pitfall 7: Email/timing enumeration in forgot-password — the login handler's quick-exit pattern is already the bad example

**What goes wrong:**
`LoginHandler` (LoginHandler.cs:49–53) is a textbook quick-exit: if the user is not found it throws **immediately**, never running BCrypt; if the user exists it runs a cost-≥11 BCrypt verify (~100–300ms). That measurable timing delta is a discrepancy factor (OWASP Authentication Cheat Sheet, "time-based attack"). Copying this shape into the new forgot-password endpoint ("if user found → hash temp password + send email; else → 404") leaks which admin emails exist, and differing response times enumerate accounts even with a generic message body.

**Why it happens:**
The generic-message part of enumeration protection is well known; the **timing** half is routinely forgotten, and the existing code normalizes the bad pattern.

**How to avoid (OWASP Forgot Password Cheat Sheet, fetched 2026-09-19):**
- Always return the same response ("If that address is in our system, a temporary password has been sent") with the same HTTP status for known and unknown emails — the *only* branch that differs is whether an email is queued.
- Run a **constant-cost decoy**: when the user is not found, still run `_passwordHasher.Verify(..., dummyHash)` and still burn the same async pipeline, so wall-clock time matches.
- Forgot-password applies **admins only** (milestone scope) — which makes enumeration of *powerful* accounts worse; treat it strictly.

**Warning signs:**
- Timing difference >50ms between known/unknown email on the new endpoint (measure in an integration test with a real BCrypt cost).
- Any `NotFoundException` escaping the forgot-password handler on unknown email.

**Phase to address:** Password management phase — first endpoint written must include the decoy-verify + uniform response; pin it with a test.

---

### Pitfall 8: Temp-password delivery failure strands the admin (SMTP is a cross-process side effect, not a transaction step)

**What goes wrong:**
The flow is: generate temp password → BCrypt-hash → update user (`MustChangePassword = true`) → SMTP send. Two failure orders strand someone: (a) DB updated, SMTP fails → the admin's old password no longer works (it was overwritten), the temp password never arrives → **locked-out admin, no self-service path** (that's why they asked for a reset); (b) SMTP succeeds, DB update fails → email contains a password that doesn't work. Also `Demo.DisableOutboundEmail` exists in appsettings — demo must not crash the flow.

**Why it happens:**
Treating an external side effect (SMTP) as if it were part of the local transaction. BCrypt is one-way: once the hash is overwritten, the plaintext temp password is unrecoverable — the ordering is unrecoverable too.

**How to avoid:**
- **Store-then-send with a delivery record:** persist the hashed temp password + `MustChangePassword=true` **plus a delivery status** (e.g., a `PasswordResetRequest` row: userId, tempHash, deliveryState = Pending/Sent/Failed, attempts, expiresAtUtc) in the *same* transaction. Email send updates the row's state.
- **Outbox/retry:** a background retry (or idempotent "resend" admin action, still yielding the *same* one-time temp password within the window) rescues SMTP blips without a new random password. Keep the plaintext only long enough to send — never persist plaintext.
- **Order of record:** never overwrite the old hash until the row with the pending delivery exists; if SMTP is down entirely, the platform-admin reset path (also in scope) is the human fallback — document it in the operator docs.
- Demo mode: no-op sender marked Sent.

**Warning signs:**
- Support tickets "reset email never arrived, can't log in" with no resend affordance.
- Any code path calling `UpdateAsync(user)` before the delivery record is durable.
- SMTP exceptions bubbling as 500s *after* the password was already changed.

**Phase to address:** Password management phase — the delivery-state table is part of the phase's schema work, not a later enhancement.

---

### Pitfall 9: Logging the temp password (and reset material) into Serilog/Seq

**What goes wrong:**
Serilog is configured at Information level with Console JSON + Seq sinks (appsettings.json:Serilog; Program.cs:41–47, 63–66, 176). The natural developer log line — "issued temp password {TempPassword} for {Email}" or a destructured request DTO in an audit writer call (the `IAuditLogWriter.WriteAsync(details: ...)` pattern in EntryLogHandlers.cs writes human-readable detail strings) — puts a live credential into Seq, which every operator and potentially the demo stack can read. The AccessControl module already has a **redaction arch test** (per PROJECT.md: "Serilog structured logging ... with a redaction arch test") — password flows get no such guard by default.

**Why it happens:**
Debugging a "did the email go out?" issue at 21:00 in the gatehouse. The log line works, ships, and becomes a permanent credential leak in append-only logs.

**How to avoid:**
- Never log the temp password, the reset token, or full request DTOs from auth endpoints. Log **event ids and outcomes**: `PasswordResetIssued { UserId, RequestId, DeliveryState }`.
- Add an arch test in the AccessControl redaction style: fail the build if `PasswordReset*Handler` types reference `TempPassword`/`PasswordHash`/`ResetToken` inside any `Log*` call or `details:` string.
- One-time temp passwords + `MustChangePassword` re-arm (already in scope) limit blast radius but do not excuse logging secrets.

**Warning signs:**
- Grep of Seq/console logs for a temp password pattern finding hits during a test run.
- Any `details:` audit string containing "password" + a value in the same sentence.

**Phase to address:** Password management phase — the redaction arch test lands with the first handler in the same phase.

---

### Pitfall 10: Cross-tenant password reset — platform admin context vs. the tenant filter (and inconsistent repository bypassing)

**What goes wrong:**
Platform-admin resets a tenant B gatekeeper. The admin's JWT carries *their* tenant context (`ITenantContext.TenantId`). Any tenant-aware query (`ITenantAwareLinqFactory.Create(_ctx)`) injects `tenant_id = <admin's tenant>` — the target user read returns null (mysterious "User not found"), or the update predicate matches nothing (`UpdateAsync` throws "Failed to update user ..." — UserRepository.cs:76–77). Meanwhile the repo layer is **inconsistently wired**: `UserRepository` uses plain `IAsyncSqlClient` with *no* tenant filter at all (UserRepository.cs:13–31 — `FindByEmailAsync` is global, matching the globally-unique `Email`), `AttendantProfileRepository` uses `bypassTenantFilter: true` for one method (line 49) but presumably not others, and RefreshTokens/other new tables are unwritten. A reset implemented "however the nearest repository does it" will be either over-broad (cross-tenant leak) or wrongly filtered (platform admin can't do their job).

**Why it happens:**
Authorization (who may reset whom) is a *handler-level policy* decision; tenant filtering is a *persistence-level* mechanism. Mixing them up means the interceptor's bypass flags encode business rules implicitly and untestably.

**How to avoid:**
- Make the rule explicit in the handler with tests: **platform admin → any tenant; tenant admin → own tenant only; tenant admin resetting another tenant's gatekeeper → Forbidden (403, not 404).**
- Use one deliberate, named data-access choice per query: platform-admin flows query Users with the explicit bypass (the `Email` unique key is global — user lookup by email/Id is legitimately cross-tenant) **after** the handler has proven authorization; tenant-scoped flows use the tenant-aware factory untouched.
- Refresh tokens must be revoked by *user id* (not tenant-filtered) in the same flow — verify `IRefreshTokenRepository` supports it.

**Warning signs:**
- Platform-admin integration test resetting a gatekeeper in another tenant 404s.
- A tenant-admin integration test resetting a foreign tenant's user **succeeds** (worst case — silent cross-tenant write).
- `bypassTenantFilter: true` appearing in password-reset repositories without a matching authorization test.

**Phase to address:** Password management phase — authorization matrix tests (platform→any, tenant-admin→own-only, negative cases) are the phase's acceptance criteria, not an afterthought.

---

### Pitfall 11: Rate-limit bypass — no rate limiter exists anywhere, and in-memory/per-IP limits don't survive distribution or restart

**What goes wrong:**
`Program.cs` registers no `AddRateLimiter` (verified — no match in src/Host). The new forgot-password endpoint is therefore unthrottled: an attacker floods resets to spam a target's inbox (OWASP explicitly calls out per-account limiting for exactly this), or brute-temp-password-guesses. Defenses that *look* right but fail: (a) per-IP in-memory ASP.NET `RateLimiter` partitions — bypassed by distributed requests (botnet, or the same attack from the office LAN + a phone hotspot) and wiped by container restarts; (b) per-account counters only in memory — same restart problem, and multiple API replicas don't share memory.

**Why it happens:**
The .NET 8 rate-limiting middleware is one line to add and feels done; persistence of counters is the part people skip.

**How to avoid:**
- **Layer 1 (cheap, in-memory):** `System.Threading.RateLimiting` partitioned by account (email) and by IP for the forgot-password + reset + login endpoints. Accept that it's best-effort.
- **Layer 2 (durable, authoritative):** per-account reset counters persisted in MySQL (the `PasswordResetRequest` table from Pitfall 8 doubles as this: count requests per user per window; enforce max N per 24h). Check-and-increment inside the same transaction that issues the temp password so concurrent distributed requests can't slip through.
- Do **not** lock the account in response to forgot-password floods (OWASP Forgot Password: "Accounts should not be locked out in response to a forgotten password attack" — it's a denial-of-service lever). Throttle silently instead.
- Same treatment for the admin-initiated reset endpoint (it's authenticated but an insider can still spam it).

**Warning signs:**
- Load test: 1000 reset requests/minute from one account all succeed and all enqueue emails (mail-bombing).
- Restarting the API clears all counters (proves they were in-memory only).

**Phase to address:** Password management phase — durable per-account counter ships with the endpoint; in-memory limiter is the same phase, one config line.

---

### Pitfall 12: 'Today' boundaries in reports are UTC — wrong day for a Brazilian gatehouse (and DST-naive math)

**What goes wrong:**
`GetDashboardStatsAsync` computes "today" as `DateTime.UtcNow.Date` (ReportReadRepository.cs:115) and `GetVisitCountsByDayAsync` groups by `DateOnly.FromDateTime(value.ToUniversalTime())` (line 229–233) — i.e., **UTC days**. A condominium in São Paulo (UTC−3): a 21:30 BRT arrival is stored as 00:30 UTC *next day*, so it counts on the wrong calendar day; the "visits by day" chart shifts every evening entry by one day. Worse, `MapVisitDate` calls `.ToUniversalTime()` on a value read via `Convert.ToDateTime` from a timezone-naive MySQL DATETIME — that method assumes **server-local** time, so on a non-UTC deployment (the Compose stack does not pin TZ; Windows host runs leak host TZ) the boundary math changes per deployment. And the gatehouse asks about *shifts*, not calendar days: `Shifts` rows carry `StartTime/EndTime/CrossesMidnight` (05-security-schema.sql) — a 22:00–06:00 shift spans two UTC dates; neither current query can express it.

**Why it happens:**
Everything is stored UTC (correct) but the *consumer* boundary (what a porteiro calls "today") is local. Converting at the wrong layer — or trusting `.ToUniversalTime()` on Unspecified-kind DateTime — is the classic MySQL DATETIME trap.

**How to avoid:**
- Pin the container timezone explicitly (`TZ=UTC` in compose; document it) so `.ToUniversalTime()` is a no-op deterministically, then **never rely on it**.
- Define "day" per tenant: a tenant timezone setting (default `America/Sao_Paulo`) and compute day boundaries as explicit UTC instants (`2026-09-19T03:00:00Z` = midnight BRT) **in the handler**, passing parameterized `>=`/`<` bounds into SQL — never `GROUP BY` raw DATETIME with C#-side day extraction for the new unified stream.
- For the Shift ledger, group by the *shift window* (from `Shifts.CrossesMidnight` logic), not by calendar day; hand the reports page both views.
- Existing `GetVisitCountsByDayAsync` UTC-day behavior should be acknowledged in the reports phase as "to fix" — the page is new, so fix the semantics while building it (backfill consistency: state clearly which boundary historical rows used).

**Warning signs:**
- Evening visits appearing on tomorrow's bar in the by-day chart (off-by-one evenings only).
- Numbers differ between a UTC-deployed container and a dev machine — the same query, same data.
- Shift report "today" including yesterday's 23:00 arrivals when the shift started 22:00.

**Phase to address:** Reports phase (primary) and integrated-visits phase (the unified ledger's "current shift" filter has the same trap — fix once, share the boundary helper).

---

### Pitfall 13: Reports queries scale as full-table loads — no CreatedAtUtc index, in-memory grouping, `1=1` pulls, and N+1 joins

**What goes wrong:**
Verified specifics:
- `Visits` has **no index on `CreatedAtUtc`** (06-visits-schema.sql: indexes are TenantId, Status, VisitorName, VisitorDocument, CheckedInAtUtc, tenant_id) yet `GetVisitCountsByDayAsync` and the "today" query filter on it — full scan, and the unified ledger will do the same against a growing Visits table.
- `GetVisitCountsByDayAsync` pulls **every** `CreatedAtUtc` in range into a DataTable and groups **in C#** (lines 28–42) — memory grows linearly with visits; a "last 90 days" report loads 90 days of rows to produce ~90 numbers.
- `GetDashboardStatsAsync` runs **six sequential full scans** (`whereClause: "1=1"`, `Status IN (0,1)` without tenant+status composite, recent visits `1=1` then `.Take(10)` in memory — lines 69–131) plus a whole-table ConsentAuditLog scan inside a swallowed `catch` (lines 152–189: a silent swallow that hides real DB failures — the ledger just silently loses audit entries).
- The new unified history page (per-apartment drilldowns, per-day charts, per-resident history) invites per-row apartment lookups (N+1) — although `AccessEvent`/`Visit` carry denormalized `DestinationBlock/Unit` snapshots precisely so you don't need to join; ignoring the snapshots reintroduces the N+1.

**Why it happens:**
Reports are built against demo-scale seed data where every query returns in milliseconds; the trap detonates at real condominium volume (thousands of visits × 365 days × tenants in one shared DB).

**How to avoid:**
- Migration in the reports phase: `ADD INDEX IX_Visits_tenant_CreatedAt (tenant_id, CreatedAtUtc)` (and consider `(tenant_id, Status)` for open-visit counts). AccessEvents already has `ix_access_events_tenant_time (tenant_id, OccurredAtUtc)` — reuse its shape.
- Aggregate **in SQL** (`GROUP BY DATE(...)` or day-boundary CASE buckets with the Pitfall 12 helper) with `LIMIT`-bounded detail queries; DataTable→C# grouping is only acceptable for bounded small sets.
- Kill the silent `catch` around the audit read — surface a degraded state explicitly.
- For the unified stream: SQL UNION with per-branch tenant + time-range predicates, one page at a time (`skip/take` already exists in the repo pattern), apartment labels from the denormalized snapshots (no join, no N+1).

**Warning signs:**
- `/reports` page render > 1s at 100k rows in a staging load test.
- API payload of the by-day endpoint proportional to row count, not to distinct days.
- Seq showing the swallowed audit exception count rising.

**Phase to address:** Reports phase (indexes + SQL-side aggregation for all new queries); the ledger read-model rewrite in the visits phase must adopt the same pattern so reports doesn't inherit a slow query.

---

### Pitfall 14: The dead `/reports` route — wildcard catch silently eats the fix (and the guard)

**What goes wrong:**
`dashboard.page.ts:178` links to `/reports`; no such route exists, so Angular's `**` wildcard redirects to login (the "dead dashboard handover link" from PROJECT.md). Adding the route fixes it — but the classic misses are: (a) placing `/reports` **outside** the auth guard so a logged-out deep link loops or leaks; (b) registering it as a wildcard-adjacent path that still loses query params (`/reports?from=...&to=...` from the dashboard); (c) the OpenAPI generated clients for the existing report endpoints sit idle (known v1.0 tech debt: "generated OpenAPI client not consumed by handwritten Angular services") — handwriting new services repeats the debt and drifts from `openapi-check`.

**Why it happens:**
Route additions are trivial and get no tests; the wildcard makes failures invisible (silent login redirect instead of a 404).

**How to avoid:**
- Add the route inside the authenticated route tree with the same guard as `/visits`; add a Playwright test asserting `/reports` renders while authenticated and the dashboard link navigates (this is exactly the E2E gap the `**` wildcard hides today).
- Consume the generated OpenAPI report clients for new unified-stream endpoints; extend `openapi-check` coverage rather than handwriting DTOs.
- Preserve query-param-driven date ranges on the route (matrix params or queryParamsHandling) since dashboard links will deep-link.

**Warning signs:**
- E2E suite has no assertion on the handover link.
- A new handwritten `.service.ts` for reports appears next to generated clients.

**Phase to address:** Reports phase — route + guard + E2E assertion in the phase's first plan task.

---

### Pitfall 15: Race conditions on temp-password issuance — concurrent resets and single-use enforcement done wrong

**What goes wrong:**
Two concurrent forgot-password requests (or an admin reset racing a self-service one) overwrite each other's temp hash — last writer wins; the emailed password from the loser doesn't work ("I got the email but it says invalid"). Worse: if "one-time" is enforced by clearing a flag on successful login rather than a single-use consume, two people submitting the temp password in the same second both pass the check (check-then-act race), or the temp password remains usable after first use (not actually one-time).

**Why it happens:**
Check-then-act on non-transactional reads; MySQL default isolation (REPEATABLE READ) doesn't serialize these reads across connections.

**How to avoid:**
- Model the temp credential as a **single-use row**: `PasswordResetRequest { Id, UserId, TempHash, ExpiresAtUtc, ConsumedAtUtc, DeliveryState }`; consume via a single atomic `UPDATE ... SET ConsumedAtUtc = NOW() WHERE Id = @id AND ConsumedAtUtc IS NULL AND ExpiresAtUtc > NOW()` and treat `0 rows affected` as "already used/expired" — the affected-row count is the lock, not a read.
- Issuance: unique constraint or `UPDATE ... WHERE` on one-active-request-per-user (invalidate previous on new issue), so the newest email is the only valid one — and say so in the email copy ("this supersedes previous temporary passwords").
- On consumption, atomically set the new permanent hash + `MustChangePassword = false` + **revoke all refresh tokens** in one transaction.

**Warning signs:**
- Two rapid clicks on "send" produce two emails where only one works, nondeterministically.
- A temp password still logs in after successful change.

**Phase to address:** Password management phase — the consume-by-affected-rows pattern is a code-review checklist item for that phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Coercing AccessEvent/EntryState into `VisitStatus` for the ledger DTO | One status column, simpler UI binding | Semantically wrong statuses (refusal = "Cancelled"), staff distrust, future refactor of the ledger view model | Never — use a discriminated union |
| Deduping merged stores by row Id | One-line `HashSet.Contains` | Cannot match the same real-world entry across tables; double counting returns with volume | Never — correlate by link column or natural key |
| In-memory grouping of report data (`DataTable` → LINQ GroupBy) | No SQL GROUP BY to write; matches existing repo style | Memory/time linear in rows; OOM risk on year-range reports | Only for bounded sets (top-N already LIMITed) |
| Silent `catch` around the ConsentAuditLog read in stats | Dashboard renders when audit table is odd | Hides real failures; ledger "loses" data invisibly | Never — degrade loudly with a partial-data flag |
| Skipping the refresh-token revocation on password reset | Faster to ship reset | Compromised sessions survive reset for up to 7 days (RefreshTokenTtlDays) | Never for password flows |
| Handwriting report endpoints/DTOs instead of OpenAPI generation | Faster first draft | Repeats the v1.0 known debt; `openapi-check` drift | Never — the pipeline exists |
| Hardcoding `America/Sao_Paulo` per query instead of a tenant setting | No settings UI needed | Wrong for tenants in other zones (Manaus UTC−4, Fernando de Noronha UTC−2) | Acceptable as default, must be a named constant/tenant setting, not string literals scattered in SQL |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SMTP (forgot-password) | Sending inline in the request; treating send failure as 500 *after* mutating the account | Persist delivery state in same transaction as hash change; background retry/resend; demo-mode no-op sender via `Demo.DisableOutboundEmail` |
| MySQL append-only triggers (ConsentAuditLog) | Writing "fold" migrations that UPDATE/DELETE audit rows | Copy-forward only; new Visit rows reference `ConsentAuditLogId`; integration test asserting triggers still fire post-migration |
| DBTools `TenantFilterInterceptor` | Assuming it protects raw `SelectRawAsync` and multi-table JOINs | Explicit tenant predicates per table alias in raw SQL; interceptor only helps single-table generated queries |
| Dual tenant columns (`TenantId`/`tenant_id`) | Writing only one column on fold-created Visits | Set both from `command.TenantId`; arch test already enumerates owner tables — extend it |
| OpenAPI client generation (`ng-openapi-gen`) | Handwriting TS services for new report endpoints | Generate + `npm run openapi-check` in the same phase |
| Serilog/Seq | Logging auth DTOs destructured or temp passwords in detail strings | Log ids/outcomes only; redaction arch test (pattern already exists in AccessControl) |
| Demo seed (11-demo-seed.sql) | Leaving walk-ins only in ConsentAuditLog post-fold | Seed both Visit rows and linked AccessEvents so demo shows the unified ledger correctly |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No `(tenant_id, CreatedAtUtc)` index on Visits; reports filter on CreatedAtUtc | Slow `/reports` by-day queries; seq scans | Migration adds composite index matching query shape | ~50–100k visit rows (months of real traffic) |
| Pull-all-then-group-in-memory (`GetVisitCountsByDayAsync`, dashboard's six `1=1` scans) | Latency linear in history; large DataTable allocations | GROUP BY in SQL; LIMIT detail queries; index the range columns | Tens of thousands of rows / year-long ranges |
| N+1 apartment labels in the unified ledger | One query per ledger row to resolve Block/Unit | Use denormalized `DestinationBlock`/`DestinationUnit` snapshots already on Visit and AccessEvent | Immediately visible at 100+ ledger rows/page |
| Ledger UNION without per-branch LIMIT | Full scan of both tables per page render | Push `skip/take` + time-range into each UNION branch | First page over a large history table |
| Per-request BCrypt cost on unknown-user path skipped (quick exit) | Not perf, but the same structure: fast path vs slow path observable | Constant-work auth paths (Pitfall 7) | Detectable from the first day, not a scale problem |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Divergent forgot-password responses (404 vs 200, timing) | Account enumeration of admin emails | Uniform response + uniform timing; decoy BCrypt verify on miss (OWASP Forgot Password) |
| Temp password in logs/Seq, or emailed in the *reset confirmation* email | Credential exposure in append-only logs / mail archives | Log ids only; confirmation email contains no credential (OWASP: "do not send the password in the email!") |
| No single-use enforcement on temp passwords | Reused leaked temp credential | Consume atomically via affected-rows UPDATE (Pitfall 15) |
| Missing refresh-token revocation on reset | Old sessions survive credential rotation | Revoke all refresh tokens in the same transaction |
| Cross-tenant reset without explicit authorization check | Tenant A admin resets tenant B users (privilege escalation) or platform admin silently 404s | Handler-level authorization matrix with negative integration tests (Pitfall 10) |
| Account lockout triggered by forgot-password floods | Attacker DoSes admins by mailing resets | Throttle per-account; never lock on reset requests (OWASP) |
| BCrypt cost drift in the new code path | Weak hashing sneaks into reset hash generation | Reuse `IPasswordHasher.Hash` (cost ≥ 11 is constitutionally pinned); never inline a second hasher |
| Forgetting `MustChangePassword` re-arm on admin-issued temp passwords | Temp password becomes permanent credential | One-time temp + `MustChangePassword = true` until change (already a domain flag — use it) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "If that email exists..." message without timing parity | Enumeration via stopwatch; admin confusion about non-arrival | Uniform copy AND uniform latency |
| No fallback when SMTP is down | Locked-out admin at 22:00 with no recovery path | Platform-admin manual reset (in scope) as documented fallback; resend affordance on the request row |
| Ledger renders coerced statuses ("Cancelled" for a refused scan) | Porteiro misreads the shift; disputes about "who cancelled" | Native per-source status labels, visually differentiated source badges |
| "Today" numbers that don't match the porteiro's shift | Distrust of the reports page; manual recount in spreadsheets | Shift-window ledger + tenant-local day boundaries (Pitfall 12) |
| Temp password email without expiry/supersession note | Confusion when a second request invalidates the first | Email copy states expiry (e.g., 30 min) and that it supersedes prior temp passwords |

## "Looks Done But Isn't" Checklist

- [ ] **Walk-in fold:** Often missing idempotent backfill — verify running the fold twice produces zero duplicate Visits.
- [ ] **Visitor QR→Visit:** Often missing failure-injection test — verify event-persisted-but-visit-failed replays correctly (Pitfall 5).
- [ ] **Unified ledger:** Often missing cross-tenant leak test — verify two-tenant seeding shows no bleed (Pitfall 6).
- [ ] **Append-only preservation:** Often missing post-migration trigger test — verify UPDATE/DELETE on ConsentAuditLog still rejected after fold.
- [ ] **Forgot-password:** Often missing timing-parity measurement — verify known/unknown email respond within noise (Pitfall 7).
- [ ] **Temp password:** Often missing single-use enforcement test — verify consumed temp fails second login attempt.
- [ ] **Admin reset:** Often missing refresh-token revocation — verify old refresh token rejected after reset.
- [ ] **Platform-admin reset:** Often missing cross-tenant success test — verify it works (and tenant-admin cross-tenant fails with 403).
- [ ] **Rate limiting:** Often missing durable counter — verify counters survive API container restart.
- [ ] **Secret redaction:** Often missing log assertion — verify no temp password appears in Seq/console during the full flow test.
- [ ] **Reports page:** Often missing route-guard + E2E on the dashboard handover link — verify `/reports` authenticated renders, unauthenticated redirects (not looped through `**`).
- [ ] **By-day chart:** Often missing local-day boundary test — verify a 21:30 BRT visit counts on the 21st, not the 22nd.
- [ ] **Demo mode:** Often missing reseed — verify demo stack shows unified ledger with both sources and `DisableOutboundEmail` path returns success.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Double-counted ledger metrics | LOW | Fix read-model correlation; no data repair needed if only reads were wrong — re-verify against demo seeds |
| Double-created Visit rows (fold backfill ran twice) | MEDIUM | Identify backfilled dupes via `SourceSystem='entry_log_backfill'` + same `ConsentAuditLogId`; delete dupes (Visits is mutable, not append-only); re-run dedupe count check |
| Temp password logged to Seq | MEDIUM | Rotate: force password reset for affected users, purge/retention-scrub Seq stream, add redaction arch test |
| Half-written QR→Visit (event without visit) | LOW | One-off reconciliation query: AccessEvents (visitor, entrance) with no linked Visit → create/check-in backdated Visits; then fix transactionality |
| SMTP-down lockout | LOW–MEDIUM | Platform-admin reset path (in scope); resend affordance re-delivers the same temp within window |
| Wrong day-boundary reports | LOW | Recompute read-side only; historical rows are UTC-correct, only boundaries were wrong |
| Append-only trigger accidentally dropped during migration | HIGH | Restore trigger from 09b-consent-schema.sql, audit ConsentAuditLog for any mutated rows since drop (compare against AccessEvents/Visits timelines), re-verify tamper-evidence tests |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Double-counting merged ledger | Integrated visits flow (read-model rewrite lands with the fold) | Demo-seed count reconciliation test; ledger row count == distinct real-world entries |
| 2. Status-model mismatch | Integrated visits flow (ledger view model) | Ledger renders refusal as refusal, not "Cancelled"; snapshot test on view model |
| 3. Append-only trail broken | Integrated visits flow (migration design) | Post-migration integration test: UPDATE/DELETE on ConsentAuditLog rejected |
| 4. Walk-in state-machine break | Integrated visits flow (domain method for walk-in landing) | Unit test: Cancelled/CheckedOut can never re-enter; walk-in lands CheckedIn |
| 5. Non-atomic QR→Visit | Integrated visits flow (transaction + idempotent replay of visit side-effect) | Failure-injection integration test replays correctly |
| 6. Tenant-scoping in cross-module queries | Integrated visits flow + Reports (shared leak-assertion helper) | Two-tenant integration test per new query |
| 7. Enumeration (message + timing) | Password management | Integration test: uniform body/status/latency on known vs unknown email |
| 8. SMTP stranding | Password management | Delivery-state row + resend test; SMTP-down simulation recovers |
| 9. Secret logging | Password management (redaction arch test) | Arch test fails on `TempPassword` in log calls; Seq scan during flow test |
| 10. Cross-tenant reset | Password management (authorization matrix) | Platform→any passes; tenant-admin→foreign fails 403 |
| 11. Rate-limit bypass | Password management | Counter-survives-restart test; mail-bomb attempt throttled |
| 12. UTC/local day boundary | Reports (shared boundary helper; ledger adopts it) | 21:30 BRT lands on the 21st; shift-window filter test with CrossesMidnight |
| 13. Reports scaling | Reports (indexes + SQL-side grouping) | 100k-row load test under budget; payload ∝ days not rows |
| 14. Dead `/reports` route | Reports (first task: route + guard + E2E) | Playwright asserts link lands on /reports authenticated |
| 15. Temp-password races | Password management | Concurrency test: single consumption; loser gets expired message |

## Sources

- **Code-verified (HIGH):** `src/Modules/Reports/.../ReportReadRepository.cs` (ledger double-add, UTC day mapping, silent catch, six full scans); `src/Modules/AccessControl/.../RecordAccessScanHandler.cs` (idempotency gate before visit side-effect); `src/Modules/Visits/.../Visit.cs` + `VisitDirectoryRepository.cs` (state machine guards); `src/Modules/Security/.../LoginHandler.cs` + `UserRepository.cs` (quick-exit timing, un-filtered user reads, refresh-token flow); `src/BuildingBlocks/.../TenantFilterInterceptor.cs` + `TenantAwareLinqFactory.cs` (interceptor mechanics, bypass flags); `docker/mysql/init/06-visits-schema.sql` (no CreatedAtUtc index), `09b-consent-schema.sql` (append-only triggers), `12-access-control-schema.sql` (event indexes), `05-security-schema.sql` (Shifts CrossesMidnight); `src/Host/.../Program.cs` + `appsettings.json` (no rate limiter; Serilog config; `Demo.DisableOutboundEmail`; `RefreshTokenTtlDays: 7`); `.planning/notes/integrated-visits-flow.md` (settled decisions); tests `EntryLogEndpointTests.cs` (trigger behavior), `AccessControlTenantRulesTests.cs:125` (tenant-owner table list).
- **OWASP Forgot Password Cheat Sheet** (fetched 2026-09-19, https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) — HIGH: uniform responses/timing, single-use tokens, per-account rate limiting, no lockout on reset floods, never email the password.
- **OWASP Authentication Cheat Sheet** (fetched 2026-09-19, https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — HIGH: timing side-channels in auth responses, account-lockout tradeoffs, password storage guidance.
- **MySQL DATETIME/timezone behavior + .NET DateTime kind semantics** — MEDIUM (community-documented; consistent with the code paths read above).
- **Data-store unification / dedup patterns** — MEDIUM (industry practice; grounded here by the concrete ReportReadRepository dedupe-by-Id defect).

---
*Pitfalls research for: ControlEasy Reborn v2.1 — integrated visits flow, reports & history, password management (added to an existing multi-tenant system)*
*Researched: 2026-09-19*