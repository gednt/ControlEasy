# Feature Research

**Domain:** Condominium access-control platform — integrated visits flow, reports & history page, password management (milestone v2.1)
**Researched:** 2026-09-19
**Confidence:** MEDIUM (external market patterns HIGH-MEDIUM via competitor product pages + OWASP; internal dependency claims HIGH from repo inspection)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One chronological visitor ledger (unified stream) | Every visitor-management product (Envoy, Sign In App) markets "replace the paper logbook with one digital record" as its core promise; operators treat the ledger as the source of truth for the shift | MEDIUM | Visits + visitor AccessEvents merged into one chronological stream in `ReportReadRepository` (`.planning/notes/integrated-visits-flow.md`). Each row: subject, destination, state stamp, timestamp, origin (QR / walk-in / pre-registered). Already partially built — extension, not rewrite |
| Per-row state stamps (Pending / CheckedIn / CheckedOut) | Operators scan a column of stamps, not prose. Envoy and Sign In App both render status as colored/stamped marks per visitor row | LOW | `VisitStatus` state machine already exists (`Pending → CheckedIn → CheckedOut`, `Visit.cs:58-80`). Ledger renders it as a brick/paper stamp per DESIGN.md. Reuses existing tokens |
| Walk-in registration from the operator panel | Walk-in sign-in with captured fields is the base use case of every VMS; the operator must register a person standing at the desk in <30s | MEDIUM | Route walk-ins through Visits module landing as direct `CheckedIn` (person is physically present — Pending is for pre-registered, not-yet-arrived visitors). Reuse `VisitCreateModalComponent`. `POST /api/v1/entry-log` keeps only ConsentAuditLog duty |
| QR scan → Visit creation/check-in for visitors | Pre-registration + QR check-in is standard VMS behavior (Sign In App pre-register w/ QR, Envoy QR codes); an unmatched visitor QR creating no ledger row breaks the "one record" promise | MEDIUM | Extend `RecordAccessScanHandler`: visitor-subject scan with no matching Pending visit creates a `CheckedIn` Visit; a match gets `IVisitDirectory.CheckInAsync`. Resident/vehicle scans unchanged (stay AccessEvents-only) |
| Filtering + search in the ledger/history | Sign In App's portal explicitly ships "complete visitor history with advanced search and filtering"; operators filter by name, date, status, destination | MEDIUM | Server-side filters on the unified stream: date range, status, subject name/document, destination apartment, origin (QR/walk-in/manual). Existing `Linq<TModel>` + tenant factory patterns apply |
| Date range on reports | Reports without date ranges are unusable for monthly/weekly questions; every SaaS reporting page has preset + custom ranges | LOW | Presets (Today / 7d / 30d / custom) feeding the same query layer; MySQL `date` indexes on Visits timestamps |
| CSV export from reports | Audit-readiness is the #1 stated reason for VMS reports (Envoy: "exportable reports just a few clicks away"); ControlEasy already shipped CSV export for consent/entry data with millisecond-precision timestamp format | MEDIUM | Reuse the existing Phase-13 CSV export pattern (`yyyy-MM-dd HH:mm:ss.fff`). Same tenant-scoping rules. Feeds syndic/accounting workflows |
| Per-apartment breakdown | Condominium-specific expectation: administrators think in units ("who visits 302-B?"); reports without unit grouping feel foreign to the domain | MEDIUM | Group-by destination apartment on visit counts; also "residents per apartment" already derivable from Residents module |
| Forgot-my-password on login screen (admins only) | Self-service recovery is universal in SaaS login screens; administrators locked out with no path = support burden and dead-end UX | MEDIUM | Settled approach (PROJECT.md decision 2026-09-19): temp password emailed via SMTP, admins only. Follow OWASP Forgot Password rules (below). Gatekeeper self-reset explicitly deferred |
| Admin reset for any user (platform admin) / own gatekeepers (tenant admin) | Standard IdP behavior (ASP.NET Identity, Okta, Entra): scoped admins reset their own users; super admins reset anyone | LOW-MEDIUM | Reuses tenant staff lifecycle patterns already shipped (`55377a0`). Tenant isolation enforced via `ITenantAwareLinqFactory`; platform admin crosses tenants by design |
| One-time temp password + forced change on next login | Universal expectation: after admin reset, the user MUST change the password at first login (Microsoft Identity, Okta, Entra all do this) | LOW | `MustChangePassword` re-armed (mechanism exists from tenant staff lifecycle temp-password flow); one-time temp passwords |
| Enumeration-safe forgot-password responses | OWASP Forgot Password Cheat Sheet: consistent message and uniform response time whether or not the account exists | LOW | Same generic response ("If the account exists, an email was sent"), same handler path, per-account rate limiting |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Shift handover trail with handover interaction | DESIGN.md's north star: "a resolved row travels from the active ledger into the chronological handover trail" — no surveyed VMS product offers a first-class *handover* surface; it's a porteiro-specific mental model legacy WPF had ("switch accounts without restarting") | MEDIUM | The unified ledger finally feeds this. Ruled rows, tab dividers, mono labels per DESIGN.md Shift Ledger spec. Signature interaction already specified in design system (`handover-transfer` motion token) |
| Unified stream includes refused scans / security events as ledger context | Envoy/Sign In App separate "visitor log" from "security events"; merging them in one operator stream (with origin stamps: QR / walk-in / manual / refused) is honest-to-the-desk UX the incumbents don't offer | LOW | Already decided: Visits + visitor AccessEvents as one stream. Distinguish stamp classes so security events read as audit, not operations |
| Pre-registration matching by document (CPF) at walk-in | Incumbents match pre-registrations by QR/email; matching by document number is the Brazilian condominium convention (porteiro asks for CPF). Turns the pre-registered list into an instant lookup | LOW-MEDIUM | `LookupSubjectHandler` already searches Pending visits; extend match key to document/CPF on the Visits row. Fallback to manual lookup already exists |
| Walk-in purpose codes / visit-type stamps | Purpose classification enables the per-day report breakdown and syndic queries ("delivery people vs guests"); incumbents ship "customizable sign-in flows" per visitor type | LOW | Reuse Visits existing category/destination metadata; add purpose field only if Visits lacks it. Feeds reports grouping |
| "On-site now" live occupancy count | Sign In App's portal leads with a real-time "Today" view of current occupancy across visitor groups; operators check who is still inside | LOW | Derivable from `CheckedIn` minus `CheckedOut` on today's Visits — already an open-visits stat in dashboard; surface in gatehouse panel header |
| Reports unified history view (visits + access events + consent in one query) | ControlEasy-specific: the whole value of the v2.1 data unification is that one page can answer "everything that happened at this gate" — incumbent products need 3 modules for this | MEDIUM | Depends on ledger read model (same read repo). Report page consumes OpenAPI-generated report clients (idle clients exist per PROJECT.md) |
| Resident-facing visit visibility (residents see who checked in for them) | Incumbents notify hosts on check-in (Envoy host notifications); ControlEasy residents currently only appear in records. A read-only "my unit's visits" view is high resident value, low cost once data is unified | LOW-MEDIUM | Requires only a tenant-scoped read endpoint filtered by destination apartment; resident role routing already exists (post-login role routing spec) |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Over-charted reports dashboard (many chart types, pies, gauges, sparklines per row) | "Reports page should look impressive" | DESIGN.md explicitly rejects "generic analytics dashboard" aesthetics; charts multiply maintenance and testing surface, and operators trust tables/stamps over charts. SIGN In App keeps charts subordinate to tables; Envoy's analytics is a separate paid module | Audit-first layout: filterable table + export + max 1-2 summary aggregates (counts by day, per-apartment table). Charts only if a syndic asks |
| Real-time websocket chart updates on reports | "Live graphs look modern" | Real-time push on a historical-analysis page adds infrastructure (signal channels) for zero operator value; the live stream belongs to the dashboard/gatehouse panel | Static reports with explicit date ranges; refresh button; keep real-time in Shift ledger only |
| Badge printing | Enterprise VMS table stakes (Envoy, Sign In App) | Requires printer hardware integrations, driver matrix, label stock; no condominium hardware contract exists (same reason camera hardware was delegated to the condominium in v2.0). High cost, low condominium demand | Visitor QR pass / destination stamp in the ledger; defer badge printing until a real condominium requests it (v2.2+ hardware track) |
| Password reset via reset-token links (email URL tokens) | The modern default; OWASP calls URL tokens "the simplest and fastest implementation" | ControlEasy settled on SMTP temp passwords for admins (PROJECT.md 2026-09-19): the target audience is admin staff with managed inboxes, token-link roundtrip adds a frontend reset page + token storage + expiry UI for a flow already covered by the existing temp-password + `MustChangePassword` mechanism from staff lifecycle | Temp password email (one-time, forced change re-armed) — matches existing tenant staff lifecycle machinery; revisit token links if gatekeeper self-service is ever added |
| Self-registration / visitor self-service portals | Trendy in hotel-style VMS | Condominium visitors don't self-register; the porteiro registers. Self-service multiplies attack surface (anonymous data entry into tenant-scoped tables) | Pre-registration by residents/admins via existing `/visits` page |
| Cross-tenant reporting rollups | Platform admin "sees everything" appeal | Violates tenant isolation spirit; `ITenantAwareLinqFactory` guardrails exist for good reason; a rollup invites accidental cross-tenant leakage into generated DTOs | Platform admin reports stay per-tenant (select the condominium, then scoped data) |
| Automatic visitor data retention/deletion timers | GDPR-flavored request | Condominiums need audit history (CCTV cross-reference by timestamp is a stated pattern); auto-delete breaks the append-only audit philosophy already established (ConsentAuditLog, AccessEvents) | Explicit admin-triggered archival/export; retention policy decisions belong to tenant admins |

