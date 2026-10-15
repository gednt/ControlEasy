# Requirements: ControlEasy Reborn — Milestone v2.4

**Defined:** 2026-09-23 (v2.4 planning session — BMAD party-mode session 6, autonomous)
**Updated:** 2026-10-15 (milestone start — party-mode gap-fill round + Codex adversarial scope review `.planning/notes/v2-4-codex-gap-review.md`; 18 findings closed into the decisions below)
**Core Value:** Gatehouse staff can reliably register and control access through a fast, tenant-isolated web UI.

## v2.4 Requirements

**Resident Self-Service & Visitor Experience.** The resident stops being a row in someone else's table. They get portal access scoped to their own apartment, pre-register expected visitors (identity, purpose, validity window, use budget), watch arrivals in their visit history, and receive in-app arrival notifications. Visitors self check-in at a supervised gatehouse self-service lane through a pre-authorization against the SAME unified write path the gatehouse uses. The porteiro sees pending pre-registrations at the gatehouse panel and prints badges for pre-authorized arrivals. Scope sourced from the v2.1 deferred requirements pool — zero external dependencies.

**Constitutional security bar (applies throughout):** BCrypt ≥ 11 for resident credentials; `ProblemDetails` (RFC 7807) errors; no EF Core — DBTools `Linq<TModel>`/`IAsyncSqlClient` only, raw SQL only for stored procs; no MediatR; minimal API endpoints only; all tenant-scoped reads/writes via `ITenantAwareLinqFactory`; Serilog structured logging. Resident authentication is the second-biggest credential-surface addition after door unlock: enumeration-safe login flows, uniform denials, apartment-scoped isolation integration tests mandatory, and self check-in MUST reuse the unified `VisitorArrivalHandler` write path (no second door into the Visits data model).

### Resident Access & Isolation

- [ ] **RES-01**: A TenantAdmin can provision resident portal access for a resident of an apartment (credential creation/activation) and suspend or revoke it — denial takes effect on the resident's **next request** via a per-request credential-status check (a stateless live JWT must not outlive suspension), and resident password recovery is TenantAdmin-reset only (no self-service forgot-password in v2.4)
- [ ] **RES-02**: A resident can log into the portal with their own credential (new resident role, same JWT machinery as staff, BCrypt ≥ 11, constant-cost verification with uniform enumeration-safe responses — unknown/wrong-password/inactive/revoked are indistinguishable from the outside)
- [ ] **RES-03**: Apartment-scoped, **occupancy-scoped** data isolation: a resident sees ONLY their current apartment's visitors, visits, and pre-registrations; cross-apartment access (e.g. resident of 101 reading 302's data) is denied and covered by integration tests on every resident-reachable endpoint; a resident JWT (or a staff token used from a resident session) must not satisfy existing staff endpoint authorization — see RES-13

### Visitor Pre-Registration

- [ ] **RES-04**: A resident can create a visitor pre-registration for their OWN apartment: full name, typed document number (CPF with check-digit validation, stored in a normalized canonical form; other doc types normalized to a typed canonical value), optional vehicle plate (**informational snapshot only** — no vehicle record linkage, no vehicle credential), purpose code, a validity window (start-inclusive / end-inclusive through end of the tenant-local day, on the Phase 19 tenant-day basis), and a **`max_uses`** budget (default 1, capped by a per-tenant configurable maximum set alongside purpose codes in admin settings)
- [ ] **RES-05**: A resident (any provisioned resident of the apartment — pre-registrations are **apartment-owned**, not creator-owned; creator/editor recorded for audit only) can edit a pending pre-registration or cancel it; cancelled, consumed (uses exhausted), and expired (window) pre-registrations become read-only history and reject further edits — expiry is **derived at read time** (no background sweep)
- [ ] **RES-06**: Purpose codes: a per-tenant configurable list (e.g. Visit, Delivery, Service, Maintenance) selectable at pre-registration and stamped on the resulting visit record — with **immutable code identity plus historical label snapshot** (renaming/deactivating a code never retroactively rewrites visit history, and pending pre-registrations referencing retired codes surface it explicitly)

### Visitor Self Check-In (Gatehouse Lane)

