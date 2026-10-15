---
status: draft
milestone: v2.4
reviewer: Codex
reviewed: 2026-10-15
---

# v2.4 adversarial scope gap review

## Executive verdict

**NO-GO — freeze is blocked by an undefined visitor trust boundary, existing authenticated-only staff APIs that would admit resident JWTs, and tenant-wide arrival deduplication that can resolve the wrong apartment.**

This is a scope/design review, not a runtime penetration test. Code evidence is from commit `45b9767`; missing decisions are distinguished from confirmed implementation seams. No application code was changed or executed. Each closure below must become an explicit acceptance criterion, not an implementation assumption.

## Evidence path key

Paths below are repository-relative. To keep citations legible, these aliases denote exact files:

- `Arrival`: `src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Handlers/VisitorArrivalHandler.cs`
- `VisitDirectory`: `src/Modules/Visits/ControlEasyReborn.Modules.Visits.Infrastructure/Persistence/VisitDirectoryRepository.cs`
- `Visit`: `src/Modules/Visits/ControlEasyReborn.Modules.Visits.Domain/Entities/Visit.cs`
- `VisitEndpoints`: `src/Modules/Visits/ControlEasyReborn.Modules.Visits.Api/Endpoints/VisitEndpoints.cs`
- `ReportEndpoints`: `src/Modules/Reports/ControlEasyReborn.Modules.Reports.Api/Endpoints/ReportEndpoints.cs`
- `JWT`: `src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/JwtTokenService.cs`
- `Login`: `src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/LoginHandler.cs`
- `TenantMiddleware`: `src/BuildingBlocks/ControlEasyReborn.Infrastructure/MultiTenancy/TenantResolutionMiddleware.cs`
- `Host`: `src/Host/ControlEasyReborn.Api/Program.cs`
- `Resident`: `src/Modules/Residents/ControlEasyReborn.Modules.Residents.Domain/Entities/Resident.cs`
- `Credential`: `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Domain/Entities/AccessCredential.cs`
- `CredentialLifecycle`: `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/CredentialLifecycleHandlers.cs`
- `TokenIssuer`: `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Infrastructure/Services/OpaqueTokenIssuer.cs`
- `Scan`: `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordAccessScanHandler.cs`
- `Routes`: `src/Web/ControlEasyReborn.Web/src/app/app.routes.ts`

## Numbered findings

### 1. F01 — Self check-in has no defined entry point or tenant trust bootstrap

- **Severity:** P0 blocker
- **Reference:** RES-07/08; Phase 29 success criteria 1/3.
- **What breaks:** A visitor's phone on a public link and a supervised gatehouse kiosk require different authentication, disclosure, printing, and session-clearing designs. A public document-only endpoint treats a commonly known identifier as authorization. Client-selected tenant/apartment IDs cannot establish trusted scope. An anonymous request currently has no tenant context; merely adding `AllowAnonymous` does not make tenant-aware queries work safely.
- **Evidence:** `.planning/REQUIREMENTS.md:26-27` says only “document match or pre-auth code.” `.planning/ROADMAP.md:277-283` supplies no route, device, session, or tenant bootstrap. `TenantMiddleware:23-28` skips anonymous users; `TenantMiddleware:37-64` derives context from authenticated claims.
- **Resolution:** **Which ships: supervised kiosk, visitor phone, or both?** Specify the route, tenant binding, token delivery, authentication of kiosk devices if any, success-response disclosure, and browser-session cleanup. Recommend opaque scoped authorization on public phones; document lookup alone must not authorize public admission. Test missing/forged tenant scope and a token from another tenant before any lookup or mutation.

### 2. F02 — Adding a Resident role opens legacy staff APIs unless they are explicitly re-gated

