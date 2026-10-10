<!-- Last reviewed: 2026-10-10 against constitution v1.7.0. Project-owned
     sibling file, not a workflow block — does not carry an AGENTS-SPEC
     freshness stamp (those belong only on workflow blocks per
     AGENTS-SPEC.md §Freshness stamps). -->

# Stack & Language Conventions — ControlEasy Reborn

Project-wide conventions that don't fit in `AGENTS.md` or `AGENTS.POLICY.md`.
Load this file when the task touches the corresponding language or stack.

## Stack

- **Backend:** ASP.NET Core 8 (C# 12, minimal API endpoints).
- **Frontend:** Angular 18 SPA (standalone components, signals).
- **Persistence:** MySQL 8, accessed via DBTools 1.4.3
  (`Linq<TModel>`, `IAsyncSqlClient`). No EF Core (ADR 0002). LINQ-first;
  raw SQL only for stored procs.
- **Auth:** JWT bearer.
- **Mapping:** Mapster. **Validation:** FluentValidation.
- **Testing:** xUnit + FluentAssertions + NSubstitute +
  Testcontainers.MySql + Playwright. Karma + Jasmine for Angular unit
  tests.
- **Runtime:** Docker Compose services: `api`, `web`, `db`,
  `reverse-proxy`, `adminer`, `seq`. Multi-stage Dockerfiles. Compose v2.
- **Error handling:** `ProblemDetails` (RFC 7807); Serilog to Console
  (JSON) + Seq. Domain exceptions: `NotFoundException`,
  `ValidationException`, `ConflictException`.

## C#

- File-scoped namespaces.
- `sealed` classes by default.
- `PascalCase` types and methods; `_camelCase` private fields; `ALL_CAPS`
  constants.
- Nullable enabled (`<Nullable>enable</Nullable>`).
- Warnings as errors (`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`).
- Central package versioning (`Directory.Packages.props`).
- REST routes: kebab-case, plural nouns (`/api/v1/residents`).
- Module layout: `Modules/<Feature>/{Domain,Application,Infrastructure,Api}/`.

## Angular / TypeScript

- Standalone components (`standalone: true`).
- `OnPush` change detection.
- Signals API for reactive state.
- `ce-` component prefix; kebab-case selectors.
- ESLint `@angular-eslint/recommended`; Prettier single quotes + 120 cols.
- TypeScript strict mode.
- DTOs generated from OpenAPI via `ng-openapi-gen`; no shared domain
  models between frontend and backend.

## Agent workflow conventions

- **Auto-tool selection.** Read the user's intent and invoke the right
  tool (spec-kit for implementation, BMAD for review/analysis, GSD for
  phase planning). See `docs/agent-flow-cheatsheet.md` for lifecycle
  diagrams.
- **Concurrency budget.** Max 3 sub-agents in flight per level (1 main +
  3 subs). Exceeding requires explicit rationale in the wave's
  `proposal.md`, `design.md`, or `tasks.md`.
- **Post-task verification.** see "Mandatory Local CI Verification Gate"
  in `AGENTS.POLICY.md`.
- **Pre-commit adversarial review.** No agent may `git commit` until
  (1) build + tests are green (including the full local CI gate) and
  (2) an adversarial review subagent returns zero CRITICAL/HIGH findings.