- [ ] **RES-07**: An arriving visitor can self check-in at the **gatehouse self-service lane** — a supervised, gatehouse-authenticated surface (no anonymous public API in v2.4): presentation of the pre-auth QR (`OpaqueTokenIssuer` 32-byte token, verifier-only persistence — not visitor-typable) or document match typed by the visitor — the resulting Visit is created through the unified `VisitorArrivalHandler` write path **bound to the pre-registration identity**, lands in the same states as a gatehouse check-in (this is **supervised admission**: it is physically at the gatehouse, and the existing consent policy runs unchanged — consent-required/override cases fall back to porteiro confirmation), records **actor kind `Visitor@Lane`** separately from staff identity (no fake porteiro attribution), and consumes/advances/notifies **atomically** (compare-and-consume with bounded idempotent replay inside the canonical transaction — a lost response or retry can neither double-admit nor falsely deny)
- [ ] **RES-08**: Denied self check-in paths (unknown code, expired window, revoked registration, exhausted use, consent-denied) return uniform enumeration-safe ProblemDetails that never disclose candidate identities or other parties' data, are rate-limited with partitioning on the **normalized document** (not raw IP — there is no `UseForwardedHeaders` in this codebase), and are audit-logged with **redaction**: no raw document values or token secrets in logs, errors, or denial audit rows (normalized value / fingerprint only)
- [ ] **RES-12**: Badge printing: at check-in (self-service lane or gatehouse), a printable badge is generated (visitor name, apartment, date, validity, QR credential) **reusing the existing `AccessCredential` machinery** (SubjectType=Visitor, SubjectId=Visit.Id, verifier-only QR, validity = pre-reg window ∩ open visit) via browser print — no printer hardware integration; **reprint is a new staff-authorized print** (no raw-token retrieval after issuance), and gatehouse-panel print trigger completes in Phase 30

### Resident Visibility & Notifications

- [ ] **RES-09**: A resident can view their apartment's visit history (past and expected visitors) — read-only, honest data from the same source the porteiro and reports use (the UNION read model extended with **per-branch apartment predicates**, layered on tenant predicates), with document values **masked** (last three digits; the porteiro surface shows the full value)
- [ ] **RES-10**: When a pre-registered visitor checks in (self or gatehouse), the resident's portal shows an **in-app arrival notification** backed by a durable row written in the same transaction as the check-in (no push/mobile-native — portal-only; unread badge clears per-unit on read; testable: after a committed check-in the poll returns the notification as unread, and a replayed/no-op arrival does not notify again)

### Gatehouse Integration