- **Severity:** P0 blocker
- **Reference:** RES-02/03; Phase 27 success criteria 2-4.
- **What breaks:** New apartment-scoped portal endpoints do not protect existing tenant-wide endpoints. A resident JWT would satisfy plain `RequireAuthorization()`, permitting tenant-wide visit listing, direct visit ID reads, creation/check-in/checkout, and unscoped reports unless authorization is hardened. Hiding menus is not a fix.
- **Evidence:** `VisitEndpoints:15-16,19-76` uses authenticated-only authorization and never derives apartment membership. `ReportEndpoints:14-16,29-49` accepts optional caller-supplied `apartmentId`. `Routes:26-33,66-69,85-113` exposes multiple pages under only the shell's auth guard. `.planning/ROADMAP.md:249` does not explicitly require a deny matrix over existing staff routes.
- **Resolution:** Require an explicit staff-versus-resident endpoint policy inventory in Phase 27. Existing staff APIs must deny resident-only tokens; resident APIs derive scope server-side, including detail IDs, list counts, exports, and mutation paths. Define what a mixed-role token may do. Add negative integration tests against existing APIs, not just new portal APIs.

### 3. F03 — The required arrival handler can resolve another apartment's visit

- **Severity:** P0 blocker
- **Reference:** RES-03/06/07/09/10; Phase 29 criterion 1.
- **What breaks:** A pre-registration for apartment 101 with the same document as a Pending or CheckedIn visit to 302 selects the latter. The Pending branch checks it in without changing destination or purpose; the CheckedIn branch returns it unchanged. Naively consuming the 101 authorization can expose 302's visit/badge, notify the wrong household, or falsely report success. Reusing the handler is not proof of apartment isolation.
- **Evidence:** `Arrival:12-23` has no pre-registration identity; `Arrival:54-65` looks up only tenant/document and ignores the command destination/purpose when reusing a row. `VisitDirectory:38-54` queries by document and picks latest creation time, with no apartment or authorization discriminator. `.planning/PROJECT.md:187-188` mandates both unified arrival and apartment isolation.
- **Resolution:** **Can one person have simultaneous visits to different apartments, or must staff resolve the conflict?** Bind authorization ID, resulting VisitId, destination, and purpose explicitly within the canonical path. Reject ambiguous/conflicting results without returning another apartment's data. Add same-document/different-apartment Pending and CheckedIn tests; keep one write path rather than bypassing it.

### 4. F04 — Single-use is specified, but recurring/multi-use behavior is not explicitly excluded

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-04/05/08; Phase 28 criterion 4; Phase 29 criterion 2.
- **What breaks:** A validity window is compatible with single use; it does not itself promise recurrence. However, “exhausted use” plus multi-day windows invites implementations and users to assume repeated service visits. Phase 29 explicitly says “cannot be reused.” A maid's second arrival will therefore fail unless repeat authorizations are separately modeled. Adding an unstated `max_uses` later changes the lifecycle and database contract.
- **Evidence:** `.planning/REQUIREMENTS.md:20-27`; `.planning/ROADMAP.md:265,278` specifies pending → consumed and consumed-on-use, not recurrence, reset cadence, or a use counter.
- **Resolution:** **Is v2.4 strictly one arrival per authorization, or bounded recurring access?** Prefer explicitly documenting single-use windows and deferring recurrence unless required now. If multi-use is selected, define max uses, per-day limits, re-entry, cancellation after partial consumption, and exhaustion transitions, with boundary tests.

### 5. F05 — “Per source” and “pre-auth code” are not a brute-force defense contract

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-07/08; Phase 29 criterion 3.
- **What breaks:** No entropy, issuance/storage, attempt budget, or limiter scope is specified. Using the proxy address buckets all visitors together; trusting arbitrary forwarded headers enables bypass. Distributed sources bypass source-only limits; permanent per-code lockout lets attackers deny a legitimate arrival. Unlimited denied-attempt logging also creates a storage-abuse path.
- **Evidence:** `.planning/REQUIREMENTS.md:26-27` gives no numeric limits. `Host:186-214` demonstrates a process-local fixed-window limiter using `RemoteIpAddress` as fallback; `Host:224-259` has no `UseForwardedHeaders`. `TokenIssuer:9-29` already offers random 32-byte tokens and fixed-time verification, but RES-07 does not select that machinery.
- **Resolution:** Specify random token entropy and verifier-only persistence; numeric per-source, tenant-wide, and token/fingerprint attempt budgets; bounded backoff/lockout recovery; replica behavior; and audit-volume limits. Trust only configured Traefik proxy hops before limiting. Test the deployed proxy path, forged forwarding headers, multiple sources, rate-limit ProblemDetails, and redaction. **Must codes be human-typable, or can they be high-entropy links/QR?**

