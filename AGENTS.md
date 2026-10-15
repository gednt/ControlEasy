---
description: "ControlEasy Reborn — condominium access-control platform. ASP.NET Core 8 + Angular 18 + MySQL 8 + Docker Compose. Load once per session; load sibling overlays only when the task touches their domain."
allowed-tools: [Read, Grep, Glob, Bash(docker compose *), Bash(git status *), Bash(git log *), Bash(git diff *), Bash(git worktree list *), Bash(make *), Bash(scripts/verify-ci-local*), Bash(npm ci --legacy-peer-deps), Bash(npm run lint), Bash(npm test *), Bash(npx playwright install *), Bash(npx ng *)]
mode: primary
---

# AGENTS.md — ControlEasy Reborn

Constitutional authority: `.specify/memory/constitution.md`. On conflict, the constitution wins.

Heavy content lives in sibling files under `## Skill overlays`; load them only when the task touches that domain. The reader contract below makes this file self-contained.

---

## Project

Condominium access-control web platform. Users: administrators, portaria staff, residents. Manages residents, visitors, vehicles, service providers, apartments, gatehouse operations.

**Stack:** ASP.NET Core 8 modular monolith + Angular 18 SPA + MySQL 8 + Docker Compose + JWT bearer. Twelve feature modules (Residents, Apartments, Visits, Vehicles, ServiceProviders, Photos, AccessControl, Security, Tenants, Reports, Administration, Devices), each with Clean Architecture (Domain, Application, Infrastructure, Api).

---

## Repo anatomy

- `src/` — ASP.NET Core 8 + Angular 18, shared building blocks, twelve feature modules.
- `tests/` — xUnit unit, integration (Testcontainers.MySql), architecture (NetArchTest), a11y/visual.
- `docker/` — Compose files, Dockerfiles, MySQL init scripts.
- `.planning/`, `.specs/`, `.specify/`, `_bmad/`, `_bmad-output/` — workflow-owned. See `AGENTS.POLICY.md`.
- `docs/`, `scripts/`, `mockup/` — operator/developer docs, worktree scripts, UI mockups.
- `Makefile`, `global.json` — convenience targets and SDK pin.

---

## Build, test, and development commands

Canonical commands: `docs/DEVELOPMENT.md`, `docs/TESTING.md`.

- Build: `dotnet build src/ControlEasyReborn.sln` / `make build`
- Tests: `dotnet test tests/ControlEasyReborn.UnitTests` (also IntegrationTests, ArchitectureTests); Angular `npm test -- --no-watch --browsers=ChromeHeadless`
- Lint/format: `npm run lint` / `npm run format` (from `src/Web/ControlEasyReborn.Web`)
- Stack: `docker compose -f docker/docker-compose.yml up -d --build` / `make up` / `make down`
- Local CI gate: `scripts/verify-ci-local.sh` (full) / `--fast` (per-turn) — see `AGENTS.POLICY.md`

Dev shell: **devcontainer** under `.devcontainer/`. Host shell is for read-only inspection only. Per-worktree Compose project: `ce-<branch-hyphens>` — see `AGENTS.WORKTREES.md`.

---

## Policy

Hard rules live in [`AGENTS.POLICY.md`](AGENTS.POLICY.md). **Load it before any non-trivial change.** Headlines: two-tier local CI gate, mandatory Git worktree rule, Web SPA gate for `src/Web/ControlEasyReborn.Web/**` changes, no EF Core / MediatR / MVC controllers, no cross-tenant access, no real-user data in tests, BCrypt ≥ 11, ProblemDetails + Serilog.

---

## Skill overlays

Load only when the task touches the overlay's domain.

- **AGENTS.POLICY.md** — Hard policy (CI gate, Web SPA gate, platform-aware exec, prohibitions, workflow ownership).
- **AGENTS.WORKTREES.md** — Mandatory Git worktree rule + naming convention.
- **AGENTS.STACK.md** — Stack, C# / Angular conventions, concurrency budget.
- **impeccable** — `.opencode/skills/impeccable/SKILL.md`. Frontend design skill.
- **agents-template** — `AGENTS-TEMPLATE.md`. Schema authoring + onboarding.
- **Playwright validation** — After any Angular SPA edit, smoke-test with the `webapp-testing` skill. Contributor responsibility, not auto-invoked.
- **docs/AGENT-TOKEN-OPTIMIZATION.md** — Per-turn token budget notes; load when troubleshooting turn-1 bloat.

---