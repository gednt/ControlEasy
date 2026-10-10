---
description: "ControlEasy Reborn — condominium access-control platform. ASP.NET Core 8 + Angular 18 + MySQL 8 + Docker Compose. Load this file once per session; load AGENTS.POLICY.md, AGENTS.WORKTREES.md, AGENTS.STACK.md, or skill overlays only when the task touches the corresponding domain."
allowed-tools: [Read, Grep, Glob, Bash(docker compose *), Bash(git status *), Bash(git log *), Bash(git diff *), Bash(git worktree list *), Bash(make *), Bash(scripts/verify-ci-local*), Bash(npm ci --legacy-peer-deps), Bash(npm run lint), Bash(npm test *), Bash(npx playwright install *), Bash(npx ng *)]
mode: primary
---

<!-- agents-template-schema 1 -->

# AGENTS.md — ControlEasy Reborn

> **Authoritative project guide.** Binding runtime document for every
> contributor and every agent. Constitutional authority:
> `.specify/memory/constitution.md` (v1.7.0, 2026-09-21).
> Where this file and the constitution disagree, the constitution wins.

This file is intentionally **slim**. Heavy content (policy, worktree
ceremony, language/stack conventions) lives in sibling files listed under
`## Skill overlays`; load them only when the task touches that domain.

---

## Reader contract (minimal)

An agent reading `AGENTS.md` alone (without `AGENTS-SPEC.md`) MUST:

1. Treat sections without an `<!-- owner:... -->` comment as
   **project-owned**: their content is binding for this repository and
   the agent obeys it.
2. Treat sections marked `<!-- owner:<workflow> -->` as
   **workflow-owned**: the agent obeys the *non-empty* blocks for
   workflows it knows it is running. Empty blocks are inert.
3. Honor a freshness stamp (`<!-- verified YYYY-MM-DD against <sha> -->`
   or `<!-- approved YYYY-MM-DD -->`) on workflow blocks as a
   cache-invalidation signal.
4. Treat the `## Skill overlays` list as a set of pointers to sibling
   files. The agent reads those sibling files directly.
5. Treat the schema header (`<!-- agents-template-schema 1 -->`) as the
   version this file conforms to. Unknown section names do not error.

---

## Project

ControlEasy Reborn is a condominium access-control web platform for
managing residents, visitors, vehicles, service providers, apartments,
and gatehouse ("portaria") operations. Built for condominium
administrators, portaria staff, and residents.

**Target architecture:** ASP.NET Core 8 modular monolith + Angular 18
SPA + MySQL 8 + Docker Compose + JWT bearer. Nine feature modules
(Residents, Visits, Vehicles, ServiceProviders, Apartments, Security,
Tenants, Reports, Administration), each with Clean Architecture
(Domain, Application, Infrastructure, Api).

---

## Repo anatomy

Lean orientation. Generated output, node_modules, and provider
harness folders are gitignored; do not document them.

- `src/` — ASP.NET Core 8 solution, Angular 18 SPA, shared building
  blocks, nine feature modules. Tracked source. See `AGENTS.STACK.md`
  for the per-layer layout.
- `tests/` — xUnit unit, integration (Testcontainers.MySql),
  architecture (NetArchTest), and a11y/visual. Tracked source.
- `docker/` — Compose files, Dockerfiles, MySQL init scripts.
- `.planning/`, `.specs/`, `.specify/`, `_bmad/`, `_bmad-output/` —
  workflow-owned state directories. See `AGENTS.POLICY.md` for which
  workflow owns which.
- `agents-init/` — agents-template onboarding skill (canonical
  SKILL.md). Overlay-owned.
- `docs/`, `scripts/`, `mockup/` — operator/developer docs, worktree
  scripts, UI mockups. Tracked source.
- `Makefile`, `global.json` — convenience targets and SDK pin.
- `AGENTS-TEMPLATE.md`, `AGENTS-SPEC.md` — agents-template schema
  artifacts (read before editing this file).

---

## Build, test, and development commands

Canonical commands live in `docs/DEVELOPMENT.md` and `docs/TESTING.md`.
Quick reference only:

- Build: `dotnet build src/ControlEasyReborn.sln` / `make build`
- Tests: `dotnet test tests/ControlEasyReborn.UnitTests` (plus
  IntegrationTests, ArchitectureTests); Angular:
  `npm test -- --no-watch --browsers=ChromeHeadless`
- Lint/format: `npm run lint` / `npm run format` (from
  `src/Web/ControlEasyReborn.Web`)
- Stack: `docker compose -f docker/docker-compose.yml up -d --build` /
  `make up` / `make down`
- Local CI gate: `scripts/verify-ci-local.sh` (full) / `--fast`
  (per-turn) — see `AGENTS.POLICY.md`

The canonical dev shell is the **devcontainer** under `.devcontainer/`;
the host shell is a fallback for trivial read-only inspection only
(Constitution Principles V and VIII). The per-worktree Compose project
convention is `ce-<branch-hyphens>`; see `AGENTS.WORKTREES.md`.

---

## Policy

Hard rules the agent must not violate live in
[`AGENTS.POLICY.md`](AGENTS.POLICY.md). **Load it before any
non-trivial change.** Headlines:

- Mandatory two-tier local CI verification gate (fast per-turn, full
  on completion).
- Mandatory Git worktree rule (see [`AGENTS.WORKTREES.md`](AGENTS.WORKTREES.md)).
- No EF Core, no MediatR, no MVC controllers, no cross-tenant access,
  no real-user data in tests, BCrypt ≥ 11, ProblemDetails + Serilog.

---

## Workflow blocks

Empty blocks are inert. Adopted workflows populate their block via
their own onboarding/refresh skill.

### BMAD

<!-- owner:bmad -->
<!-- BMAD's project-context skill writes its durable context here. -->
<!-- /owner -->

### GSD-core

<!-- owner:gsd -->
<!-- GSD's onboarding skill writes its state slice here. -->
<!-- /owner -->

### spec-kit

<!-- owner:spec-kit -->
<!-- spec-kit's onboarding skill writes its state slice here. -->
<!-- /owner -->

---

## Skill overlays

Read each pointer only when the task touches that overlay's domain.

- **AGENTS.POLICY.md** — Hard policy (CI gate, **Web SPA gate** for any
  change under `src/Web/ControlEasyReborn.Web/**`, platform-aware exec,
  prohibitions, workflow ownership). Load before any non-trivial change.
- **AGENTS.WORKTREES.md** — Mandatory Git worktree rule + naming
  convention. Load before any commit, branch, or merge.
- **AGENTS.STACK.md** — Stack, C# / Angular conventions, agent
  concurrency budget. Load before touching code in the corresponding
  language.
- **impeccable** — `.opencode/skills/impeccable/SKILL.md`. Frontend
  design skill. Load before any UI work.
- **agents-template** — `AGENTS-TEMPLATE.md`, `AGENTS-SPEC.md`,
  `agents-init/SKILL.md`. Load before editing this file or onboarding a
  new repo to the schema.
- **playwright-validate** — `.opencode/skills/playwright-validate/SKILL.md`.
  Smoke-test the Angular SPA in a real browser via Playwright MCP. Auto-
  invoked by `.opencode/plugins/playwright-validate.ts` after any
  `Edit|Write` to `src/Web/ControlEasyReborn.Web/**`.
- **docs/AGENT-TOKEN-OPTIMIZATION.md** — what the project did to keep
  per-turn input tokens low, what was deliberately left to the user-
  level installers, and how to verify the savings. Load when
  troubleshooting turn-1 context bloat.

---

<!-- agents-template-schema 1 -->
