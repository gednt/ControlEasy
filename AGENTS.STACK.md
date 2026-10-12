---
description: "Stack and language conventions for ControlEasy Reborn: ASP.NET Core 8 backend, Angular 18 frontend, MySQL 8, C# / TypeScript style rules, agent concurrency budget. Load before touching code in the corresponding language."
allowed-tools: [Read, Grep, Glob, Bash(dotnet *), Bash(npm *), Bash(npx *), Bash(make *)]
mode: primary
---

<!-- Last reviewed: 2026-10-10 against constitution v1.7.0. Project-owned sibling file. -->

# Stack & Language Conventions — ControlEasy Reborn

Load when the task touches the corresponding language or stack.

## Stack

- **Backend:** ASP.NET Core 8 (C# 12, minimal API endpoints).
- **Frontend:** Angular 18 SPA (standalone, signals).
- **Persistence:** MySQL 8 via DBTools 1.4.3 (`Linq<TModel>`, `IAsyncSqlClient`). LINQ-first; raw SQL only for stored procs.
- **Auth:** JWT bearer.
- **Mapping:** Mapster. **Validation:** FluentValidation.
- **Testing:** xUnit + FluentAssertions + NSubstitute + Testcontainers.MySql + Playwright. Karma + Jasmine for Angular.
- **Runtime:** Compose services `api`, `web`, `db`, `reverse-proxy`, `adminer`, `seq`. Multi-stage Dockerfiles, Compose v2.
- **Errors:** `ProblemDetails` (RFC 7807); Serilog to Console (JSON) + Seq. Domain exceptions: `NotFoundException`, `ValidationException`, `ConflictException`.

## C#

- File-scoped namespaces; `sealed` classes by default.
- `PascalCase` types/methods; `_camelCase` private fields; `ALL_CAPS` constants.
- `Nullable` enabled; `TreatWarningsAsErrors` true; central package versioning (`Directory.Packages.props`).
- REST routes: kebab-case, plural (`/api/v1/residents`).
- Module layout: `Modules/<Feature>/{Domain,Application,Infrastructure,Api}/`.

## Angular / TypeScript

- Standalone components, `OnPush` change detection, Signals API for reactive state.
- `ce-` component prefix; kebab-case selectors.
- ESLint `@angular-eslint/recommended`; Prettier single quotes + 120 cols; TypeScript strict mode.
- DTOs generated from OpenAPI via `ng-openapi-gen`; no shared domain models with backend.

## Agent workflow conventions

- **Concurrency budget.** Max 3 sub-agents in flight per level (1 main + 3 subs). Exceeding requires explicit rationale in the wave's `proposal.md` / `design.md` / `tasks.md`.
- **Post-task verification.** See `AGENTS.POLICY.md` §Mandatory Local CI Verification Gate.
- **Pre-commit adversarial review.** No `git commit` until (1) build + tests are green (full local CI gate) and (2) adversarial review returns zero CRITICAL/HIGH findings.