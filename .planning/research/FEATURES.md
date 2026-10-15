# Feature Research

**Domain:** Condominium access-control platform — resident self-service portal & visitor pre-registration/self check-in (milestone v2.4)
**Researched:** 2026-10-15
**Confidence:** MEDIUM (Brazilian product/feature claims HIGH-MEDIUM from competitor product pages + official help docs + LGPD guidance; internal dependency claims HIGH from repo inspection + `notes/v2-4-codex-gap-review.md`)

## Superseding the v2.1 Landscape (stale rows to ignore)

The previous FEATURES.md (v2.1, 2026-09-19) is still valid for ledger/reports/password topics but has **three rows now inverted by v2.4 decisions** — do not let them leak into planning:

1. **"Badge printing" was an anti-feature** ("hardware printer integrations, defer until a real condominium demands it"). v2.4 ships a **printable badge**, but the anti-feature's core objection remains valid and is preserved as a boundary: no printer-hardware integration, no driver matrix — badge is a **browser-print page triggered by staff** (gap review F15), riding the existing `AccessCredential` subsystem, not a printer subsystem.
2. **"Self-registration / visitor self-service portals" was an anti-feature** ("visitors don't self-register; porteiro registers; anonymous data entry multiplies attack surface"). v2.4 ships visitor self check-in, but the anti-feature's security objection drives the design: the lane is a **supervised, gatehouse-authenticated self-service lane — no anonymous public API** (F01/F11). The visitor-phone path is explicitly deferred.
3. **"Resident-facing visit visibility" and "host notifications" were deferred differentiators** ("trigger: resident feature requests"). v2.4 promotes both to table stakes — data unification (v2.1) removed the main cost blocker.

The v2.1 competitor table covered only workplace VMS (Envoy, Sign In App). This research adds the **Brazilian residential** segment, which behaves differently: authorization-by-app from the resident's phone is the norm, WhatsApp is the dominant invite channel, and CPF-based identification is universal.

## Feature Landscape

### Table Stakes (Users Expect These)

What every Brazilian condominium app / kiosk VMS ships, and residents/operators assume ControlEasy has.

| Feature | Why Expected | Complexity | Notes (decisions already settled) |
|---------|--------------|------------|-------|
| Resident pre-registers visitors in advance (`RES-04`) | Porter's access-control write-up lists "autorização prévia: morador libera um convidado com antecedência" as one of the four functions "que não podem faltar" in any serious system; CONDO+ ("cria convites com QR Code e agenda de visitantes"), eCondos, Lello all market it as the core resident feature | MEDIUM | Apartment-owned pre-reg CRUD (any co-resident may edit/cancel pending pre-regs; creator recorded for audit). New `VisitorPreRegistration`-shaped entity in Visits module; consumes existing apartment binding from Residents |
| Validity window + bounded single/multi use per pre-reg (`max_uses`, `RES-05`) | Every invite system is "unique and temporary": Condfy "QR Code único e temporário", eCondos convite per-visit, Genetec ClearID "visitors can check in up to 1 hour before a visit event" — a pre-reg without an expiry is considered a security hole | LOW-MEDIUM | Settled: window inside `max_uses` (default 1, per-tenant cap in admin settings); "expired" derived at read time, no background sweep; recurrence explicitly NOT modeled beyond max_uses (F04 closure) |
| Resident sees pending pre-registrations + status (`RES-09`) | Condfy shows "quem está liberado e quem aguardando aprovação"; pending → consumed state visible to the household is assumed | LOW | Read endpoint filtered by apartment; pending/consumed/expired derived stamps, no new state machinery |
| Resident arrival notification on check-in (`RES-10`) | Acesso Inteligente: "o morador recebe automaticamente uma notificação no seu celular indicando que o convidado chegou"; Condfy "Notificações de Acesso"; MaqPronAPP push notifications — universal in the segment | MEDIUM | Settled: in-app durable notification tied to the committed arrival identity (F10/F14 closures); compare-and-consume + notification insert atomic in the canonical transaction; no cross-apartment leak; push/WhatsApp deferred |
| Resident visit history scoped to own apartment (`RES-03`) | Condfy/eCondos/Lello all ship "histórico de acessos" filtered to the resident's unit; residents audit who came while they were out | LOW-MEDIUM | Apartment-scoped filter over the existing unified ledger read model; masked display (name + last-3 CPF digits, not full document); destination resolution already exists |
| QR / one-time code as the visitor pass | Segment standard: Condfy, eCondos (morador shares QR "leitor" image), Acesso Inteligente ("senhas de uso único... o visitante não precisa ter nada instalado") | LOW-MEDIUM | Settled: pre-auth codes reuse `OpaqueTokenIssuer` — 32-byte verifier-only, not visitor-typable (F05 closure); no plaintext persistence anywhere |
| CPF/document-based identification at the gate (`RES-04` matching) | The Brazilian norm — AABIC LGPD guide: porteiro collects "nome completo, número da identidade"; Serpro: entry "condicionado... fornecimento de dados... CPF, RG"; the porteiro culture is match-by-CPF, not match-by-email | MEDIUM | Typed canonical identity with CPF check-digit validation (F08 closure); rate-limit partition on normalized document; masked display everywhere resident-facing |
| Provisioned resident portal credentials (`RES-01`) | MaqPronAPP "cadastro por convite (SMS, e-mail ou WhatsApp)" with manager approval; Condomob titular creates household members — residents never self-join | MEDIUM | Settled: TenantAdmin provisions the resident credential; per-request suspended-status checks (stateless JWT covered); TenantAdmin-only recovery; constant-cost uniform denials (F06 closure) |
| Purpose/type separation of visits (`RES-06`) | Brazilian standard: prestadores vs visitantes vs familiares treated differently (Porter "regras por perfil"); workplace VMS: "custom flows by visitor type" (elia.io) | LOW-MEDIUM | Settled: per-tenant purpose codes, immutable code identity + historical label snapshot (F18 closure); feeds existing reports grouping |
| Self check-in lane exists for pre-registered guests (`RES-07`) | Kiosk VMS table stakes: Kenai "instant QR check-in... checked in within seconds"; ClearID/Genea both ship pre-registered guest check-in as a first-class kiosk mode | HIGH | Supervised gatehouse lane only (F01/F15 closures); rides `VisitorArrivalHandler` (single write path); consent gates unchanged; actor kind `Visitor@Lane` |

