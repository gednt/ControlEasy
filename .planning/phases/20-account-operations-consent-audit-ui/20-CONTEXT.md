# Phase 20: Account Operations & Consent Audit UI — Context

**Gathered:** 2026-09-24
**Status:** Ready for planning
**Source:** Party-mode planning session + v2.2 requirements (`milestones/v2.2-REQUIREMENTS.md`) + v2.0 consent-gatehouse spec + v2.1 password-reset decisions

<domain>
## Phase Boundary

Tenant administrators can run credential operations and review consent-audit evidence from their own tenant-reachable screens, without a platform-admin login. Two capabilities:
1. **Account operations** — TenantAdmin password-reset surface (ACCNT-01/02). Backend already shipped in v2.1 Phase 18; this phase adds the TenantAdmin-reachable UI caller and delivery feedback.
2. **Consent audit review UI** — filter/evidence/export for the consent audit log (CONSU-01/02/03). Backend `GET /api/v1/entry-log` + export shipped in v2.0 Phase 13; audit-review UI surface was pending.

**Sequencing note:** cleanup branches land first so audit state vocabulary matches the post-cleanup contract.
</domain>

<decisions>
## Implementation Decisions

### ACCNT-01 — TenantAdmin-reachable reset
- A TenantAdmin can reset another admin's or porteiro's password from the condominium management UI. The caller must sit behind a TenantAdmin-reachable guard (NOT platformAdmin-only). Backend reset endpoint exists from v2.1 Phase 18 (PASS-03); this phase wires the UI caller.
- BCrypt ≥ 11 for the temp/next password; enumeration-safe; refresh-token revocation on reset (already backend-shipped).

### ACCNT-02 — Delivery feedback + MustChangePassword
- Reset flow shows delivery feedback (temp password dispatched via SMTP).
- Reset user is forced to change password at next login (`MustChangePassword` re-armed).

### CONSU-01 — Consent audit filters
- Audit review UI: filter by date range, category, entry state, and porteiro.

### CONSU-02 — Evidence rendering
- `entered_with_consent` → photo thumbnail with lightbox.
- `entered_override` → highlighted with reason + porteiro.
- `gatehouse_only` → "no entry" badge; `denied` → "refused" badge.

### CONSU-03 — CSV export
- CSV export with millisecond-precision `recorded_at`.

### the agent's Discretion
- Exact placement of the reset surface within the condominium management UI.
- Whether audit review reuses existing `ce-audit-filters`/`ce-audit-row` components (Phase 13 shipped them) or extends them.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.specs/consent-gatehouse/requirements.md` — CONSENT-03 audit review & export contract (filter fields, evidence states, CSV ms precision).
- `src/Modules/Photos/.../Api/Endpoints/EntryLogEndpoints.cs` — `GET /api/v1/entry-log` (filters: date, category, state, porteiro) + export.
- `src/Web/ControlEasyReborn.Web/src/app/features/audit/audit.page.ts` — existing audit page.
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/audit-filters/`, `audit-row/` — existing audit filter/row components.
- `src/Web/ControlEasyReborn.Web/src/app/design-system/components/photo/photo-lightbox.component.ts` — lightbox for `entered_with_consent` thumbnail.
- Password reset backend: `src/Modules/Security/...` (v2.1 Phase 18). TenantAdmin permission string for the reset endpoint (research-flagged decision to confirm).

### Established Patterns
- DBTools only (no EF Core); minimal API endpoints; scoped handlers (no MediatR); Mapster; FluentValidation.
- ProblemDetails (RFC 7807); Serilog; BCrypt ≥ 11 (BCrypt.Net-Next 4.0.3).
- Angular standalone components, OnPush, signals, `ce-` prefix; generated OpenAPI client.

</code_context>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/milestones/v2.2-REQUIREMENTS.md` — ACCNT-01/02, CONSU-01/02/03
- `.planning/ROADMAP.md` — Phase 20 goal + success criteria

### Specs
- `.specs/consent-gatehouse/requirements.md` — CONSENT-03 audit review & export contract

### Prior phase decisions
- `.planning/milestones/v2.1-phases/18-password-management/` (read CONTEXT + SUMMARY if present) — PASS-03 backend reset contract, MustChangePassword, refresh-token revocation
- `STATE.md` — password-reset decisions + blockers (TenantAdmin permission string; IP-partitioned rate limit)

### Source of truth
- `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/TESTING.md`
- `AGENTS.md`

</canonical_refs>

<deferred>
## Deferred Ideas

- Webhook/WhatsApp temp-password delivery (Meta approval + per-tenant numbers) — deferred.
- Reset-token email links (temp-password machinery covers it).
- Custom override reason codes (hardcoded emergency/vouched only).
- Door integration, biometrics — other milestones.

</deferred>

---

*Phase: 20-account-operations-consent-audit-ui*
*Context gathered: 2026-09-24 via party-mode planning + v2.2 requirements*