### 6. F06 — “Same JWT machinery” does not implement next-request revocation or uniform resident login

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-01/02; Phase 27 criteria 1/2.
- **What breaks:** The revocation requirement is explicit, but its implementation boundary is absent: refresh-token revocation alone leaves a live access token usable. Suspending a resident profile, changing apartment membership, and resetting a shared staff/resident account have different scopes. Bootstrap credential delivery/recovery is also not assigned. Copying existing login introduces timing and message enumeration.
- **Evidence:** `.planning/REQUIREMENTS.md:14` requires next-request denial. `JWT:30,35-59` issues default 15-minute tokens with tenant/profile/role/permissions but no apartment or session-version claim. `Host:81-95` validates token signature/lifetime without a database-status callback. `Login:49-65` skips BCrypt when the user is absent, uses distinct inactive/profile errors, and requires an attendant profile.
- **Resolution:** Specify authoritative resident profile/membership resolution and request-time revocation/version checks, including cache semantics and refresh. Define suspension versus revocation and mixed-role impact. Assign provisioning delivery, first-password change, password reset, and recovery to Phase 27. Require constant-cost verification and uniform unknown/wrong/inactive/revoked responses. Test an already-issued JWT's very next request, not merely a new login.

### 7. F07 — Apartment membership, ownership, and move-out semantics are undefined

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-01/03/05/09/10; Phases 27/28/30.
- **What breaks:** Multiple apartments, two residents sharing an apartment, and a TenantAdmin who is also a resident need explicit scope selection and permissions. “A resident can edit” does not decide creator-only versus household editing. Reassigning a resident can accidentally transfer old private history or leave their old authorizations valid; moving a new resident into the unit can expose previous occupants' histories.
- **Evidence:** `.planning/REQUIREMENTS.md:14-21,31-32` repeatedly uses singular “their apartment” without membership periods or creator rights. `Resident:11,38-45` currently stores one nullable, directly editable ApartmentId; it is not evidence that multiple-apartment membership already exists. `JWT:35-47` has a single profile and a role list, with no apartment context.
- **Resolution:** **Single apartment per portal identity in v2.4, or multi-membership with explicit active context? Creator-only or household management?** Decide historical visibility across occupancy periods, notification recipients, and what happens to pending authorizations on suspension, move-out, apartment reassignment/deletion, and role changes. Reject unsupported combinations explicitly and test same-unit co-residents plus stale JWT membership.

### 8. F08 — Document matching lacks a canonical identity and ambiguity policy

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-04/07/11; Phase 30 criterion 4.
- **What breaks:** Generic documents, CPF, and passports cannot share an untyped “remove punctuation” identity rule. Differently formatted CPFs can duplicate registrations; over-normalizing foreign documents can collide unrelated people. Several pending registrations can legitimately match one document across units or windows. A public success response can disclose identity even if all denials look uniform.
- **Evidence:** `.planning/REQUIREMENTS.md:20,26,36` alternates “document” and “CPF/document.” `VisitDirectory:40-54,59-68` trims input and strips only periods/hyphens; it does not implement typed identity matching. `src/Modules/Visits/ControlEasyReborn.Modules.Visits.Domain/ValueObjects/VisitorDocument.cs:7-15` only checks blankness/length and retains raw input.
- **Resolution:** Define supported document types/countries, typed canonical values, CPF check-digit/repeated-digit validation if CPF is required, case/whitespace treatment, and collision rules. **When matches are ambiguous, must staff select an authorization, or must the visitor provide its token?** Add canonical-equivalence, invalid-CPF, foreign-document, multiple-unit, and overlapping-window tests without exposing candidate identities to an unauthenticated caller.

### 9. F09 — New visitor PII and denial audits have no retention or erasure contract

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-04/05/08/09/12; Phases 28-30.
- **What breaks:** Names/documents/plates become durable cancelled/consumed history plus visits, notifications, badges, and audit traces. There is no retention clock, lawful-purpose ownership, masking policy, deletion/anonymization behavior, or handling of shared-document records. “Audit-logged” can inadvertently store attempted CPFs or reusable secrets indefinitely. Read-only history is not an authorization to retain personal data forever.
- **Evidence:** `.planning/REQUIREMENTS.md:20-21,27,31-37` creates these stores/surfaces without retention rules. `.specs/qr-entrance-exit-access/data-model.md:70,128` already forbids persisted plaintext QR and raw lookup PII in audit/logs. `.specify/memory/constitution.md:63-66` identifies this as regulated personal data.
- **Resolution:** Require a responsible product/legal decision on retention durations and deletion/anonymization scope, honoring any applicable existing policy rather than inventing a legal duration. Specify log redaction, access-audit metadata, resident masking, print disclosure, and expiry cleanup for notifications/tokens. Add tests proving secrets/full documents stay out of logs/errors and that an expired retention fixture is purged or anonymized consistently.

