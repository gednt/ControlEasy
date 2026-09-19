# Roadmap: ControlEasy Reborn

**Active milestone:** 🚧 v2.1 — Integrated Visits & Account Operations (started 2026-09-19)

**Milestone goal:** Make the gatehouse visit record single-sourced and complete — one data model (Visits), one operator panel, one honest ledger — then round out account operations: a reports & history page (fixing the dead `/reports` dashboard link) and password recovery for administrators and gatekeepers.

**Phase numbering:** continuous across milestones. v1.0 shipped Phases 1–8; v1.1 shipped Phases 9–10; v2.0 shipped Phases 11–13. Phases 14–15 are **reserved for v2.2 Door Integration** (gated on hardware). This milestone starts at **Phase 16**.

## Archived Milestones

- ✅ **v2.0 — Gatehouse Photo & Consent Ledger** (2026-09-13) — [archive](milestones/v2.0-ROADMAP.md) · [requirements](milestones/v2.0-REQUIREMENTS.md) · [audit](v2.0-MILESTONE-AUDIT.md)
- ✅ **v1.0 — Modular Monolith MVP** — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — UI & Dashboard** — included in v1.0 archive (Phase 9 partial + Phase 10 shipped)

## Phases

🚧 **v2.1 — Integrated Visits & Account Operations**

- [ ] **Phase 16: Visits Unification Backend** - Visitor QR scans and walk-ins land as Visit rows; entry-log re-scoped; unified ledger read model lands with the write-path fold (no double-counting window)
- [ ] **Phase 17: Gatehouse Panel + Reports Page** - Consolidated `/gatehouse` operator panel, `/reports` route fixing the dead dashboard link, ledger filtering/search, CSV export
- [ ] **Phase 18: Password Management** - Enumeration-safe forgot-password for admins (SMTP temp password), scoped admin resets, durable delivery-state machinery

## Phase Details

### Phase 16: Visits Unification Backend

**Goal**: The gatehouse visit record is single-sourced — every visitor arrival (QR scan, manual lookup, walk-in) produces or advances a Visit row, and the backend serves one honest chronological ledger stream without double-counting
**Depends on**: Nothing (first phase of milestone; builds on shipped Phases 11–13 Photo/Consent infrastructure and qr-entrance-exit-access)
**Requirements**: VISIT-01, VISIT-02, VISIT-03, VISIT-04, VISIT-05, VISIT-06, VISIT-07, INFRA-02
**Success Criteria** (what must be TRUE):

  1. An unmatched visitor QR scan creates a new Visit row (CheckedIn) and the resulting AccessEvent references that VisitId; a matching Pending visit is checked in — no visitor scan vanishes (VISIT-01)
  2. A gatehouse walk-in registered via `POST /api/v1/visits` with `CheckInNow: true` lands directly `CheckedIn`, and `POST /api/v1/entry-log` no longer produces walk-in operational records (re-scoped to its privacy-consent audit role, with legacy rows preserved read-only below a ledger cutoff) (VISIT-02)
  3. A manual lookup of a visitor by document/name/apartment/block creates or checks in the same Visit row as the QR path; manual resident/vehicle entries and walk-outs still record as AccessEvents only (VISIT-03)
  4. `GET /api/v1/reports/history` returns one chronological stream (Visits + visitor AccessEvents + legacy entry-log segment) with per-row native state stamps, source origin, and `kind` discriminator — counted exactly once per real-world entry, tenant-predicated per UNION branch, server-side paginated; refused scans and security events appear as context rows in their native decision state, never coerced into Visit status enums (VISIT-04, VISIT-05)
  5. A package-delivery visit carries an optional free-text description and a structured carrier code; both show on ledger rows, appear in visit history, and carrier codes are filterable in the ledger and reports (VISIT-06, VISIT-07)

**Plans**: 1/3 plans executed

Plans:

- [x] 16-01-PLAN.md — Visitor write-path fold: shared VisitorArrivalHandler (QR/manual/walk-in), migration 14 (Visits index + AccessEvents package columns), TenantDayBoundary helper
- [ ] 16-02-PLAN.md — Package drops as AccessEvents PackageDrop rows (description + carrier code, optional apartment destination, no Visit rows)
- [ ] 16-03-PLAN.md — Unified honest ledger: GET /api/v1/reports/history (single UNION, native stamps, pagination + filters) and entry-log consent-only re-scope