### Differentiators (Competitive Advantage)

Not expected, but valuable — mostly correctness/privacy properties the segment lacks.

| Feature | Value Proposition | Complexity | Notes (decisions already settled) |
|---------|-------------------|------------|-------|
| Arrival is pre-registration-bound; same-document cross-apartment conflicts **never auto-resolve** — porteiro disambiguates | Brazilian apps auto-match by document or route everything through "call the resident"; wrong-apartment check-ins are an unresolved industry failure mode. Honest disambiguation is trust-building for porteiro + syndic | MEDIUM | Settled (F03 closure): authorization ID, resulting VisitId, destination, purpose explicitly bound; reject ambiguous/conflicting results without disclosing other-apartment data; same-doc cross-apartment tests mandatory |
| Atomic consumption — exactly one arrival per permitted use | Concurrent kiosk/staff arrivals, lost HTTP responses, and replayed scans silently double-admit or strand visitors in most systems; our compare-and-consume inside the canonical transaction is a correctness differentiator | MEDIUM | Settled (F10 closure): bounded idempotent replay; tested for concurrency + rollback |
| Printable badge reusing `AccessCredential` (verifier-only, VisitId-bound; reprint = new staff-authorized print) | Brazilian residential products essentially don't have badges (the QR on the guest's phone IS the pass); enterprise kiosks do — carrying it as a credential, not a sticker, means the badge dies with the visit | MEDIUM | Settled (F12 closure): no second credential subsystem; no plaintext token persisted for reprint convenience; badge validity intersects authorization validity; checkout stays staff-only |
| Purpose-code historical label snapshots in the ledger | Renaming a "Visita" code elsewhere silently rewrites history ("entregador" becomes "visita" retroactively); snapshot preserves audit integrity for syndic queries | LOW | Settled (F18 closure); pending pre-regs referencing retired codes handled |
| Privacy-by-default masking of visitor documents on resident surfaces | Lello's LGPD cartilha: restrict PII access to "o menor número possível"; most Brazilian apps show full data in resident history; masked-by-default is an LGPD posture a syndic can defend in assembly | LOW | RES-14 cross-cutting: masking + log redaction on all new surfaces; visitor's full document never shown to residents |
| Staff deny matrix as a provable property (`RES-13`) | New resident role opens existing staff APIs in every naive implementation; a *negative-checked* endpoint inventory ("resident tokens refused, proven by tests") is rare in the segment's web portals | MEDIUM | Settled (F02 closure): every staff endpoint declares an explicit role policy + negative integration suite |
| Banned/block list (lista de banidos) — defer | Acesso Inteligente markets per-condominium and per-unit forbidden-person lists; valued by síndicos | MEDIUM-HIGH | **Not in v2.4 scope** — surfaced here as the top candidate for v2.5+ because it composes naturally with refused-scan machinery already built |

