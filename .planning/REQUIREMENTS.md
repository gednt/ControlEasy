# Requirements: ControlEasy Reborn — Milestone v2.4

**Defined:** 2026-09-23 (v2.4 planning session — BMAD party-mode session 6, autonomous)
**Core Value:** Gatehouse staff can reliably register and control access through a fast, tenant-isolated web UI.

## v2.4 Requirements

**Resident Self-Service & Visitor Experience.** The resident stops being a row in someone else's table. They get portal access scoped to their own apartment, pre-register expected visitors (identity, purpose, validity window), watch arrivals in their visit history, and receive in-app arrival notifications. Visitors self check-in through a pre-authorization against the SAME unified write path the gatehouse uses. The porteiro sees pending pre-registrations at the gatehouse panel and prints badges for pre-authorized arrivals. Scope sourced from the v2.1 deferred requirements pool (CPF pre-reg matching, purpose codes, resident visit history, visitor self check-in, badge printing) — zero external dependencies.

**Constitutional security bar (applies throughout):** BCrypt ≥ 11 for resident credentials; `ProblemDetails` (RFC 7807) errors; no EF Core — DBTools `Linq<TModel>`/`IAsyncSqlClient` only, raw SQL only for stored procs; no MediatR; minimal API endpoints only; all tenant-scoped reads/writes via `ITenantAwareLinqFactory`; Serilog structured logging. Resident authentication is the second-biggest credential-surface addition after door unlock: enumeration-safe login flows, uniform denials, apartment-scoped isolation integration tests mandatory, and self check-in MUST reuse the unified `VisitorArrivalHandler` write path (no second door into the Visits data model).

### Resident Access & Isolation

- [ ] **RES-01**: A TenantAdmin can provision resident portal access for a resident of an apartment (credential creation/activation) and suspend or revoke it — revocation takes effect on the resident's next request
- [ ] **RES-02**: A resident can log into the portal with their own credential (new resident role, BCrypt ≥ 11, enumeration-safe uniform responses, same JWT machinery as staff)
- [ ] **RES-03**: Apartment-scoped data isolation: a resident sees ONLY their own apartment's visitors, visits, and pre-registrations; cross-apartment access (e.g. resident of 101 reading 302's data) is denied and covered by integration tests

### Visitor Pre-Registration

- [ ] **RES-04**: A resident can create a visitor pre-registration for their apartment: full name, document number, optional vehicle plate, purpose code, and a validity window (start/end date)
- [ ] **RES-05**: A resident can edit a pending pre-registration or cancel it; cancelled and consumed pre-registrations become read-only history
- [ ] **RES-06**: Purpose codes: a per-tenant configurable list (e.g. Visit, Delivery, Service, Maintenance) selectable at pre-registration and stamped on the resulting visit record

### Visitor Self Check-In

- [ ] **RES-07**: An arriving visitor can self check-in with a pre-authorization (document match or pre-auth code) — the resulting Visit is created through the unified `VisitorArrivalHandler` write path and lands in the same states as a gatehouse check-in
- [ ] **RES-08**: Denied self check-in paths (unknown code, expired window, revoked registration, exhausted use) return uniform enumeration-safe ProblemDetails, are rate-limited per source, and are audit-logged

### Resident Visibility & Notifications

- [ ] **RES-09**: A resident can view their apartment's visit history (past and expected visitors) — read-only, honest data from the same source the porteiro and reports use
- [ ] **RES-10**: When a pre-registered visitor checks in (self or gatehouse), the resident's portal shows an in-app arrival notification (no push/mobile-native — portal-only)

### Gatehouse Integration

- [ ] **RES-11**: The gatehouse panel shows pending pre-registrations expected today with one-click check-in against the pre-authorization (same `VisitorArrivalHandler` path), and CPF/document matching surfaces the pending registration when a visitor arrives
- [ ] **RES-12**: Badge printing: at check-in (self-service or gatehouse), a printable badge is generated (visitor name, apartment, date, validity, QR credential) via browser print — no printer hardware integration

## v2.4+ Requirements (deferred)

### Post-v2.4 (carried from v2.1 deferred pool / future)

- **WhatsApp/visitor notification delivery** — Meta approval + per-tenant numbers required (parked since v2.1)
- **Visitor self-service registration without pre-registration** — walk-in self-enrollment is a trust-model change; only pre-authorized self check-in ships in v2.4
- **DOOR-R1..R3**: Real vendor hardware drivers (gated on real condominium hardware; v2.3+)
- **FUT-01**: Facial biometrics access method — requires separate approved specification
- **ARCH-01/02**: Multi-arch Docker/CI — fast-cycle work, no milestone

## Out of Scope

| Feature | Reason |
|---------|--------|
| Resident-facing mobile app / push notifications | v2.4 delivers in-app portal notifications only; responsive web / PWA is the platform standard |
| Visitor identity verification hardware / ID scanners | Self check-in matches entered data against the pending pre-registration; no scanner hardware |
| Un-registered walk-in visitor self-enrollment | Trust-model change; visitors without a pre-registration follow the existing gatehouse flow |
| Visitor self check-in creating new resident permissions | Self check-in uses the pre-authorization only; residents never delegate portal credentials |
| Badge printer hardware/ESC-POS integration | Browser print covers the need (party-mode session 6) |
| WhatsApp/SMS visitor arrival notifications | Meta approval + per-tenant numbers; parked since v2.1 |
| v2.2 milestone scope (LEDGER/ACCNT/CONSU/PCAP/UI/TEST) | Tracked in the parallel planned v2.2 milestone (Phases 19–22) |
| v2.3 milestone scope (DOOR-01..15) | Tracked in the parallel planned v2.3 milestone (Phases 23–26) |
| Items fixed in unmerged worktrees (`feat/unified-visits-flow-cleanup`, `fix/gatehouse-direction-persistence`) | Already carried by those branches; v2.4 self check-in builds on the unified write path (post-cleanup contract) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RES-01 | Phase 27 | Pending |
| RES-02 | Phase 27 | Pending |
| RES-03 | Phase 27 | Pending |
| RES-04 | Phase 28 | Pending |
| RES-05 | Phase 28 | Pending |
| RES-06 | Phase 28 | Pending |
| RES-07 | Phase 29 | Pending |
| RES-08 | Phase 29 | Pending |
| RES-09 | Phase 30 | Pending |
| RES-10 | Phase 30 | Pending |
| RES-11 | Phase 30 | Pending |
| RES-12 | Phase 29 | Pending |

**Coverage:** v2.4 requirements: 12 total — mapped to phases 12/12 (Phases 27–30, v2.4); unmapped: 0.

---
*Requirements defined: 2026-09-23 — v2.4 planning session (party-mode session 6, autonomous)*
*Sources: v2.1 REQUIREMENTS.md deferred pool (CPF pre-reg matching, purpose codes, resident visit history, visitor self check-in, badge printing), PROJECT.md Key Decisions (v2.1 visits unification: one data model), AGENTS.md security bar, party-mode session 6 decisions (single write path, apartment-scoped isolation)*