## Feature Dependencies

```
[Unified Shift ledger (Visits + AccessEvents stream)]
    └──requires──> [One data model: walk-ins → Visits rows]
                          └──requires──> [Visitor QR scan → Visit creation/check-in]

[Reports & history page /reports]
    └──requires──> [One data model (Visits as single operational record)]
    └──requires──> [Unified ledger read model (ReportReadRepository extension)]
    └──enhances──> [CSV export (reuse Phase-13 pattern)]

[Gatehouse panel consolidation]
    └──requires──> [Visitor QR scan → Visit]
    └──requires──> [Walk-in → Visits]

[Password self-service (admins)]
    └──requires──> [SMTP delivery (new dependency)]
    └──requires──> [MustChangePassword mechanism (exists from staff lifecycle)]
    └──independent of──> [Visits unification + Reports]   (parallel track)

[Admin reset (platform + tenant scoped)]
    └──requires──> [MustChangePassword + one-time temp password (exists)]
    └──requires──> [Audit logging of reset actions]

[Badge printing] ──conflicts──> [Hardware-free v2.x constraint]
[Purpose codes] ──enhances──> [Reports per-day breakdown]
```

### Dependency Notes

- **Unified ledger requires one data model:** the ledger currently reads `Visits + ConsentAuditLog` and misses QR scans entirely (`.planning/notes/integrated-visits-flow.md`); without walk-ins and visitor QRs landing in Visits, the unified stream is a lie. Order: QR→Visit and walk-in→Visit must land before ledger extension is meaningful.
- **Reports page depends on ledger read model:** `/reports` consumes the same `ReportReadRepository` extension the Shift ledger uses; building reports first would force a second read-model refactor.
- **Password management is an independent track:** no data dependency on visits; can be phased in parallel or as its own phase without blocking.
- **MustChangePassword already exists:** tenant staff lifecycle (commit `55377a0`) shipped temp-password creation with the forced-change flag — the password features are mostly re-arm + SMTP + UI, not new auth machinery.
- **Badge printing conflicts with hardware-free constraint:** v2.0 settled "browser-only, client-side compression; cameras belong to the condominium" — the same logic applies to badge printers.