### Anti-Features (Commonly Requested, Often Problematic)

Features competitors market heavily that v2.4 deliberately does NOT build — with the boundary each one keeps.

| Feature | Why Requested | Why Problematic | What to Do Instead |
|---------|---------------|-----------------|--------------------|
| Anonymous visitor self check-in **from the visitor's own phone** (public link) | Every enterprise kiosk product (elia, ClearID "check-in from phones, no kiosk hardware", Offision) offers phone-first check-in; visitors expect it | A CPF is a commonly known identifier — document-as-authorization; no evidence of physical presence; anonymous requests have no tenant bootstrap; success responses disclose identity (F01/F11). This is the exact attack surface the review's P0 verdict froze scope over | Supervised lane: gatehouse-authenticated session, tenant-bound, porteiro present. Visitor-phone path deferred until a delivery channel exists |
| Real-time remote release from the resident's phone at the moment of arrival (videochamada / "liberar acesso") | The Brazilian default — Porter, CondPlus, eCondos all center on it; moradores expect "eu autorizo agora pelo app" | Requires two-way comms (interfonia/push/WhatsApp — out of scope by PROJECT decision); makes the resident the gatekeeper, conflicting with the settled staff-first posture; also F11: phone approval ≠ evidence of arrival at the gate | Pre-registration ahead of time + porteiro-confirmed arrival; the resident's control point is *what is pre-authorized*, not *when the door opens* |
| Facial biometric self-enrollment in the resident app (photo → face credential) | The headline feature of Porter, Condfy, MaqPronAPP | LGPD sensitive data with the strictest treatment (AABIC guide); liveness/matching/enrollment needs an approved separate specification; existing arch test fails the build on biometric keywords (`FacialBiometricReserved = 99`) — constitutional | Document/CPF + QR per v2.4; biometric remains reserved for a future approved spec (v2.5+ hardware track is separate) |
| Badge printing as a hardware integration (thermal printers, Brother QL driver matrix, kiosk enclosures) | ClearID/Genea ship printer configs as core setup docs; "hardware badge printing" reads as professional | Driver matrix + label stock + hardware contract the project doesn't have; repeats the exact reason camera hardware was delegated to the condominium in v2.0 | Browser-print of a staff-triggered badge page (F15); any printer the gatehouse prints any web page on will do |
| Push notifications / WhatsApp / e-mail delivery of arrivals in v2.4 | Segment norm (MaqPronAPP, Porter, CONDO+ "compartilha autorizações via WhatsApp") | WhatsApp Business API: Meta approval + per-tenant numbers (settled PROJECT out-of-scope); push is native-mobile — resident app is web/portal-only (settled out-of-scope: v2.4 = in-app notifications) | In-app durable inbox + polling; revisit when mobile/push exists |
| Resident self-registration & cadastro autonomy (residents editing household members, vehicles, pets) | Aplicativo Acesso markets "condôminos são responsáveis pelos seus cadastros"; Condomob titular adds moradores | Explodes the resident role's blast radius before the deny matrix (RES-13) exists; move-out/membership semantics are unresolved (F07 — apartment reassignment, shared JWT) | v2.4 resident role stays minimal (read history, pre-reg CRUD, notifications); resident-record edits stay TenantAdmin/staff |
| Unbounded recurring authorizations ("recurring weekly maid pass" without explicit bounds) | Natural request for frequent service providers | Multi-day windows + "exhausted use" invite recurrence assumptions that change the lifecycle and DB contract (F04) | `max_uses` inside the validity window (default 1); recurrence deferred until modeled explicitly |
| Over-charted resident dashboard (occupancy graphs, pie charts in the portal) | "Portal should look modern" | Same objection as v2.1 reports: operators and residents trust lists/stamps over charts; multiplies test surface | Simple counts + chronological history; charts only if a syndic asks |

## Feature Dependencies