- [ ] **RES-11**: The gatehouse panel shows pending pre-registrations expected **today** (tenant-local day) with one-click check-in against the pre-authorization (same `VisitorArrivalHandler` path), and CPF/document matching surfaces the pending registration when a visitor arrives — with **porteiro disambiguation** when multiple pending registrations match across apartments (the system never auto-resolves into another apartment's visit)

### Cross-Cutting (added from the Codex review)

- [ ] **RES-13**: **Staff-endpoint deny matrix**: every existing staff-facing endpoint declares an explicit role policy (bare `authenticated` authorization is replaced by explicit staff/tenant-admin policies); a negative integration suite proves a resident JWT is **refused** on each existing endpoint class (tenant-wide visit lists, direct visit/detail reads, visit mutations, reports including caller-supplied `apartmentId` params), plus an architecture test requiring every new endpoint to declare an explicit policy;
- [ ] **RES-14**: **PII protection for all new personal-data surfaces**: resident-portal views show masked documents; no raw document values or credential secrets in logs, structured-log enrichment, error payloads, or denial audit rows; the PII **retention duration** is explicitly flagged as an open constitution-adjacent item (legal/product review owed — not invented here; masking + redaction requirements do not depend on it)

## v2.4+ Requirements (deferred)

### Post-v2.4 (carried from v2.1 deferred pool / future)

- **Visitor-phone self check-in** — deferred; gated on a visitor-facing delivery channel (WhatsApp/Meta approval + per-tenant numbers, or e-mail); an anonymous phone path is a new trust tier (public API, token bootstrap) deliberately out of scope while no delivery channel exists
- **Recurring visitor schedule patterns** (e.g. " maid Mon–Fri") — beyond `max_uses` inside a window; revisit if the per-tenant cap proves insufficient
- **Lista de banidos (banned-person registry)** — surfaced by v2.4 feature research as the strongest post-v2.4 candidate; composes with existing refused-scan machinery
- **WhatsApp/visitor notification delivery** — Meta approval + per-tenant numbers required (parked since v1)
- **Visitor self-service registration without pre-registration** — walk-in self-enrollment is a trust-model change; only pre-authorized self check-in ships in v2.4
- **DOOR-R1..R3**: Real vendor hardware drivers — concretized as milestone v2.5 (Control iD, Intelbras, Hikvision; Phases 31–34)
- **FUT-01**: Facial biometrics access method — requires separate approved specification
- **ARCH-01/02**: Multi-arch Docker/CI — fast-cycle work, no milestone

## Out of Scope

| Feature | Reason |
|---------|--------|
| Resident-facing mobile app / push notifications | v2.4 delivers in-app portal notifications only; responsive web / PWA is the platform standard |
| Visitor identity verification hardware / ID scanners | Self check-in matches entered data against the pending pre-registration; no scanner hardware |
| Un-registered walk-in visitor self-enrollment | Trust-model change; visitors without a pre-registration follow the existing gatehouse flow |
| Anonymous public visitor self check-in API (visitor's own phone) | New trust tier + no visitor-facing delivery channel exists in v2.4; party decision 2026-10-15 — supervised lane only |
| Vehicle plate → vehicle record linkage or vehicle credential | Plate captured at pre-registration is an informational normalized snapshot (F17) |
| Visitor badge exit / automatic visit close on exit scan | Checkout remains staff-only (existing VisitEndpoints operation); no overstay automation — explicit staff fallback covers recovery (F16) |
| Visitor self check-in creating new resident permissions | Self check-in uses the pre-authorization only; residents never delegate portal credentials |
| Badge printer hardware/ESC-POS integration | Browser print covers the need (party-mode session 6) |
| WhatsApp/SMS visitor arrival notifications | Meta approval + per-tenant numbers; parked since v1 |
| v2.2 milestone scope (LEDGER/ACCNT/CONSU/PCAP/UI/TEST) | Shipped (Phases 19–22) |
| v2.3 milestone scope (DOOR-01..15) | Shipped (Phases 23–26, audit `passed`) |
| Items fixed in merged worktrees (`feat/unified-visits-flow-cleanup` PR #11, `fix/gatehouse-direction-persistence` PR #10) | Merged to `main` 2026-09-26 (`7a5eb35`/`0d8f96a`) — already carried on main; v2.4 self check-in builds on the unified write path (post-cleanup contract) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RES-01 | Phase 27 | Pending |
| RES-02 | Phase 27 | Pending |
| RES-03 | Phase 27 | Pending |
| RES-13 | Phase 27 | Pending |
| RES-04 | Phase 28 | Pending |
| RES-05 | Phase 28 | Pending |
| RES-06 | Phase 28 | Pending |
| RES-14 | Phase 28 | Pending |
| RES-07 | Phase 29 | Pending |
| RES-08 | Phase 29 | Pending |
| RES-12 | Phase 29 | Pending |
| RES-09 | Phase 30 | Pending |
| RES-10 | Phase 30 | Pending |
| RES-11 | Phase 30 | Pending |

**Coverage:** v2.4 requirements: 14 total — mapped to phases 14/14 (Phases 27–30, v2.4); unmapped: 0. RES-14's redaction rules apply across Phases 28–30 surfaces; first surface (schema + masking hooks) lands in Phase 28.

---
*Requirements defined: 2026-09-23 — v2.4 planning session (party-mode session 6, autonomous)*
*Updated: 2026-10-15 — milestone start; party-mode gap-fill + Codex adversarial review decisions (RES-07/08/12 lifecycle contracts, RES-13 deny matrix, RES-14 PII protection)*
*Sources: v2.1 REQUIREMENTS.md deferred pool (CPF pre-reg matching, purpose codes, resident visit history, visitor self check-in, badge printing), PROJECT.md Key Decisions (v2.1 visits unification: one data model), AGENTS.md security bar, party-mode session 6 decisions (single write path, apartment-scoped isolation), `.planning/notes/v2-4-codex-gap-review.md` (F01–F18), `.planning/research/` (v2.4 landscape: STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY)*