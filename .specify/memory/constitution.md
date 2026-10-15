<!--
Sync Impact Report (v1.7.0)
===========================
Version change: 1.6.0 → 1.7.0  (MINOR — OpenSpec removed from the project
  workflow. Principle VI is restated as a three-tool split (GSD, spec-kit,
  BMAD); Principle VII no longer lists OpenSpec in sub-agent ownership;
  Principle IX's composition line no longer names OpenSpec; Development
  Workflow § 3 (OpenSpec opt-in change-tracking) is removed and § 4 Seams
  drops the spec-kit ↔ OpenSpec, GSD ↔ OpenSpec, and OpenSpec ↔ BMAD
  handoffs; the source-of-truth table and cheat-sheet row no longer
  reference OpenSpec. AGENTS.md runtime guidance, AGENTS-SPEC.md,
  AGENTS-TEMPLATE.md, agents-init/SKILL.md, and
  docs/agent-flow-cheatsheet.md were updated in the same change. The
  openspec/ data directory and all vendor-fanout skill/command copies were
  deleted (change history preserved in git). No template files other than
  AGENTS-TEMPLATE.md were affected.


Deferred items (stable conditions, not point-in-time snapshots):
  - Legacy docs retirement: unchanged from prior reports.
  - STATE.md drift: unchanged from prior reports.
  - Skill-template cleanup: unchanged from v1.4.0 (bare `bash` snippets
    still unlabeled across skill bundles).
  - BMAD `<!-- owner:bmad -->` block in `AGENTS.md`: still empty.
    BMAD's `bmad-project-context` onboarding skill is the writer-of-
    record for that block; once it runs and writes project-specific
    BMAD context (e.g., which sub-modules are active, which agents are
    in scope), the freshness stamp should match the latest SHA per
    `AGENTS-SPEC.md` § "Freshness stamps". Out of scope for this
    constitutional amendment.
-->

# ControlEasy Reborn Constitution

## Core Principles

### I. Spec-Driven Development

Every shipped change starts with a spec under `.specs/<feature>/` and is implemented
against the checklist in `tasks.md`. Specs are the contract between intent and code;
the implementation plan (`plan.md`), task list (`tasks.md`), and review artifacts
(`review.md`, `analysis.md`) MUST be kept in sync with the code they describe. No
feature work begins without an approved spec folder. Strangler Fig migration
contracts — what is in, out, deferred, and how the legacy WPF app is replaced —
are recorded here and re-validated at every phase boundary.

**Rationale:** The legacy modernization spans 19+ spec folders, ~308 checkbox tasks,
and a long-running migration from WPF. Without spec-first discipline, the team
loses the single source of truth and ships accidental regressions. `AGENTS.md`
mandates the spec-driven workflow; this principle makes it non-negotiable.

### II. Multi-Tenant Isolation by Default

Every persisted entity, every query, and every API request is scoped to a tenant
(`TenantId` / `tenant_id` column + JWT `tenant_id` claim + `TenantFilterInterceptor`).
Cross-tenant data leakage is a P0 incident. PlatformAdmin-only paths (e.g.,
condominium administration, `/api/v1/demo/reset`) are the only legitimate
exceptions and MUST be guarded by `[Authorize(Roles = "PlatformAdmin")]` and an
explicit allowlist. Architecture tests enforce that no new entity ships without
`tenant_id` (with a documented `exemptTables` set for true platform tables such
as `DemoMetadata`, `Tenants`, `Migrations`).

**Rationale:** Condominium data is regulated personal data hosted in a shared
schema. A single missing filter in one repository is a privacy breach for an
entire condominium. Defending in depth — schema, interceptor, JWT claim, and
architecture test — is the only acceptable posture.

### III. LINQ-First Data Access (DBTools)

All data access goes through the DBTools `IAsyncSqlClient` / `Linq<TModel>`
primitives, preferring LINQ expressions (`WhereAsync`, `Select`, joins via
property selectors) for every query. Raw SQL via `SqlClient` is permitted only
for stored procedures or DB-specific features not covered by the LINQ provider,
and every raw-SQL site MUST carry a comment justifying the bypass. The target
provider is MySQL 8 today; code MUST NOT depend on MySQL-specific syntax in
LINQ paths so the system can move to PostgreSQL or SQL Server without code
changes. The library is consumed as the [DBTools 1.4.3 NuGet package](https://www.nuget.org/packages/DBTools);
the vendored copy under `src/lib/DBTools_SQL/` is being retired.

**Rationale:** `AGENTS.md` pins the data-access stack and `Directory.Packages.props`
pins the version. LINQ-first is a deliberate design constraint that gives
multi-provider portability and async/await end-to-end. Bypassing it for
convenience erodes both guarantees at once.

### IV. Test-First & Verification Discipline

Tests are written, observed to fail, and only then implemented (Red → Green →
Refactor). Unit tests (xUnit + FluentAssertions + NSubstitute), integration
tests (against Testcontainers-spun MySQL, with `WebApplicationFactory<Program>`
helpers), and architecture tests (NetArchTest.Rules) are mandatory for: new
entities, new endpoints, cross-tenant paths, raw-SQL sites, and any change to
the tenant filter interceptor. Every implementation task has a verification
gate — most tasks ship a `docker compose build && up -d` smoke plus a
`dotnet test` slice. The post-task verification rule from `AGENTS.md` operates on a two-tier cadence:
(1) **Per-Turn Fast Gate:** Automated stop hooks enforce fast verification (`scripts/verify-ci-local.sh --fast`) on each conversational turn where files are modified (format, build, unit + arch tests in ~3s, zero Docker downloads).
(2) **Task Completion / End of All Tasks Full Gate:** The entire local CI verification gate (`scripts/verify-ci-local.sh` or `make verify-ci`) must pass cleanly on the final code state before committing, pushing, or reporting the task as done. The CI tasks that need to download things inside Docker (Testcontainers MySQL integration tests and Angular Docker production build) run **only once per task completion, at the end of all tasks completions, not after every turn**. Claiming completion without a verified green run of the full local CI suite is a constitutional violation.

**Rationale:** A modular monolith with 9 feature modules, a multi-tenant data
model, and a Strangler Fig migration in flight is a regression factory without
disciplined tests. TDD is the cheapest place to catch a tenant leak, a missing
migration, or a broken contract.

### V. Observability, Security, and Runtime Container Parity

The system is observable, secure, and identical between local and production.
Structured logging via Serilog (Console JSON + Seq/file sinks) is mandatory for
every backend request path. Errors surface as RFC 7807 `ProblemDetails` mapped
from domain exceptions (`NotFoundException`, `ValidationException`,
`ConflictException`). Authentication is JWT bearer (HS256 minimum, RS256
preferred) with secrets from environment variables or Docker secrets — never
hard-coded. The Docker Compose stack (`api`, `web`, `db`, `reverse-proxy`,
`adminer`, optional `seq`, optional `redis`) is the source of truth for the
**runtime target**: anything that "works on my machine but not in Compose" is a
bug. The demo overlay (`docker-compose.demo.yml`) and its JWT signing key are
**never** used in production.

**Dev shell (sub-bullet):** There is exactly one canonical dev shell — the
[devcontainer](https://containers.dev/) under `.devcontainer/` (see
`.specs/devcontainers/`). It mounts the host's Docker socket
(Docker-out-of-Docker) so that `docker compose` invocations inside the dev
shell target the same engine and volumes as the host. The devcontainer is a
**uniform shell**, not a parallel runtime: the verification gate is still the
Compose stack. The host shell (Windows PowerShell, macOS/Linux POSIX) is an
**acceptable fallback for trivial read-only inspection only** (e.g., `git
status`, `ls`, `cat`); it MUST NOT be used to run build / test / lint /
restore commands, install dependencies, or invoke the verification gate.

**Canonical bring-up procedure (per worktree, per session):**

1. **Open the worktree in a devcontainer-aware IDE** (VS Code, Cursor,
   JetBrains, GitHub Codespaces). The IDE MUST attach to the devcontainer
   defined by `.devcontainer/devcontainer.json`; an `AUTO_START_COMPOSE=true`
   env var auto-runs the bring-up, otherwise step 2 is manual.
2. **Bring up the Compose stack** (canonical first boot of a worktree):
   ```bash
   docker compose -p ce-<branch-hyphens> \
     -f docker/docker-compose.yml \
     -f docker/docker-compose.worktree.<branch-hyphens>.yml \
     up -d --build
   ```
   The `-p` (project) flag scopes container names, networks, and the MySQL
   volume to this worktree; the worktree override (built from
   `docker/docker-compose.worktree.template.yml`) pins the unique hostname,
   host port, and DB volume declared in the `AGENTS.md` "Worktree naming
   convention" table.
3. **Wait for health.** All services MUST reach their `health: healthy`
   state before any verification step. `docker compose -p ce-<branch> ps`
   reports the per-service state; the `api` service's `/health` endpoint is
   the canonical readiness probe.
4. **Run the verification gate** (inside the devcontainer):
   ```bash
   docker compose -p ce-<branch> exec -T api \
     dotnet test /workspace/tests/ControlEasyReborn.UnitTests
   # repeat for IntegrationTests and ArchitectureTests; then
   docker compose -p ce-<branch> exec -T web \
     npm test -- --no-watch --browsers=ChromeHeadless
   ```
   No verification step is "done" until every affected container is
   observed healthy AND every test slice exits 0.
5. **Tear down** (when the worktree is merged or abandoned):
   `docker compose -p ce-<branch> down -v` removes only that worktree's
   containers, networks, and volume. Other worktrees are untouched.
6. **Override paths** are explicit, not implicit. The demo overlay
   (`docker-compose.demo.yml`) replaces the worktree override in step 2 when
   demo data is wanted; the `scripts/verify-devcontainer.sh` script replaces
   steps 2–5 for an unattended end-to-end gate. No other overlay may be
   applied without a recorded rationale in the originating spec.

**Worktree per feature branch** (see `AGENTS.md` "Dev containers &
worktrees") is the standard shape for parallel work: each worktree gets its
own Compose project, its own DB volume, and its own host port, so two
worktrees can run simultaneously without colliding.

**Rationale:** Condominium operators are not developers; when something breaks
at the gatehouse, the on-call engineer must be able to read the logs, replay
the request, and roll back without leaving Docker. Production parity is the
cheapest way to ensure that. The dev shell is separate from the runtime
target: we want a uniform, reproducible dev experience (devcontainer) without
giving up "Compose is the runtime" (the verification gate is unchanged).

### VI. Workflow Tooling (GSD / spec-kit / BMAD)

The project runs three workflow systems. Two of them — **GSD** and
**spec-kit** — own implementation and planning artifacts. The third —
**BMAD** — is the review/analysis/adversarial-quality layer (see
Principle IX for its full scope). Each has a single, non-overlapping
responsibility, and the three compose so that BMAD questions, spec-kit
implements, and GSD plans and gates:

- **GSD** (`.planning/`) is the **planner and roadmap owner**. `PROJECT.md`
  holds the high-level brief and the validated/active/out-of-scope lists.
  `REQUIREMENTS.md`, `ROADMAP.md`, and `STATE.md` track the 14-phase rollout
  and the live execution state. `.planning/codebase/` holds the seven
  code-base maps (STACK, STRUCTURE, ARCHITECTURE, CONVENTIONS, CONCERNS,
  INTEGRATIONS, TESTING) consumed by every other tool. GSD phase boundaries
  (via `/gsd-transition`, `/gsd-complete-milestone`) are the moments at which
  documentation is re-validated.
- **spec-kit** (`.specs/`, `.specify/`) is the **per-feature spec owner**.
  Every feature or bug fix lives under `.specs/<feature>/` with the
  artifacts defined in `AGENTS.md` (the `requirements.md` / `design.md` /
  `tasks.md` triple, with optional `bugfix.md` / `review.md` / `analysis.md`).
  `.specify/memory/constitution.md` (this file) is the binding governance
  document for spec-kit. The speckit-command skills (`.agents/skills/`)
  are the interface between human intent and spec-kit artifacts.
- **BMAD** (`_bmad/`, `_bmad-output/`) is the **review, analysis, and
  adversarial-quality layer** — see Principle IX for full scope, agent
  roles, and ownership rules. BMAD does NOT plan, implement, or
  change-track; it questions, audits, and produces evidence. Its
  findings are consumed by the other two tools but are not
  auto-applied.

The **legacy `docs/` generation pipeline** (the output of
`bmad-document-project --mode deep` runs) is **deprecated as a source
of truth** and is on a retirement schedule (see § "Documentation
Systems and Source of Truth" below). The live BMAD configuration and
the BMAD-bundled WDS agents are unaffected; only the deep doc-gen
output that drifts from `.planning/codebase/` is deprecated.

**Rationale:** Three overlapping spec systems (GSD + spec-kit + a
separate change-tracking layer) plus an undeclared reviewer (BMAD) is
one too many for a small team to keep straight. Pinning each remaining
tool to a single responsibility is cheaper than consolidating to one:
GSD's roadmap + codebase maps are hard to replicate, spec-kit's
per-feature template is hard to replicate, and BMAD's
adversarial-review persona roster is hard to replicate from scratch.
The three roles compose: BMAD questions, spec-kit implements, GSD
plans and gates. OpenSpec was adopted as an unused opt-in forward-
compatible slot and was removed at v1.7.0 (its change history remains
in git); the change-tracking responsibility it held is folded into
spec-kit's per-feature `.specs/<feature>/` contract. The legacy `docs/`
generation pipeline duplicates `.planning/codebase/` and
`.specs/<feature>/design.md` content and drifts; retirement is
cheaper than keeping it in sync.

### VII. Sub-Agent Orchestration & Concurrency Budget

Any agent — including a main orchestrator and any in-flight sub-agent —
MAY invoke any of GSD, spec-kit, or BMAD skills as a sub-agent when
the work at hand crosses the seam between the tools (see §
"Development Workflow & Quality Gates" → "Seams"). Sub-agent
invocation MUST NOT bypass the ownership rules in Principle VI: a
sub-agent writes only to the directory owned by its own workflow tool
(GSD → `.planning/`, spec-kit → `.specs/` and `.specify/`); it reads
from the other tools' directories but does not rewrite them; the
sub-agent's parent is responsible for catching
ownership violations before they land.

**Concurrency budget.** The default concurrency budget is **up to 3
sub-agents in flight concurrently, in addition to the main
orchestrator** (total in-flight count per level: 4 = 1 main + 3 subs).
The budget is **per agent, not per workflow tool**: a sub-agent that
itself spawns sub-agents gets its own independent budget of 3 — a
sub-agent may not "consume" its parent's budget. Exceeding the budget
(4+ sub-agents in flight at any level) is permitted only when the
originating artifact records an explicit rationale in its
`proposal.md` "Why" section, `design.md` "Decisions" section, or
`tasks.md` task description for the wave in question. The rationale is
reviewed at the next `/gsd-complete-milestone` boundary. No environment
variable, config file, or CLI flag overrides the budget — the override
is qualitative and lives next to the work it justifies.

**Rationale:** Without a bound on fan-out, an autonomous agent can
spawn a fan-in cascade that exhausts the context budget or produces
unbounded per-step latency. A per-agent, per-level budget of 3 keeps
fan-out predictable while still permitting the parallelism that
wave-based GSD plans and spec-kit `[P]` task markers rely on. The
qualitative override path (rationale recorded in the originating
artifact) ensures that an exception is visible at the next milestone
audit without a separate scan — the rationale lives next to the work
it justifies.

### VIII. Host-OS / Shell-Aware Command Execution

Agents MUST detect the **host operating system and shell** before issuing
any terminal command, and MUST NOT run commands whose syntax, flags, or
runtime semantics require a different platform than the one they are
running on. Concretely:

- **Windows hosts** (PowerShell 7+ / `pwsh`, `cmd`, or Git Bash):
  POSIX-only shell scripts (e.g., `#!/usr/bin/env bash`, `set -euo
  pipefail`, `[[ ... ]]`, `$(...)` inside single-quoted heredocs,
  `tr`, `awk`, `sed -i ''`, GNU-only flags, `&&` chains inside
  container-of-containers scripts) MUST NOT be invoked directly from the
  host shell. When the user is on Windows and the skill example is a
  POSIX shell snippet, the agent MUST either (a) translate it to a
  Windows-runnable form and call that out in the reply, or (b) instruct
  the user to run it inside the devcontainer (Principle V) or via the
  project's cross-platform wrappers (`scripts/worktree-up.ps1` /
  `scripts/worktree-down.ps1`). Running `bash`, `sh`, or POSIX-only
  binaries that the host lacks is a constitutional violation, not a
  recoverable error.
- **macOS / Linux hosts** (`bash`, `zsh`, `fish`): POSIX syntax is
  valid. Windows-only constructs (PowerShell `Get-ChildItem`,
  `Remove-Item -LiteralPath`, `New-Item -ItemType Directory`,
  backtick escaping, `Test-Path -LiteralPath`) MUST NOT be issued from
  a POSIX host.
- **Devcontainer shell** (Debian + bash, regardless of host OS): all
  POSIX snippets documented in `AGENTS.md`, `docs/`, and the skill
  bundles are valid inside the devcontainer, because the devcontainer
  is the canonical POSIX surface for this project (Principle V). The
  devcontainer does not, by itself, make a POSIX command valid on the
  host shell; the host still has to delegate via `docker compose exec`.

**Skill and document examples.** Skills and docs MUST prefer
**platform-neutral composition**: when a snippet is illustrative, the
preferred form is `docker compose -p "$PROJ" -f ... <verb>`, which is
valid on every host because Compose runs inside the container engine,
not the host shell. POSIX-only snippets are allowed when they are
explicitly labeled as **devcontainer-only** or **CI-only**. Bare `bash`
code blocks without a host label are assumed to be devcontainer
snippets; an agent running on Windows MUST NOT paste them into a
PowerShell invocation without translation.

**Detection and recovery.** When a command fails because of a platform
mismatch (e.g., `'&&' is not a valid statement separator in this
shell`, `The term 'bash' is not recognized`, `Permission denied` on a
POSIX binary, `cmd.exe` not found inside `docker compose exec`), the
agent MUST stop, identify the platform mismatch, and either retry via
the correct shell (`pwsh -Command '...'` on Windows, `bash -c '...'`
inside the devcontainer) or escalate to the user with a one-line
explanation. The agent MUST NOT chain a second platform-specific
command after the first fails; that compounds the error.

**Rationale:** Without this rule, agents invent commands that look
plausible but fail on the user's host — e.g., issuing `rm -rf node_modules`
from PowerShell, or `Get-ChildItem -Recurse | Select-String` from
bash. The fix is rarely "try again with a flag"; it is "use the
correct shell for the correct host". Principle V already establishes
the devcontainer as the uniform POSIX surface; this principle makes
the boundary explicit and prevents agents from accidentally bypassing
it by writing host-shell code that the devcontainer was meant to
eliminate.

### IX. BMAD Review, Analysis, and Adversarial-Quality Layer

BMAD (the BMAD Method + WDS agents) is the project's **review, analysis,
and adversarial-quality layer**. It is the **third workflow tool**,
peer to GSD / spec-kit, with a non-overlapping
responsibility: **questioning and auditing the other two** rather than
implementing or planning them. Concretely:

- **Owned artifacts.** BMAD owns `_bmad/` (configuration and skill
  bundles — `_bmad/bmm/`, `_bmad/tea/`, `_bmad/cis/`, `_bmad/wds/`,
  `_bmad/core/`, `_bmad/custom/`) and `_bmad-output/` (planning and
  analysis artifacts: `planning-artifacts/{briefs,prds,research}/`,
  `implementation-artifacts/` (per-spec dev artifacts and the
  `deferred-work.md` ledger), `test-artifacts/`,
  `party-mode/memories/`). BMAD does NOT own source code, feature
  specs under `.specs/`, the constitution under `.specify/`, or the
  roadmap under `.planning/`. Those remain with their respective tools (Principle VI).
- **Roles and agents.** BMAD's named agents have a fixed
  responsibility split, recorded here so any agent (including a
  sub-agent per Principle VII) knows which persona to dispatch for
  which review:
  - **Mary** (analyst, `bmad-agent-analyst`) — research, evidence
    gathering, stakeholder voice. Produces briefs and analytical
    reviews.
  - **John** (PM, `bmad-agent-pm`) — Jobs-to-be-Done, scope, MVP
    framing. Produces PRDs and prioritization reviews.
  - **Winston** (architect, `bmad-agent-architect`) — invariants,
    architecture spines, decision rationale. Produces architectural
    review artifacts.
  - **Murat** (Test Architect / TEA, `bmad-tea`) — test architecture,
    NFR audits, traceability. Produces `test-artifacts/` outputs and
    quality-gate verdicts.
  - **Sally** (UX designer, `bmad-agent-ux-designer`) — UX patterns,
    design specifications. Produces UX work orders.
  - **Paige** (tech writer, `bmad-agent-tech-writer`) — knowledge
    curation, editorial review. Produces editorial passes and
    procedural docs.
  - **Amelia** (dev, `bmad-agent-dev`) — story execution. In the
    Reborn project the implementation role has moved to spec-kit's
    `/speckit-implement` (Principle VI); BMAD's Amelia persona is
    retained for BMAD-internal flows (e.g., legacy `bmad-dev-story`
    workflows) but MUST NOT be used to bypass spec-kit's
    implementation gate.
  - **CIS sub-personas** (Dr. Quinn problem-solver, Maya design-
    thinking coach, Carson brainstorming coach, Victor innovation
    strategist, Caravaggio presentation master, Sophia storyteller,
    plus WDS's Saga analyst and Freya designer) — used for creative
    and design-thinking work; outputs land in `_bmad-output/` under
    the relevant subfolder.
- **What BMAD does.** BMAD produces four kinds of artifact, each with
  a fixed home:
  1. **Briefs and PRDs** (analyst + PM) — long-form planning artifacts
     that predate a per-feature spec. They live in
     `_bmad-output/planning-artifacts/{briefs,prds}/<id>/`. When a
     brief or PRD matures into a feature, the per-feature spec is
     created via spec-kit's `/speckit-specify`; the BMAD artifact
     remains the *intent* record and is cross-referenced from the
     spec's `requirements.md` "Upstream" section.
  2. **Implementation specs** (`bmad-dev-story`, `bmad-quick-dev`) —
     per-story dev artifacts under
     `_bmad-output/implementation-artifacts/`. These are the BMAD
     analogue of spec-kit's `.specs/<feature>/tasks.md`; the two
     coexist when both workflows are active on the same change, and
     the spec-kit `tasks.md` is the **verification-gate source of
     truth** (per Principle VI § 3 Seams). BMAD implementation specs
     MUST NOT be the source of truth for the verification gate.
  3. **Review and analysis** (`bmad-review`, `bmad-review-adversarial-
     general`, `bmad-review-edge-case-hunter`, `bmad-code-review`,
     `bmad-check-implementation-readiness`,
     `bmad-testarch-trace`, `bmad-testarch-nfr`) — adversarial
     findings, edge-case catalogs, NFR audits, traceability matrices.
     Outputs land in `_bmad-output/` under the relevant subfolder and
     are the *evidence* consumed by GSD's `/gsd-validate-phase`,
     `/gsd-secure-phase`, `/gsd-audit-milestone`, and by spec-kit's
     `/speckit-converge` and `/speckit-analyze`. The findings are
     consumed but NOT auto-applied; the implementing workflow owns
     the decision to act.
  4. **Deferred-work ledger** — `_bmad-output/implementation-artifacts/
     deferred-work.md` is the canonical log of issues that are out of
     scope for the current change but must not be forgotten. Each
     entry carries a `source_spec` pointer back to the spec or
     implementation artifact that produced it. Promoting a deferred
     item back into active work is a GSD decision (`/gsd-transition`
     or `/gsd-complete-milestone`), not a BMAD-only action.
- **Adversarial review gate.** The pre-commit gate from
  `AGENTS.md` ("Pre-commit adversarial review: no agent may
  `git commit` until (1) build + tests are green and (2) an
  adversarial review returns zero CRITICAL/HIGH findings")
  is a BMAD gate. The adversarial reviewer is `bmad-code-review`
  (or `bmad-review-adversarial-general` for non-code artifacts).
  The review is **cross-agent**: the reviewer runs in a fresh
  session of an AI *other than* the one that authored the change
  (never a same-session self-review). Authoring harness routes the
  reviewer through the sibling CLI — running in **OpenCode**,
  dispatch via the Codex CLI (`codex exec`); running in **Codex**,
  dispatch via the OpenCode CLI (`opencode run`). On other
  harnesses, prefer an available sibling CLI. If no sibling CLI is
  available or it fails, fall back to an in-harness sub-agent
  (Principle VII) on a model family **different from the authoring
  model's**, and record the degradation in the review output
  (never downgrade silently). CRITICAL/HIGH findings
  block the commit; MEDIUM/LOW findings are advisory and MUST be
  filed into the deferred-work ledger if not fixed in the same
  commit.
- **Party-mode.** `_bmad-output/party-mode/memories/installed/
  .memlog.md` is the canonical session diary for multi-persona
  discussions (the `bmad-party-mode` orchestrator). It is
  **historical evidence**, not state. Project state lives in
  `.planning/STATE.md` (GSD's writer-of-record) — party-mode
  findings that affect state MUST be promoted to STATE.md via
  `/gsd-transition` or `/gsd-complete-milestone`.
- **Ownership across seams.** A BMAD sub-agent writes only to
  `_bmad/` and `_bmad-output/`. It MAY read from `.planning/`,
  `.specs/`, `.specify/`, and the source tree, but
  MUST NOT rewrite them. If a BMAD finding implies a change to a
  spec-kit `tasks.md` or a GSD `STATE.md`, the
  BMAD agent emits the finding and the owning workflow's agent
  applies the change. This is the same ownership rule as
  Principle VII; stated here so BMAD-specific invocations do not
  drift.
- **WDS as a BMAD submodule.** WDS (`_bmad/wds/`) is the
  design-thinking surface inside BMAD (Saga analyst, Freya designer,
  Mimir builder). It is governed by Principle IX like the rest of
  BMAD; its outputs (project brief, UX specifications, Work Orders)
  feed into the same `_bmad-output/planning-artifacts/` tree. Mimir's
  build role is retained for headless WDS runs but, like Amelia,
  MUST NOT be used to bypass spec-kit's implementation gate.

**Rationale:** Without a constitutional principle, BMAD's role is
implicit: it shows up in `AGENTS.md` as "BMAD for review/analysis"
and in the cheat sheet as a seam participant, but its ownership
boundaries, the meaning of its artifact names, and its relationship
to the verification gate are open to interpretation. Pinning the
three-tool split (GSD = planner, spec-kit = implementer, BMAD =
reviewer/analyst) prevents two failure
modes: (1) BMAD becoming a parallel implementation path that
bypasses spec-kit's gate, and (2) BMAD reviews being silently
ignored because no rule says which workflow acts on them. The three
roles compose: BMAD questions → spec-kit implements → GSD plans and
gates.

## Stack & Architecture Constraints

The stack is fixed by `AGENTS.md` and the modernization roadmap. New code MUST
conform.

- **Frontend:** Angular 18+ SPA, standalone components, signals, TypeScript
  strict mode. Domain models are NOT shared with the backend — Angular owns its
  own DTOs generated from the OpenAPI schema (`ng-openapi-gen` or `nswag`).
- **Backend:** ASP.NET Core 8 (LTS) Web API, C# 12, file-scoped namespaces,
  `record` DTOs, `sealed` classes by default, async/await end-to-end.
- **Architecture:** Modular monolith with Clean Architecture per module
  (`Domain` → `Application` → `Infrastructure` → `Api`). Module-per-feature
  under `src/Modules/<Feature>/`. Vertical slices where they reduce coupling.
  CQRS-lite is permitted for read/write-heavy paths (e.g., reports).
- **Layout:** `src/` (Host, Web, BuildingBlocks, Modules), `tests/`, `docker/`,
  `docs/`. API routes are kebab-case, plural nouns, versioned at
  `/api/v1/...`.
- **Mapping:** Mapster or AutoMapper; **Validation:** FluentValidation;
  **OpenAPI:** Swashbuckle on the API.
- **Containerization:** Docker + Docker Compose. Base images are checked
  with `docker image inspect` before pulling to avoid MCR rate-limiting. Builds
  run with `COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1`.
- **Cross-cutting:** Serilog for logging, FluentValidation for input, Mapster
  for mapping, Swashbuckle for OpenAPI, JWT bearer for auth. No Entity
  Framework, no `MySql.Data` in Reborn code.

## Security & Compliance Requirements

- **Secrets** (DB connection string, JWT signing key, third-party API keys)
  are loaded from environment variables or Docker secrets. The legacy
  hard-coded credentials in `App.config` are not present in Reborn and MUST
  never reappear.
- **Authentication** is JWT bearer; passwords are BCrypt-hashed (cost ≥ 11).
  PlatformAdmin bootstrap on first boot is a one-shot hosted service and is
  disabled in demo mode.
- **Authorization** is role-based plus per-tenant scope. Roles include
  `PlatformAdmin`, `TenantAdmin`, `Porteiro`, `Resident`, `ServiceProvider`,
  `Multi`. Cross-role access is denied by default and granted only with an
  explicit policy.
- **Personal data** is limited to what the gatehouse operation requires
  (residents, visitors, vehicles, service providers, apartments). Data
  retention rules are deferred to the separate data-migration spec.
- **Demo data and credentials are not production data.** The demo overlay
  is segregated by `docker-compose.demo.yml`, its JWT key is fixed and
  well-known, and a prominent banner in the UI tells every signed-in user
  they are on a demo stack. `POST /api/v1/demo/reset` is PlatformAdmin-only
  and returns 404 when demo mode is off.

## Development Workflow & Quality Gates

The project runs two implementation workflow tools — **GSD** and
**spec-kit** — plus **BMAD** as the review layer (Principle IX) —
each with a single, non-overlapping responsibility (Principle VI), and any agent
MAY invoke either implementation tool (or BMAD review skills) as a sub-agent within the
concurrency budget
(Principle VII). This section describes how each tool works day-to-day and,
critically, the **seams** where they hand off to each other so the tools
compose into one development loop rather than parallel ones.

### 1. GSD — planner and roadmap owner (`.planning/`)

GSD owns the project-level state: the roadmap, the requirements, the live
execution state, and the seven codebase maps. Every agent reads it before
doing anything else; every agent that changes state updates it.

**Phase lifecycle.** The roadmap is a sequence of phases. A phase moves through
a standard lifecycle, each step a `/gsd-*` command:

1. `/gsd-discuss-phase <N>` — surface scope, assumptions, and decisions;
   produce `CONTEXT.md`.
2. `/gsd-plan-phase <N>` — spawn `gsd-phase-researcher` (writes `RESEARCH.md`)
   then `gsd-planner` (writes `NN-PLAN.md`); verify with `gsd-plan-checker`
   until the plan passes.
3. `/gsd-execute-phase <N>` — wave-based parallel execution; each plan gets a
   `gsd-executor` subagent that runs tasks atomically and commits per task.
4. `/gsd-verify-work <N>` — conversational UAT; produce `NN-UAT.md`; if gaps
   are found, `/gsd-execute-phase <N> --gaps-only` closes them.
5. `/gsd-validate-phase <N>` — retroactive Nyquist audit of test coverage;
   produce `VALIDATION.md` + generated tests.
6. `/gsd-transition` — advance the roadmap pointer; re-validate `PROJECT.md`,
   `REQUIREMENTS.md`, and this constitution against what shipped.
7. `/gsd-complete-milestone <version>` — at a milestone boundary: archive
   roadmap + requirements to `.planning/milestones/`, update `PROJECT.md`,
   tag the release, and trigger the legacy-`docs/` retirement schedule
   (see "Documentation Systems and Source of Truth" below).

**Artifacts GSD owns:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`,
`STATE.md`, `.planning/codebase/{STACK,STRUCTURE,ARCHITECTURE,CONVENTIONS,
CONCERNS,INTEGRATIONS,TESTING}.md`, and per-phase folders under
`.planning/phases/<NN>-<slug>/` (`CONTEXT.md`, `RESEARCH.md`, `NN-PLAN.md`,
`NN-SUMMARY.md`, `NN-VERIFICATION.md`, `VALIDATION.md`, `NN-UAT.md`).

**Decisions and rationale.** GSD `STATE.md` is the canonical home for the
*decision and rationale* of any architectural choice; spec-kit `review.md` /
`analysis.md` holds the *finding* that prompted it (see "Documentation
Systems and Source of Truth").

### 2. spec-kit — per-feature spec owner (`.specs/`, `.specify/`)

spec-kit owns the per-feature implementation contract. Every feature or bug
fix lives under `.specs/<feature>/`. The spec-kit command skills
(`.agents/skills/speckit-*`) are the interface between human intent and the
spec artifacts. The pipeline is four commands, run in order:

1. `/speckit-specify "<description>"` — create `.specs/<feature>/spec.md`
   from the feature description; generate a quality checklist under
   `.specs/<feature>/checklists/`; resolve up to 3 `[NEEDS CLARIFICATION]`
   markers with the user. Output: `spec.md` (user stories with priorities,
   functional requirements, success criteria, edge cases).
2. `/speckit-plan` — fill `plan.md` from the template: Technical Context,
   Constitution Check (read from this file), Phase 0 `research.md`,
   Phase 1 `data-model.md` + `contracts/` + `quickstart.md`. Re-evaluate
   the Constitution Check after design.
3. `/speckit-tasks` — generate `tasks.md` organized by user story (Setup →
   Foundational → one phase per story in priority order → Polish), with
   `[P]` parallel markers, `[USn]` story labels, exact file paths, and a
   dependency graph.
4. `/speckit-implement` — execute `tasks.md` phase-by-phase, marking each
   task `[X]` as it lands; respect `[P]` parallelism and TDD ordering where
   tests are requested.

**Auxiliary commands:** `/speckit-clarify` (resolve remaining
clarifications), `/speckit-checklist` (generate domain checklists — UX,
security, test, etc.), `/speckit-converge` (consolidation),
`/speckit-analyze` (code analysis → `analysis.md`),
`/speckit-constitution` (amend this file).

**This constitution is the binding governance document for spec-kit.**
`/speckit-plan` Phase 0 reads `.specify/memory/constitution.md` and fills
the `plan.md` "Constitution Check" section from it; any violation that
cannot be justified in the plan's Complexity Tracking table blocks
planning. spec-kit does NOT own the roadmap or the phase state — it owns
the per-feature contract that GSD phases consume.

### 3. Seams — how the tools compose

The tools (GSD, spec-kit, BMAD) are designed to hand off
to each other at well-defined points. The seams below are
non-negotiable. Sub-agent invocation across these seams is governed by
Principle VII; the ownership rules in this section apply equally to
sub-agents as to main orchestrators. The sub-agent invocation
protocol and concurrency budget that govern cross-tool fan-out are in
Principle VII (and reproduced as operator guidance in `AGENTS.md`
(Policy: Concurrency budget) and in `docs/agent-flow-cheatsheet.md`
§ 4 and § 5). The seams
below assume that protocol and do not repeat it.

**Ownership principle.** GSD owns `.planning/` — it is the single writer
of the roadmap pointer, the phase state, and the milestone archive, and
the single reader-of-record for project-level state. The other tool
(spec-kit) is a **writer** to `.planning/` whenever its work changes
project state, and a **reader** of `.planning/` whenever it needs
project context. Concretely: spec-kit and BMAD MUST update
`.planning/STATE.md` (decisions, blockers, deferred items) and
`.planning/PROJECT.md` (validated/active/out-of-scope lists) when their
work changes those facts; they MUST NOT update `ROADMAP.md`, the phase
pointer, or the milestone archive — those are GSD's job
(`/gsd-transition`, `/gsd-complete-milestone`). Conversely, GSD consumes
`.specs/<feature>/` and BMAD artifacts but MUST NOT
rewrite them — e.g., GSD editing a `.specs/<feature>/tasks.md` checkbox
is a constitutional violation (that is spec-kit's job via
`/speckit-implement`); GSD editing a `_bmad-output/implementation-
artifacts/<id>.md` is a constitutional violation (that is BMAD's job
via the relevant `bmad-*` workflow).

- **GSD → spec-kit.** A GSD phase references one or more spec-kit
  `.specs/<feature>/` folders in its phase detail block
  (`ROADMAP.md` → "Phase N" → "Specs:"). The GSD planner reads the
  spec-kit `tasks.md` to size the phase; the GSD executor reads the same
  `tasks.md` to run tasks. GSD does NOT rewrite the spec-kit artifacts —
  it consumes them.
- **spec-kit → GSD.** When a spec-kit task completes, the executor
  updates `.planning/STATE.md` (decisions, blockers, deferred items)
  and, if a requirement is validated or invalidated, `.planning/
  PROJECT.md` (move between the Active / Validated / Out-of-Scope
  lists) so the next GSD command sees fresh state. spec-kit does NOT
  advance the roadmap pointer or mark phases complete — that is GSD's
  job (`/gsd-transition`, `/gsd-complete-milestone`).
- **GSD ↔ BMAD.** GSD does not directly invoke BMAD agents, but
  consumes BMAD's outputs. At phase boundaries, BMAD's review
  artifacts (`_bmad-output/test-artifacts/`,
  `_bmad-output/implementation-artifacts/<id>.md`) are inputs to
  `/gsd-validate-phase`, `/gsd-secure-phase`, and
  `/gsd-audit-milestone`. At milestone boundaries,
  `_bmad-output/implementation-artifacts/deferred-work.md` is
  reviewed for promotion into `.planning/REQUIREMENTS.md` (GSD's
  writer-of-record). GSD MUST NOT rewrite `_bmad-output/`; it cites
  the artifacts and lets the implementing workflow apply changes.
- **spec-kit ↔ BMAD.** spec-kit is the primary consumer of BMAD
  reviews. The spec-kit `analysis.md` artifact is produced by
  `/speckit-analyze`, which may call BMAD review skills as
  sub-agents; CRITICAL/HIGH findings block the next
  `/speckit-implement` run. Conversely, when a spec-kit implementation
  reveals a quality issue, the spec-kit executor may dispatch a
  `bmad-review-adversarial-general` sub-agent on the diff (per
  Principle IX "Adversarial review gate") and file the findings into
  the spec-kit `review.md`. BMAD MUST NOT rewrite `.specs/<feature>/`
  files; it emits findings and the spec-kit agent applies changes.
- **Constitution.** This file is the shared governance contract for all
  three. spec-kit reads it at `/speckit-plan` Phase 0; GSD re-validates
  it at every phase transition (`/gsd-transition`) and milestone
  (`/gsd-complete-milestone`); BMAD reviews it at every milestone audit via
  `bmad-check-implementation-readiness` and reports drift findings
  to GSD for amendment (the amendment itself is GSD's job — BMAD
  does not edit the constitution).

### 4. Quality gates

The verification gate is the same in every mode and is owned by the
runtime target — the Docker Compose stack — not by any of the three
workflow tools. The tools produce the code; the gate verifies the code.

- **Per-task gate (spec-kit `/speckit-implement`).** A task is "done"
  only when: (1) the code lands on the branch, (2) the `tasks.md`
  checkbox is marked `[X]`, (3) the affected Docker services are rebuilt
  and observed healthy
  (`docker compose build api web && up -d --force-recreate api web`),
  (4) the task's test slice passes (`dotnet test` for the affected
  test projects), and (5) the entire local CI suite passes cleanly
  (`scripts/verify-ci-local.sh`). Automated agent Stop hooks in
  `.agents/hooks.json`, `.agent/hooks.json`, `.claude/settings.local.json`,
  `.codex/hooks.json`, and `.cursor/hooks.json` enforce this gate prior
  to allowing any agent loop to finish. Architecture tests are non-skippable
  for any change touching the tenant filter, an entity, or an endpoint.
- **Per-phase gate (GSD `/gsd-verify-work`, `/gsd-validate-phase`).**
  Before a phase transitions, the phase's UAT
  (`NN-UAT.md`) must be clean or its gaps closed via
  `/gsd-execute-phase <N> --gaps-only`, and the Nyquist validation
  (`VALIDATION.md`) must be green.
- **Per-milestone gate (GSD `/gsd-complete-milestone`).** Before a
  milestone is archived, `/gsd-audit-milestone` must pass; the
  legacy-`docs/` retirement schedule is re-checked; the constitution is
  re-validated against what shipped; and any concurrency-budget
  override rationales recorded during the milestone (Principle VII)
  are audited.
- **Per-PR gate.** Every PR MUST pass `dotnet test` for the affected
  test projects (Unit, Integration, Architecture) and the Docker rebuild
  smoke. A `.specs/.../review.md` (or a PR comment linking to one) is
  required for any change that touches a contract, an entity, or the
  tenant filter. Commit messages reference the spec-kit task ID
  (e.g., `T014: add resident filter to visits query`). No force-pushes
  to `main`/`master`.
- **Per-constitutional-change gate.** Any change to this file requires
  a Sync Impact Report at the top, a version bump per semantic
  versioning, and maintainer approval (see Governance). The agent that
  amends the constitution MUST propagate the change to
  `AGENTS.md` runtime guidance and flag any affected templates in the
  Sync Impact Report.

## Documentation Systems and Source of Truth

Every documentation system has a single canonical home. Conflicts between
systems are resolved in favor of the system that owns the artifact in
question; if two systems claim the same artifact, the newer system is
correct and the older one is stale.

| Artifact | Canonical home | Owner | Notes |
|---|---|---|---|
| Project brief, validated/active/out-of-scope lists | `.planning/PROJECT.md` | GSD | Re-validated at every phase transition. |
| Roadmap (14 phases), requirements, live state | `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` | GSD | Updated by `/gsd-*` skills. |
| Codebase maps (STACK, STRUCTURE, ARCHITECTURE, CONVENTIONS, CONCERNS, INTEGRATIONS, TESTING) | `.planning/codebase/*.md` | GSD | Source for every other tool. |
| Per-feature spec (requirements, design, tasks, bugfix, review) | `.specs/<feature>/{requirements,design,tasks,bugfix,review,analysis}.md` | spec-kit | Required artifacts vary per spec type. |
| Constitution (binding governance) | `.specify/memory/constitution.md` | spec-kit | This file. Amended by `/speckit-constitution`. |
| BMAD configuration and skills | `_bmad/{bmm,tea,cis,wds,core,custom,method,render,toolbox}/` | BMAD | Live configuration; `_bmad/config.toml` is installer-managed, `_bmad/custom/` holds team and personal overrides. |
| BMAD briefs, PRDs, and research | `_bmad-output/planning-artifacts/{briefs,prds,research}/<id>/` | BMAD | Pre-spec intent artifacts; cross-referenced from `.specs/<feature>/requirements.md` "Upstream" section. |
| BMAD implementation specs and deferred-work ledger | `_bmad-output/implementation-artifacts/` | BMAD | Per-story dev artifacts and `deferred-work.md`. BMAD implementation specs coexist with `.specs/<feature>/tasks.md`; the spec-kit file is the verification-gate source of truth (Principle IX). |
| BMAD test and review artifacts | `_bmad-output/test-artifacts/{test-design,test-reviews,traceability}/` | BMAD | TEA outputs; consumed by GSD `/gsd-validate-phase` and spec-kit `/speckit-converge`. |
| BMAD party-mode session diary | `_bmad-output/party-mode/memories/installed/.memlog.md` | BMAD | Historical evidence only; project state lives in `.planning/STATE.md`. |
| Per-feature OpenAPI / contracts | `.specs/<feature>/design.md` (section "Contracts") | spec-kit | Generated artifacts land under `src/Host/.../wwwroot/swagger/`. |
| Architecture Decision Records (ADRs) | **Two homes, two scopes:** GSD STATE.md holds the *decision and rationale*; spec-kit `review.md` / `analysis.md` files hold the *finding* that prompted the decision. | GSD + spec-kit | The legacy `docs/architecture/decisions/0001-…0004-…` ADRs were deleted in commit `b34b4d2` (2026-07-12) — kept for historical reference only in git history; new ADRs are recorded in GSD STATE.md and cross-referenced from the relevant `.specs/<feature>/` file. |
| Design system (tokens, components) | `.specs/2 - visual-design-system/` + `mockup/` | spec-kit | Tokens contract enforced by `.planning/REQUIREMENTS.md` trace rows and continuous task C.7. The legacy `docs/design-system/` and `docs/penpot/` assets were deleted in commit `b34b4d2` (2026-07-12); the spec under `.specs/2 - visual-design-system/` and `mockup/` are the canonical homes going forward. |
| Agent flow cheat sheet (GSD/spec-kit/BMAD lifecycle diagrams, command tables, seams, concurrency budget) | `docs/agent-flow-cheatsheet.md` | spec-kit | Quick-reference card; **not** a substitute for this constitution. The constitution wins on any conflict. Added 2026-07-12; OpenSpec references removed at v1.7.0. |
| Operator docs (first boot, demo mode) | `AGENTS.md` "Operator reference" + `docs/getting-started.md` + `docs/demo-mode.md` | spec-kit | When the doc describes a one-command procedure, it is in `AGENTS.md`. |
| Local development (dev shell, devcontainer, worktrees, build/test commands) | `AGENTS.md` "Local development" | spec-kit | This is the home for Option D. The legacy `docs/development-guide.md` is being retired (see Retirement schedule below). |
| Deployment, hardening, env vars | `AGENTS.md` "Deployment" + `.planning/REQUIREMENTS.md` (NFRs) | spec-kit + GSD | The legacy `docs/deployment-guide.md` is being retired. |
| API contracts (route catalog, key endpoints) | `AGENTS.md` "API surface" + `.specs/<feature>/design.md` (contracts section) | spec-kit | The legacy `docs/api-contracts.md` is being retired. |
| Data models (schema, dual-column tenancy, repositories) | `AGENTS.md` "Data model" + `.specs/<feature>/design.md` (data model section) | spec-kit | The legacy `docs/data-models.md` is being retired. |
| Integration architecture (cross-part communication, auth flow) | `AGENTS.md` "Integration architecture" + `.planning/codebase/INTEGRATIONS.md` | spec-kit + GSD | The legacy `docs/integration-architecture.md` is being retired. |
| Project overview (executive summary, parts, tech-stack table) | `README.md` + `AGENTS.md` "Project overview" | spec-kit | The legacy `docs/project-overview.md` is being retired. |
| Source-tree analysis | `.planning/codebase/STRUCTURE.md` | GSD | The legacy `docs/source-tree-analysis.md` is being retired. |
| Component inventory | `AGENTS.md` "Modules" + `.planning/codebase/STRUCTURE.md` | spec-kit + GSD | The legacy `docs/component-inventory.md` is being retired. |
| Architecture (full system diagram) | `AGENTS.md` "Architecture" + `.planning/codebase/ARCHITECTURE.md` | spec-kit + GSD | The legacy `docs/architecture.md` is being retired. |
| Doc-gen pipeline state | **No home — retired.** | n/a | The legacy `docs/project-scan-report.json` is the historical artifact of a `bmad-document-project --mode deep` run on 2026-07-12. |

**Retirement schedule** (for the legacy `docs/` generation pipeline and the
now-redundant `docs/architecture/decisions/` ADRs):

- **Phase 0 (v1.1.0):** mark the legacy docs as deprecated. Update each
  legacy doc with a one-line redirect note pointing to its canonical
  home in `AGENTS.md` and `.planning/`. ✅ Done at v1.1.0 ratification.
- **Partial deletion (v1.3.0, commit `b34b4d2`, 2026-07-12):** the
  following were deleted ahead of the next milestone boundary because
  they were fully superseded and no longer load-bearing:
  `docs/architecture/decisions/0001…0004-*.md` (legacy ADRs — moved to
  GSD `STATE.md` + spec-kit `review.md`/`analysis.md`),
  `docs/design-system/` (design system usage guides — moved to
  `.specs/2 - visual-design-system/`),
  `docs/penpot/` (Penpot design system assets — moved to `mockup/`),
  `docs/migration/legacy-mapping.md` (legacy mapping — superseded by
  the Strangler Fig notes in `AGENTS.md`). This deletion is
  reflected in the source-of-truth table above.
- **Next milestone boundary** (per `/gsd-complete-milestone`): delete
  the remaining legacy `docs/{index,project-overview,development-guide,
  deployment-guide,api-contracts,data-models,integration-architecture,
  source-tree-analysis,component-inventory,architecture}.md` files and
  `docs/project-scan-report.json`. These still carry one-line redirect
  notes at the top and are gated for deletion at the next milestone.
- **GSD phase transitions** are the trigger for re-validating this
  retirement schedule. If a phase boundary finds that a remaining
  legacy doc is still load-bearing, that doc is promoted to a
  canonical home (this section is amended) and the migration is
  paused.

**Source-of-truth tiebreakers:**

1. Code is the lowest-level truth. If `AGENTS.md` and the code disagree,
   the code wins and `AGENTS.md` is updated.
2. `.planning/STATE.md` is the highest-level truth for the *current* state.
   If `.specs/<feature>/tasks.md` and `.planning/STATE.md` disagree on
   what is "done", `STATE.md` wins (it is updated by the agent that
   finished the work).
3. `.specify/memory/constitution.md` (this file) is non-negotiable within
   the scope of `/speckit-*` analysis. If a principle needs to change,
   that is a separate, explicit constitution update — never silent
   reinterpretation.

## Governance

This Constitution supersedes all other practices, ad-hoc conventions, and
informal agreements for the **ControlEasy Reborn** project. Where this
document conflicts with `AGENTS.md` or any spec, this Constitution wins
unless an amendment is in flight.

- **Amendments.** Any change to a principle, section, or governance rule
  requires (1) a pull request that updates `.specify/memory/constitution.md`
  and the version line, (2) a Sync Impact Report at the top of the file
  listing every modified principle, added/removed section, and template
  affected, and (3) approval from a project maintainer.
- **Versioning.** Constitution versions follow semantic versioning.
  **MAJOR** = backward-incompatible principle removal or redefinition;
  **MINOR** = new principle or materially expanded guidance; **PATCH** =
  clarifications, wording, typo fixes.
- **Compliance review.** Every PR review MUST verify compliance with the
  active principles. Any violation that survives review is a blocker;
  the `Complexity Tracking` section of `plan.md` exists solely to justify
  exceptions, not to normalize them.
- **Runtime guidance.** `AGENTS.md` is the runtime development guide and
  MUST be updated whenever a principle changes in a way that affects day-
  to-day contributor workflow (e.g., new test gate, new Docker command).
- **Living document.** This Constitution is reviewed at every milestone
  boundary (via `/gsd-complete-milestone`) and at every phase transition
  (via `/gsd-transition`). "What This Is" and "Out of Scope" drift are
  treated as constitutional concerns, not just documentation hygiene.

**Version**: 1.7.0 | **Ratified**: 2026-07-12 | **Last Amended**: 2026-09-21
