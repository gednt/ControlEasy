# Requirements: v2.1 Integrated Visits & Account Operations

**Defined:** 2026-09-19
**Milestone goal:** Make the gatehouse visit record single-sourced and complete — one data model, one operator panel, one honest ledger — then round out account operations (reports access, password recovery).

## v1 Requirements

### Visits Unification

- [ ] **VISIT-01**: Visitor QR scan creates or checks in a Visit row — an unmatched visitor scan creates a new Visit (CheckedIn) in the Visits table; a matching Pending visit is checked in; the AccessEvent references the VisitId; resident/vehicle scans remain AccessEvents-only
- [ ] **VISIT-02**: Gatehouse walk-in registration creates a Visit landing directly `CheckedIn` via `POST /api/v1/visits` (`CheckInNow: true`); `POST /api/v1/entry-log` is re-scoped to its privacy-consent audit role (no walk-in operational records); legacy ConsentAuditLog walk-ins remain a read-only ledger segment below a cutoff
- [ ] **VISIT-03**: Manual lookup of a visitor by document/name/apartment/block creates or checks in the Visit row (same behavior as QR path); manual resident/vehicle entries and walk-outs stay in AccessEvents
- [ ] **VISIT-04**: Unified Shift ledger stream — `GET /api/v1/reports/history` returns one chronological stream (Visits + visitor AccessEvents + legacy entry-log segment) with per-row native state stamps, source origin, and `kind` discriminator; no double-counting; tenant-predicated per UNION branch; server-side pagination
- [ ] **VISIT-05**: Refused scans and security events appear in the ledger as context rows with origin stamps, rendered in their native decision state (never coerced into Visit status enums)
- [ ] **VISIT-06**: Package-delivery visits (gatehouse-only destination) support an optional free-text description of what was delivered (e.g. "2 boxes", "florist bouquet"), captured at registration or edited later; the description shows on the ledger row and in visit history
- [ ] **VISIT-07**: Package-delivery visits carry structured carrier/courier codes (e.g. Correios, Sedex, carrier dropdown or code field) alongside the free-text description, filterable in the ledger and reports


### Gatehouse Panel & Reports

- [ ] **PANEL-01**: Consolidated gatehouse operator panel at `/gatehouse` — tabs composing existing components (scan QR, manual lookup, walk-in registration, open visits list); deep-link parity with existing `/gatehouse/qr` and `/gatehouse/manual` routes; follows the Shift Ledger design system
- [ ] **PANEL-02**: `/visits` demoted to admin management/reporting (pre-registration, edit, cancel); dashboard "Add visit" and "Record access" buttons repoint to the gatehouse panel
- [ ] **PANEL-03**: QR scan screen remembers camera direction (facingMode) in browser localStorage per device, reopening in the last-used orientation at each gate
- [ ] **PANEL-04**: `/reports` page with date ranges (Today/7d/30d/custom), visit counts by day, residents per apartment, unified history table, and CSV export (millisecond-precision pattern); consumes the generated OpenAPI report clients; the dashboard "Review reports and history" link resolves to it (dead-link fix)
- [ ] **PANEL-05**: Ledger filtering and server-side search on the unified stream (date, status, subject, destination, origin)

### Password Management

- [ ] **PASS-01**: Login-screen "Forgot my password" flow for admins (TenantAdmin, PlatformAdmin) — temporary password delivered via SMTP email; enumeration-safe (uniform response body + constant-cost decoy verify); rate-limited (named ASP.NET Core 8 policy partitioned on normalized email + durable per-account counter)
- [ ] **PASS-02**: Platform admin can reset any user's password from the condominium management page — generates a one-time temp password, re-arms `MustChangePassword`, revokes the user's refresh tokens, audit-logged; cross-tenant attempts get 403 (not 404)
- [ ] **PASS-03**: Tenant admin can reset their own gatekeepers' passwords — same temp-password + `MustChangePassword` + revocation semantics, scoped to own tenant
- [ ] **PASS-04**: Delivery safety — hashed temp password + delivery state (Pending/Sent/Failed) persisted in the same transaction as the hash change; idempotent resend re-delivers the same temp password; temp passwords never logged (redaction arch test); accounts never locked out in response to reset floods
- [ ] **PASS-05**: Password hashing uses BCrypt with work factor pinned explicitly ≥ 11; temp passwords generated via `RandomNumberGenerator.GetString` with an unambiguous charset (no 0/O/o, 1/l/I)

### Infrastructure

- [ ] **INFRA-01**: `IEmailSender` abstraction + MailKit SMTP adapter; Mailpit dev catch-all service in docker-compose (SMTP 1025 / UI 8025); demo mode sends nothing (`Demo.DisableOutboundEmail` no-op sender); SMTP config via environment variables
- [ ] **INFRA-02**: `Visits(tenant_id, CreatedAtUtc)` index migration; tenant-local day-boundary helper shared by ledger and reports (no UTC-vs-local "today" bugs)

## Future Requirements (deferred)

- Webhook / WhatsApp Business delivery channel for temp passwords (user-requested later; SMTP first)
- Photo attachment on package-delivery visits
- Pre-registration matching by CPF document at the gate
- Purpose codes feeding per-day breakdowns
- Resident-facing read-only visit history
- Visitor self-check-in via QR (seed candidate)
- Badge printing (hardware)

## Out of Scope

- Native WhatsApp Business API integration (Meta approval, per-tenant numbers)
- Reset-token email links (temp-password machinery covers it; avoids a second credential subsystem)
- Resident/vehicle QR scans folded into the Visits table (they remain AccessEvents facts shown as ledger context rows)
- Chart libraries / real-time chart push on reports (audit-first tables per the Shift Ledger design system)
- Cross-tenant report rollups
- Automatic retention/deletion timers on audit data

## Traceability

Filled by the roadmap (phase mapping below).

| Requirement | Phase | Status |
|-------------|-------|--------|
| (pending roadmap) | — | — |