### 10. F10 — Consumption, Visit mutation, badge issuance, and notification can split across retries

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-05/07/10/11/12; Phase 29 criteria 1/2/4.
- **What breaks:** Self-service and staff can consume the same authorization concurrently. Consuming first can strand a valid visitor if Visit creation fails; consuming afterward can double-admit. A lost HTTP response can turn a legitimate retry into an “exhausted” denial after a committed check-in. Separate badge/notification writes can duplicate or disappear. Calling the same handler does not make the aggregate operation atomic.
- **Evidence:** `Arrival:54-84` performs a lookup then separate Add/Update with no authorization ID, idempotency key, or transactional consumption contract. `.planning/ROADMAP.md:278-280,293-296` requires the effects but specifies no commit/retry boundary. `Scan:99-119` already has scan-attempt idempotency, which the new flow is not required to reuse.
- **Resolution:** Define atomic compare-and-consume plus durable Visit linkage, a bounded idempotent result replay contract, and reliable event delivery for notification/badge work using project-approved DBTools transaction/outbox seams. Test concurrent kiosk/phone/guard requests, cancel-versus-check-in, response loss, transaction rollback, and post-commit delivery failure; exactly one arrival may consume the permitted use.

### 11. F11 — Same Visit state does not preserve the gatehouse consent/admission boundary

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-07; Phase 29 criterion 1.
- **What breaks:** Remote phone submission is not evidence of physical arrival. A direct call to `VisitorArrivalHandler` can create CheckedIn without passing consent/policy checks enforced in the QR flow, notifying residents and polluting occupancy/history before the visitor reaches the gate. A kiosk may justify different evidence, but nobody has chosen it. A self-service actor is also not a porteiro; substituting a fake attendant compromises audit attribution.
- **Evidence:** `Scan:156-186` explicitly gates on consent outcomes before arrival; `Scan:203-215` then invokes the canonical arrival path. `Arrival:52-84` has no consent/admission decision and directly creates CheckedIn. `Arrival:62` substitutes `Guid.Empty` for an absent attendant when advancing Pending. `.planning/PROJECT.md:168-169` records existing consent and participant-not-gatekeeper decisions.
- **Resolution:** **Is self check-in actual admission at a supervised location or only an arrival request needing staff confirmation?** Define consent-required/refused behavior and the approved override path without silently bypassing policy. Record actor type and trusted location separately from staff identity. Test that remote/pre-arrival requests and consent failures cannot falsely record physical admission or invent a staff actor.

### 12. F12 — Badge QR lacks credential binding, validity, reprint, and exit semantics

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-12; Phase 29 criterion 4; Phase 30 criterion 5.
- **What breaks:** “QR credential” does not decide whether this is an AccessCredential, a decorative VisitId, or a new bearer-token subsystem. A consumed pre-auth code cannot simultaneously remain a reusable badge token without distinct semantics. Reprint after reload cannot retrieve a raw token from a one-way verifier; issuing a second credential can conflict with an active one. A badge that outlives checkout can scan as a fresh arrival.
- **Evidence:** `.planning/REQUIREMENTS.md:37` supplies no lifecycle. `Credential:10-20,123-147` already models typed subjects, verifier-only secrets, validity and revocation. `CredentialLifecycle:55-59,62-100` rejects an existing active credential and returns the raw token only at issuance. `.specs/qr-entrance-exit-access/contracts/access-api.md:9,27,39` prohibits later raw-token disclosure. `Scan:197-202` states Visitor credential SubjectId is Visit.Id. `.planning/PROJECT.md:117` rejects a second credential subsystem specifically for password-reset links; it is not a literal badge design decision.
- **Resolution:** Explicitly reuse AccessCredential for access-bearing badges; specify VisitId binding, issuer actor for self-service, validity intersection, checkout/revocation linkage, allowed entrance/exit behavior, and duplicate/reprint rules. **Should lost-print recovery replace the credential or require a new staff-authorized print?** Do not persist plaintext tokens to make reprints convenient. Test expired/checked-out/replaced badges and fresh entrance scans against consumed authorizations.