## MVP Definition

### Launch With (v1 — this milestone)

- [ ] Visitor QR scan → Visit create/check-in — makes the ledger honest; unmatched scans currently invisible
- [ ] Walk-in registration → Visits (direct `CheckedIn`) — collapses the entry-log silo; ConsentAuditLog reverts to privacy role
- [ ] Unified Shift ledger read model (Visits + visitor AccessEvents) — the dashboard's honest stream and the reports page's data source
- [ ] Consolidated gatehouse panel at `/gatehouse` (scan, manual, walk-in, check-in/out) — one operator surface; `/visits` becomes admin management/reporting
- [ ] `/reports` page with date range, visit counts by day, residents per apartment, unified history table + CSV export — fixes dead `/reports` link (dashboard.page.ts:178)
- [ ] Forgot-my-password on login (admins only, temp password via SMTP, enumeration-safe, rate-limited)
- [ ] Admin reset: platform admin → any user; tenant admin → own gatekeepers (one-time temp password, `MustChangePassword` re-armed, audit-logged)

### Add After Validation (v1.x)

- [ ] Purpose codes / visit-type stamps — trigger: syndics asking to segment guest vs delivery traffic in reports
- [ ] Pre-registration matching by document key — trigger: porteiro workflow feedback that CPF lookup beats name lookup
- [ ] "On-site now" occupancy counter surfaced on gatehouse panel — trigger: operator demand for roll-call during drills
- [ ] Resident-facing visit history (read-only, own unit) — trigger: resident feature requests once data unified

### Future Consideration (v2+)