**UI hint**: no

### Phase 17: Gatehouse Panel + Reports Page

**Goal**: Gatehouse operators work from one consolidated panel, and administrators get a real `/reports` page — the dead dashboard handover link resolves, the unified ledger is filterable and exportable
**Depends on**: Phase 16 (consumes the settled API shapes: history UNION endpoint, visit create/check-in)
**Requirements**: PANEL-01, PANEL-02, PANEL-03, PANEL-04, PANEL-05
**Success Criteria** (what must be TRUE):

  1. A gatehouse operator opens `/gatehouse` and works from tabs composing existing components (scan QR, manual lookup, walk-in registration, open visits list); the existing `/gatehouse/qr` and `/gatehouse/manual` deep links still land in the right tab (PANEL-01)
  2. `/visits` serves admin pre-registration/edit/cancel, and the dashboard "Add visit" and "Record access" buttons open the gatehouse panel instead of the old flow (PANEL-02)
  3. Reopening the QR scan screen on the same device restores the last-used camera orientation (facingMode persisted per device in localStorage) (PANEL-03)
  4. An administrator clicks the dashboard "Review reports and history" link and lands on `/reports` (inside the auth guard — dead-link fixed), where they can pick Today/7d/30d/custom ranges, see visit counts by day, residents per apartment, and the unified history table with CSV export using the millisecond-precision pattern (PANEL-04)
  5. Filtering the ledger by date, status, subject, destination, or origin queries the server (server-side search) and returns matching rows (PANEL-05)

**Plans**: TBD

Plans:

- [ ] 17-01: TBD

**UI hint**: yes

### Phase 18: Password Management

**Goal**: Administrators can always recover or reset credentials — self-service forgot-password for admins via SMTP, scoped admin resets, one-time temp passwords that force a change — with enumeration-safe and rate-limited semantics; independent of Phases 16–17 and parallel-safe
**Depends on**: Nothing (independent of Phases 16–17; parallel-safe by design)
**Requirements**: PASS-01, PASS-02, PASS-03, PASS-04, PASS-05, INFRA-01
**Success Criteria** (what must be TRUE):

  1. A locked-out admin clicks "Forgot my password" on the login screen and receives a temporary password by email (SMTP); the response is identical whether or not the email exists (uniform body + constant-cost decoy verify), and repeat requests hit a rate limit partitioned on normalized email plus a durable per-account counter (PASS-01)
  2. A platform admin resets any user's password from the condominium management page — one-time temp password issued, `MustChangePassword` re-armed, refresh tokens revoked, action audit-logged; a tenant admin resets their own gatekeepers only; cross-tenant attempts get 403, not 404 (PASS-02, PASS-03)
  3. If SMTP delivery fails, the hashed temp password plus delivery state (Pending/Sent/Failed) was already persisted in the same transaction as the hash change; an idempotent resend re-delivers the same temp password; temp passwords never appear in logs (redaction arch test); flood requests never lock the account out (PASS-04)
  4. Password hashing uses BCrypt with work factor explicitly pinned ≥ 11, and temp passwords are generated from an unambiguous charset (no 0/O/o, 1/l/I) via `RandomNumberGenerator.GetString` (PASS-05)
  5. In dev, emails land in Mailpit (SMTP 1025 / UI 8025 via docker-compose); demo mode sends nothing (no-op sender behind `Demo.DisableOutboundEmail`); SMTP config comes from environment variables through the `IEmailSender` abstraction (INFRA-01)

**Plans**: TBD

Plans:

- [ ] 18-01: TBD

**UI hint**: yes

## Progress

**Execution Order:**
Phases 16 and 18 can start in parallel (18 has zero data dependency on 16); Phase 17 executes after 16.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 16. Visits Unification Backend | 1/3 | In Progress|  |
| 17. Gatehouse Panel + Reports Page | 0/TBD | Not started | - |
| 18. Password Management | 0/TBD | Not started | - |

## Future Milestones

- 📋 **v2.2 — Door Integration** (Phases 14, 15 — reserved; gated on real condominium hardware)
- 📋 Multi-arch Docker/CI (fast-cycle, no milestone)