### 13. F13 — Date windows, “expected today,” and badge validity have no shared clock contract

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-04/08/11/12; Phase 28 criterion 1; Phase 30 criterion 3.
- **What breaks:** Date-only end values can mean start-of-day or end-of-day; UTC versus tenant-local midnight yields different admission and pending-today results. Multi-day windows may grant overnight access unexpectedly. There is no bound on window length, no explicit start-inclusive/end-exclusive rule, and no decision on time-of-day restrictions. Badge expiry can disagree with admission expiry.
- **Evidence:** `.planning/REQUIREMENTS.md:20` says “start/end date”; `.planning/ROADMAP.md:278,294` says expired and expected today without defining either. `.planning/milestones/v2.1-MILESTONE-AUDIT.md:18,118` documents the same tenant-day versus UTC failure class. `Credential:123-128` already uses an exclusive expiration instant.
- **Resolution:** Specify tenant timezone, local-date conversion, inclusive/exclusive boundaries, allowed maximum duration, multi-day overlap query, and authoritative server clock. **Are daily service-hour restrictions required or explicitly deferred?** Keep badge and authorization validity consistent and add fake-clock tests at tenant midnight, window start/end, overlapping days, and any supported daylight-saving transition.

### 14. F14 — Arrival notification has no observable delivery or read-state contract

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-10; Phase 30 criterion 2.
- **What breaks:** A transient toast only while the page is open and a durable unread inbox both satisfy “shows an in-app arrival notification,” but have different data models and failure semantics. There is no bounded delivery delay, reload/offline recovery, recipient set, acknowledgement scope, retention, or duplicate rule. Badge-counting expected rows is not evidence that an arrival event occurred.
- **Evidence:** `.planning/REQUIREMENTS.md:32` and `.planning/ROADMAP.md:293` merely repeat “in-app arrival notification.” `Arrival:29,55-65` distinguishes a mutated visit from a no-op; the requirement does not say whether no-op/replayed arrivals notify again.
- **Resolution:** **Durable unread notifications or explicitly ephemeral portal alerts?** Choose recipients (creator/all currently eligible co-residents), polling or stream transport, a numeric delivery SLA, reload/backfill behavior, read-per-user versus read-per-unit semantics, and retention. Tie emission to the committed arrival identity; test two tabs, offline/reload, replay/no-op scans, and no cross-apartment notification contents or counts.

### 15. F15 — Phase 29's UI/print deliverable has no page or code-sharing journey

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-04/07/12; Phase 29 criterion 4; Phase 30 criterion 5.
- **What breaks:** Phase 29 can pass handler tests and claim a printable badge without any visitor-accessible journey. There is no page for receiving/entering the pre-auth code, resident copy/share behavior, kiosk reset, inaccessible-printer fallback, or route ownership. A phone cannot directly print at a gatehouse printer through browser print. Phase 30 owns the staff print trigger, while Phase 29 claims gatehouse printing already works.
- **Evidence:** `.planning/ROADMAP.md:274-283` lists badge printing with “UI hint: yes,” but no route; `.planning/ROADMAP.md:288-296` places staff integration later. `Routes:10-29,36-59` has login and authenticated gatehouse routes, not a visitor self-service route. `.planning/REQUIREMENTS.md:43,58` defers messaging delivery; it does not assign manual authorization sharing.
- **Resolution:** Assign concrete resident/visitor/staff pages and route guards to phases. Specify how an authorization reaches the visitor without WhatsApp/SMS integration, which browser prints, authorized badge retrieval, cancel/back behavior, and kiosk cleanup. Either provide a minimal working staff trigger in Phase 29 or move the corresponding acceptance criterion to Phase 30. Require browser E2E coverage of the chosen journey, not only an API/PDF fixture.

### 16. F16 — New arrivals do not define how they leave, overstay, or recover through staff