```
[Phase 27: Resident Access Foundation]
    ├──requires──> [RES role in JWT + apartment-scope derivation (server-side)]
    │             └──requires──> [RES-13 deny matrix: every staff endpoint declares role policy]
    │                            (MUST land before ANY resident-facing surface exists — Codex F02)
    ├──requires──> [TenantAdmin provisioning + MustChangePassword re-arm + suspended-status
    │               per-request check]              (F06)
    └──requires──> [Apartment membership rules: single apartment per portal identity in v2.4,
                    household co-resident scope, move-out = lose portal + cancel pendings] (F07)

[Phase 28: Visitor Pre-Registration & Purpose Codes]
    ├──requires──> [Apartment-owned pre-reg entity + validity window + max_uses + derived expiry] (F04)
    ├──requires──> [Typed canonical document identity (CPF check-digit) for matching] (F08)
    ├──requires──> [Purpose codes: immutable identity + label snapshot] (F18)
    └──enhances──> [Plate as normalized informational snapshot — no vehicle grant] (F17)

[Phase 29: Visitor Self Check-In Lane]
    ├──requires──> [Phase 28 pre-regs + pre-auth codes (OpaqueTokenIssuer verifier-only)] (F05)
    ├──requires──> [Gatehouse-authenticated session/tenant bootstrap — no anonymous route] (F01)
    ├──requires──> [Consent/policy gates unchanged; actor kind Visitor@Lane] (F11)
    ├──requires──> [Atomic compare-and-consume + Visit linkage in canonical transaction] (F10)
    ├──requires──> [Badge: AccessCredential reuse, browser-print page, staff-authorized reprint] (F12/F15)
    └──requires──> [Staff fallback: expired/lost-badge/next-day recovery; checkout stays staff-only] (F16)

[Phase 30: Resident Visibility, Notifications & Gatehouse Panel]
    ├──requires──> [Committed arrival identity from Phase 29 path — notification tied to it, no double-notify on replay] (F14)
    ├──requires──> [Apartment-scoped history endpoint (existing unified ledger read model)] (RES-03)
    └──requires──> [Shared clock contract (Phase 19 tenant-day basis) for windows/expected-today/badge validity] (F13)

[RES-14 PII masking & log redaction] ──cross-cutting──> lands with each surface, not deferred to a final phase
```

**Dependency notes:**
- **Deny matrix is a trust precondition, not a feature.** Phase 27 must complete RES-13 before any resident JWT exists in production — the negative suite is what makes every later surface safe to add.
- **The lane (Phase 29) is the highest-risk phase** — six gap-review findings are consumed at once (F01, F05, F08, F10, F11, F12, F16); it should not start before Phase 28's pre-reg identity contract is verifiable via tests.
- **Notifications are cheap only after atomicity.** Emitting from `VisitorArrivalHandler`'s committed transaction means Phase 30's notification quality is Phase 29's transaction quality.
- **No external dependencies** — the whole feature set rides existing machinery: unified `VisitorArrivalHandler` (v2.1), unified ledger read model (v2.1), `AccessCredential`/`OpaqueTokenIssuer` (qr-entrance-exit-access), password machinery + SMTP (v2.1), consent gates (v2.0).

## MVP Recommendation

### Launch With (v2.4 — all four phases, ordered)

- [ ] RES-13 deny matrix + resident role/provisioning (Phase 27) — unlocks everything safely
- [ ] Pre-reg CRUD: validity window + `max_uses` + purpose codes + CPF canonical matching (Phase 28)
- [ ] Supervised self check-in lane: codes, pre-regs, consent, atomic consume, badge print page, staff fallback (Phase 29)
- [ ] Resident apartment-scoped history + arrival notifications + porteiro panel surfacing of pending pre-regs & document matching (Phase 30)

### Explicitly Defer (with triggers)

- [ ] Visitor-phone self check-in — trigger: a delivery channel decision (WhatsApp is parked; Meta approval)
- [ ] Remote real-time resident release — trigger: two-way comms scope; conflicts with staff-first gatekeeper posture today
- [ ] Facial biometric — trigger: approved privacy/enrollment/liveness spec (constitutional)
- [ ] Lista de banidos — trigger: síndico demand; composes with refused-scan machinery (strong v2.5+ candidate)
- [ ] Resident cadastro autonomy — trigger: after RES-13 proves out in production and F07 membership semantics are settled
- [ ] Badge/authorization retention duration — owed a legal/product review (already an open flag in PROJECT.md)

## Competitor Feature Analysis