- [ ] Badge printing — defer: hardware integrations, no condominium demand signal yet
- [ ] Reset-token link flow for gatekeeper self-service — trigger: gatekeeper churn creating admin reset burden
- [ ] Host/resident notifications (email/push) on check-in — trigger: after resident-facing surface exists
- [ ] Scheduled report email digests — trigger: syndic workflow maturity

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Visitor QR → Visit create/check-in | HIGH | MEDIUM | P1 |
| Walk-in → Visits (direct CheckedIn) | HIGH | LOW-MEDIUM | P1 |
| Unified Shift ledger stream | HIGH | MEDIUM | P1 |
| Consolidated gatehouse panel | HIGH | MEDIUM | P1 |
| Ledger filtering + search | HIGH | MEDIUM | P1 |
| `/reports` page (date range, counts, history, CSV) | HIGH | MEDIUM | P1 |
| Forgot-my-password (admins, SMTP) | HIGH | MEDIUM | P1 |
| Admin reset (platform/tenant scoped) | HIGH | LOW-MEDIUM | P1 |
| State stamps + handover interaction polish | MEDIUM | LOW | P2 |
| Purpose codes | MEDIUM | LOW | P2 |
| Pre-registration document matching | MEDIUM | LOW-MEDIUM | P2 |
| "On-site now" counter | MEDIUM | LOW | P2 |
| Resident visit visibility | MEDIUM | LOW-MEDIUM | P3 |
| Badge printing | LOW | HIGH | P3 |
| Real-time report charts | LOW | MEDIUM | P3 (anti-feature — avoid) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Envoy (workplace VMS leader) | Sign In App (mid-market VMS) | Our Approach |
|---------|------------------------------|------------------------------|--------------|
| Visitor log | Central audit-ready visitor log, exportable reports | Online portal with history, advanced search/filter, CSV export | Unified Shift ledger = Visits + visitor AccessEvents, one chronological stream, per DESIGN.md |
| Walk-in registration | Kiosk/tablet sign-in with custom fields | Mobile/kiosk sign-in with custom fields | Gatehouse operator panel walk-in → direct `CheckedIn` Visit |
| Pre-registration | Invites, QR codes, group invites | Branded email invites + QR, bulk CSV import | Existing `VisitCreateModalComponent` pre-registration; QR scan matches/creates |
| Identity verification | ID scanning, blocklists, watchlists | ID scan & identity match, global block list | Manual lookup by CPF/document/name/apartment (exists); pre-registered visit matching; blocklist out of scope |
| Badge printing | Yes (photos, timestamps, host names) | Yes (templates, custom designs) | Anti-feature for now — QR pass + ledger stamps instead |
| State visibility | Visitor log w/ status; occupancy analytics | Real-time "Today" view; activity dashboard | Shift ledger state stamps (Pending/CheckedIn/CheckedOut) + open-visits count |
| Host notifications | Core feature (email/SMS/Slack/Teams) | Core feature (email/SMS/Teams/Slack) | Deferred — residents see records; notifications are v1.x+ |
| Handover | Not a concept (single-tenant desk) | Not a concept | Differentiator: chronological handover trail per DESIGN.md — porteiro-native |
| Reports | Occupancy analytics, scheduled custom reports | Reporting feature, CSV export | Audit-first: date ranges, per-apartment breakdown, counts by day, CSV; 1-2 aggregates max |
| Password self-service | Enterprise SSO; admin-managed | Portal login with admin reset | SMTP temp password (admins only) + scoped admin resets; OWASP enumeration-safe rules |

## Sources

- Envoy Visitors product page — visitor log, audit trail, badge creation, occupancy analytics, customizable sign-in, ID verification, host notifications (https://envoy.com/products/visitors, fetched 2026-09-19)
- Sign In App features — portal history w/ search + filters + export, pre-registration, visitor photos, badges, custom data fields, reporting, evacuations (https://signinapp.com/features, fetched 2026-09-19)
- OWASP Forgot Password Cheat Sheet — enumeration-safe flows, URL tokens vs temp passwords, single-use/expiring tokens, rate limiting, no lockout, no auto-login (https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html, fetched 2026-09-19)
- Microsoft Learn — ASP.NET Core Identity: lockout, password policy, security-stamp invalidation (`UpdateSecurityStampAsync` = sign-out-everywhere pattern for admin resets) (https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-configuration, fetched 2026-09-19)
- Repo-internal (HIGH confidence): `.planning/notes/integrated-visits-flow.md` (settled v2.1 decisions), `.planning/todos/pending/integrated-visits-flow.md` (task decomposition), `DESIGN.md` Shift Ledger north star + motion tokens, `PROJECT.md` Key Decisions (v2.1 password: SMTP temp password for admins, one-time, MustChangePassword re-armed), Phase-13 CSV export pattern, tenant staff lifecycle commit `55377a0`

---
*Feature research for: condominium access-control — integrated visits, reports, password management*
*Researched: 2026-09-19*