- **Severity:** P1 must-resolve-before-planning
- **Reference:** RES-07/09/11/12; Phases 29/30.
- **What breaks:** Check-in-only acceptance can leave visits permanently CheckedIn, causing later arrivals to no-op. Badge expiry is not checkout; an exit scan is not necessarily a Visit transition. Unknown/expired/cancelled authorization needs a safe staff fallback rather than undocumented overrides. Cancelling an authorization after admission and losing a badge also require distinct behavior from deleting the historical visit.
- **Evidence:** `Visit:68-75` has explicit checkout; `VisitEndpoints:69-75` exposes a separate staff operation. `Scan:189-217` invokes Visit arrival only for Entrance and does not close a Visit on Exit. `Arrival:55-57` returns an existing CheckedIn row unchanged. `.planning/REQUIREMENTS.md:26-37` has no checkout/overstay/recovery acceptance criteria.
- **Resolution:** **Does v2.4 retain staff-only checkout, or must badge exit close the Visit?** Define checkout ownership, late/overnight handling, badge revocation, and a staff-only auditable recovery path that does not reactivate consumed authorizations silently. An automated overstay service may be explicitly deferred, but state closure and manual recovery cannot be left implicit. Test next-day re-arrival, exit after badge expiry, lost badge, and failed self-check-in followed by legitimate staff admission.

### 17. F17 — Optional plate does not specify whether it is a snapshot or a vehicle authorization

- **Severity:** P2 nice-to-resolve
- **Reference:** RES-04/09/12; Phase 28 criterion 1.
- **What breaks:** Saving free text and creating/linking a Vehicle record have different permissions, normalization, history, and credential implications. A plate can be edited after issuance or match an existing vehicle belonging to another household; silently linking it could grant unintended vehicle access.
- **Evidence:** `.planning/REQUIREMENTS.md:20` lists only “optional vehicle plate.” `Arrival:12-23` and `Visit:13-28` have no vehicle/plate field, so the current write-path contract does not preserve it on a Visit.
- **Resolution:** State that the plate is a normalized informational snapshot, with no vehicle access grant, unless explicit vehicle linking is required. If linking is required, assign ownership checks and persistence to a phase. Test snapshot survival, edits/cancellation, and no automatic credential issuance.

### 18. F18 — Purpose configuration has no history-preservation contract

- **Severity:** P2 nice-to-resolve
- **Reference:** RES-06; Phase 28 criterion 3.
- **What breaks:** Renaming/removing a per-tenant code can retroactively change visit history, strand pending authorizations, or lose the purpose when arrival reuses an existing Pending visit. “Stamped” could mean immutable label snapshot or only an FK; tests cannot choose between them.
- **Evidence:** `.planning/REQUIREMENTS.md:22` says per-tenant configurable/stamped. `Visit:21,46` currently stores only a purpose string. `Arrival:60-64` reuses Pending without applying command.Purpose.
- **Resolution:** Define immutable code identity plus historical label snapshot, deactivate-versus-delete behavior, and handling of pending registrations referencing retired codes. Test rename/deactivation after pre-registration and after check-in, including the existing-Pending arrival branch.

## Verification gaps that block a mechanical freeze gate

The current success criteria do not select a unique test oracle for the entry point (F01/F15), recurrence/use budget (F04), rate-limit identity and thresholds (F05), membership/ownership (F07), normalized matching (F08), time boundaries (F13), notification delivery/read state (F14), or badge lifecycle (F12/F16). “Same handler” also proves neither isolation (F03), atomicity (F10), nor policy parity (F11). These are missing acceptance decisions, not requests to add arbitrary implementation detail.

Required security tests must cover anonymous → tenant bootstrap, resident → existing staff API denial, tenant A → tenant B, apartment 101 → 302, co-resident ownership, stale membership/JWT, malformed and valid-but-other-tenant tokens, denial/timing normalization, and every ID-bearing endpoint including badges and notifications. All test fixtures must be synthetic (`AGENTS.POLICY.md:131`); no real visitor CPF/name may enter this report or fixtures.

The report changes documentation only. Application CI gates are not applicable under `AGENTS.POLICY.md:20-33`. No project-wide Markdown/link checker was found in the inspected package scripts/configuration. The report is intentionally uncommitted in its isolated review worktree; the primary checkout is unchanged.