| Feature | Porter / eCondos / Condfy (BR residential apps) | Gallagher Kenai / Genetec ClearID (kiosk VMS) | ControlEasy Reborn v2.4 |
|---------|------------------------------------------------|----------------------------------------------|--------------------------|
| Pre-registration | Core: morador creates invite in app, share via WhatsApp/QR | Core: host-invited pre-reg → QR access pass by email | Apartment-owned pre-reg CRUD; share = resident shows the pre-auth code/QR (no messaging integration) |
| Check-in moment | Visitor arrives → app-based release or porteiro matches pre-registered list | Kiosk: instant QR scan or self-registration, badge auto-prints | Supervised gatehouse lane + porteiro CPF matching; badge printed on-site |
| Trust model | Resident is the gatekeeper (remote release); gatehouse observes | Kiosk device is site-trusted; self-registration for walk-ins | Staff is the gatekeeper; resident pre-authorizes; lane is gatehouse-authenticated (deliberate deviation from BR norm) |
| Use limits | "QR Code único e temporário" (per-invite expiry assumed) | ClearID: check-in allowed up to 1h before event window | Explicit `max_uses` (default 1) + validity window + derived expiry — more explicit than segment norm |
| Resident history | Histórico de acessos with photo/método/hora | Host dashboard, not resident-facing | Apartment-scoped ledger view, masked documents |
| Arrival notifications | Push notifications, universal | Host email/SMS on arrival | In-app inbox tied to committed arrival identity (no channel dependency) |
| Badges | Essentially absent (phone QR is the pass) | Table stakes w/ thermal printers | Reuse `AccessCredential`, browser-print — a middle path neither segment offers |
| Biometrics | Facial enrollment in-app is the headline | Kiosk facial sign-in optional | Constitutionally reserved (`FacialBiometricReserved = 99`) |
| LGPD posture | LGPD pages exist; visitor-data retention rarely specified | Enterprise compliance modules | Explicit masking, redaction, verifier-only secrets, retention review flagged |

## Sources

- Porter (porter.com.br) — "Controle de acesso de prestadores e visitantes" (2026-07): four can't-miss functions (autorização prévia, registro rastreável, regras por perfil, triagem contínua); app features incl. convites via WhatsApp (fetched 2026-10-15)
- eCondos (econdos.com.br) — aplicativo para condomínios: liberação de visitante via app, QR code flow, resident/portaria channel (fetched 2026-10-15)
- Condfy/OLiport — residential app marketing: QR Code único e temporário, histórico de acessos, notificações de acesso, status "aguardando aprovação" (fetched 2026-10-15)
- Acesso Inteligente (acessointeligente.com.br) — one-time visitor passwords, morador notified when guest arrives, lista de banidos, totems de auto-atendimento (fetched 2026-10-15)
- CONDO+ (docs.urbanworks.com.br) — resident module: convites com QR Code, agenda de visitantes, share via WhatsApp (fetched 2026-10-15)
- Lello apps (Play Store + lellocondominios.com.br) — autorizar entrada de visitantes, correspondence, vehicle/dependent cadastro; LGPD cartilha (2021): visitor-data minimization, privacy notice at gatehouse (fetched 2026-10-15)
- MaqPronAPP (maqpronapp.com.br) — onboarding via invite, 5 guest access methods, resident cadastro autonomy (fetched 2026-10-15)
- Gallagher Kenai docs — "The visitor pre-registration flow" + "Check in at the kiosk": pre-reg → access-pass QR → instant kiosk check-in; walk-in self-registration; link tied to one visitor (fetched 2026-10-15)
- Genetec ClearID docs — self-service kiosk check-in scenarios (ID/QR/email lookup, duplicate-name disambiguation, badge print), 1h pre-event window (fetched 2026-10-15)
- elia.io — "Visitor Management Kiosks" (2026-08): pre-reg cuts check-in from 2 min to ~10s; phone check-in via QR; badge/kiosk hardware stack (fetched 2026-10-15)
- LGPD: AABIC "Guia LGPD Condomínios" (2021), Lello cartilha (2021), Serpro article (2020), Seu Condomínio (2026-05), Diário de Justiça (2025-06) — gatehouse visitor data (nome/CPF/RG/imagem) is regulated personal data; biometrics = sensitive; consent notices at gatehouse; retention must be explicit (fetched 2026-10-15)
- Repo-internal (HIGH): `.planning/PROJECT.md` v2.4 goal + resolved gap-closure decisions; `notes/v2-4-codex-gap-review.md` (F01–F18, all closures cited above); v2.1 FEATURES.md (carried-over dependency claims)

---
*Feature research for: condominium access-control — resident self-service portal, visitor pre-registration & supervised self check-in (milestone v2.4)*
*Researched: 2026-10-15*