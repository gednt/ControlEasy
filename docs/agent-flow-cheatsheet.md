# Agent Flow Cheat Sheet — GSD · spec-kit · BMAD

> **Canonical home (dev/operator reference):** this file.
> **Governance anchor:** `.specify/memory/constitution.md` v1.7.0
> (Principle VI — "Workflow Tooling").
> **Runtime anchor:** `AGENTS.md` (operator reference; hard rules in `AGENTS.POLICY.md`).
>
> This document is a quick-reference card for the workflow
> systems that run ControlEasy Reborn. It is **not** a substitute
> for the constitution; the constitution wins on any conflict.
> Source-of-truth map: see the "Documentation Systems and Source
> of Truth" table in the constitution.

---

## 0. The mental model in 30 seconds

| | GSD | spec-kit | BMAD |
|---|---|---|---|
| **Owns** | The roadmap & project state | The per-feature spec | Review/analysis evidence |
| **Home directory** | `.planning/` | `.specs/<feature>/`, `.specify/` | `_bmad/`, `_bmad-output/` |
| **Command prefix** | `/gsd-*` | `/speckit-*` | `bmad-*` skills |
| **Mandatory?** | Yes — every phase runs through it | Yes — every feature/bug starts here | No — invoked for reviews/audits |
| **Cadence** | Per phase (34 phases) | Per feature | Per review/audit need |
| **Output is** | Plans, summaries, UAT, validation | `spec.md`, `plan.md`, `tasks.md` | Reviews, audits, traceability, deferred-work ledger |
| **Skill home** | `~/.config/opencode/skills/gsd-*` (user-global) | `.agents/skills/speckit-*` | `.claude/skills/bmad-*`, `.agents/skills/bmad-*` |
| **Single sentence** | "Where are we on the 34-phase rollout?" | "What does this feature look like end-to-end?" | "Is this work actually good?" |

The constitution's **ownership principle** (Principle VI § 3 Seams) is
the one rule that keeps the tools from drifting:

- **GSD owns `.planning/`.** Other tools may **write** to it (to
  record decisions, blockers, validated/invalidated requirements)
  but must not update `ROADMAP.md`, the phase pointer, or the
  milestone archive — those are GSD's.
- **spec-kit owns `.specs/<feature>/` and `.specify/`.** No one
  rewrites a spec-kit `tasks.md` checkbox except
  `/speckit-implement`.
- **BMAD owns `_bmad/` and `_bmad-output/`.** BMAD emits findings;
  the owning workflow's agent applies them.

A canonical test for "who owns this artifact?": if it lives in
`.planning/`, ask GSD; if in `.specs/` or `.specify/`, ask spec-kit;
if in `_bmad-output/`, ask BMAD. Three homes, three owners, zero
overlap.

---

## 1. GSD — planner and roadmap owner (`.planning/`)

### 1.1 What GSD owns (and what it does not)

| Owns | Does NOT own |
|---|---|
| `.planning/PROJECT.md` (validated / active / out-of-scope) | `.specs/<feature>/` artifacts (read-only consumer) |
| `.planning/milestones/v*.*-REQUIREMENTS.md` (archived per milestone) | `.specify/memory/constitution.md` (constitution is spec-kit's) |
| `.planning/ROADMAP.md` (34 phases) | The spec-kit `tasks.md` checkbox (spec-kit's job) |
| `.planning/STATE.md` (live state, decisions, blockers) | Per-PR review (that's a code review concern) |
| `.planning/codebase/*.md` (7 maps: STACK, STRUCTURE, ARCHITECTURE, CONVENTIONS, CONCERNS, INTEGRATIONS, TESTING) | — |
| `.planning/milestones/v<ver>-phases/<NN>-<slug>/` (CONTEXT, RESEARCH, NN-PLAN, NN-SUMMARY, NN-VERIFICATION, VALIDATION, NN-UAT) | — |

### 1.2 The phase lifecycle

```
/gsd-discuss-phase N
        │
        ▼
/gsd-plan-phase N ── spawns ──▶ gsd-phase-researcher (RESEARCH.md)
        │                            └─▶ gsd-planner (NN-PLAN.md)
        │                            └─▶ gsd-plan-checker (loop until pass)
        ▼
/gsd-execute-phase N ── wave-based parallel execution ──▶ gsd-executor
        │                                                  (atomic commits, per task)
        ▼
/gsd-verify-work N ── conversational UAT ──▶ NN-UAT.md
        │                                       (gaps → /gsd-execute-phase N --gaps-only)
        ▼
/gsd-validate-phase N ── Nyquist test audit ──▶ VALIDATION.md + generated tests
        │
        ▼
<!-- VERIFY: /gsd-transition — no such skill is installed; the constitution (Principle -->
<!--   VI) still names this step but no command backs it. Phase completion is marked   -->
<!--   directly in ROADMAP.md (checkboxes + per-milestone status table).               -->
(gsd-validate-phase N passes → phase complete)
        │
        ▼ (at milestone boundaries)
/gsd-complete-milestone <version> ── archive roadmap + requirements,
                                      update PROJECT.md, tag release,
                                      trigger legacy-docs retirement
```

### 1.3 GSD command cheat sheet

| Command | When | Output artifact | Sub-agents it spawns |
|---|---|---|---|
| `/gsd-discuss-phase N` | Before planning phase N | `CONTEXT.md` | — |
| `/gsd-plan-phase N` | Before executing phase N | `RESEARCH.md`, `NN-PLAN.md` | `gsd-phase-researcher`, `gsd-planner`, `gsd-plan-checker` |
| `/gsd-execute-phase N` | When the plan is approved | `NN-SUMMARY.md`, commits | `gsd-executor` (wave-based) |
| `/gsd-execute-phase N --gaps-only` | When UAT found gaps | closes the gaps | `gsd-executor` |
| `/gsd-verify-work N` | After execution | `NN-UAT.md` | conversational; no sub-agent |
| `/gsd-validate-phase N` | After UAT passes | `VALIDATION.md` | `gsd-nyquist-auditor` |
| *(no `/gsd-transition` skill installed — phase completion is marked in `ROADMAP.md` itself)* | When the phase is complete | `ROADMAP.md` status table | — |
| `/gsd-complete-milestone <v>` | At a milestone boundary | `.planning/milestones/` archive | legacy-docs retirement |
| `/gsd-audit-milestone` | Before archive | audit report | — |
| `/gsd-quick`, `/gsd-fast`, `/gsd-autonomous`, `/gsd-help` | Ad-hoc driver commands | varies | varies |

### 1.4 The wave structure (within a plan)

`gsd-executor` runs `NN-PLAN.md` task-by-task in waves, where a
"wave" is a set of tasks with no inter-dependencies that can
fan out in parallel. The GSD concurrency budget for sub-agents
(the concurrency-budget policy in `AGENTS.md`) applies here
too: at most 3
sub-agents in flight concurrently, on top of the main
orchestrator. Wave boundaries are declared in
`.specs/<feature>/tasks.md` as a `Task Dependency Graph` JSON
block (`{"waves": [...]}`).

### 1.5 When to invoke GSD as a sub-agent

Per `.specify/memory/constitution.md` (Principle VII — sub-agent orchestration), any agent — including
a main orchestrator or an in-flight spec-kit sub-agent —
MAY invoke a `/gsd-*` skill when the work crosses the seam:

- A spec-kit `speckit-implement` task that needs a fresh
  `.planning/codebase/ARCHITECTURE.md` reading before it
  can decide on a structure.
- A BMAD orchestrator that needs the live roadmap pointer.

GSD does **not** rewrite the caller's artifacts; the caller's
workflow tool's ownership rule wins.

---

## 2. spec-kit — per-feature spec owner (`.specs/`, `.specify/`)

### 2.1 The 4-command pipeline

```
/speckit-specify "<description>"
        │   creates .specs/<feature>/spec.md
        │   generates .specs/<feature>/checklists/
        │   resolves up to 3 [NEEDS CLARIFICATION] markers
        ▼
[ gate: review spec ]
        │
        ▼
/speckit-plan
        │   fills plan.md from .specify/templates/plan-template.md
        │   reads .specify/memory/constitution.md (Phase 0)
        │   generates research.md, data-model.md, contracts/, quickstart.md
        │   re-evaluates "Constitution Check" after design
        ▼
[ gate: review plan ]
        │
        ▼
/speckit-tasks
        │   fills tasks.md from .specify/templates/tasks-template.md
        │   organized by user story (Setup → Foundational → USn → Polish)
        │   [P] parallel markers, [USn] story labels, exact file paths
        ▼
/speckit-implement
        │   executes tasks.md phase-by-phase
        │   marks [X] as each task lands
        │   respects [P] parallelism and TDD ordering
        ▼
[ tasks.md all [X] ] → ready for /gsd-verify-work (if part of a GSD phase)
```

### 2.2 Auxiliary commands

| Command | When | Output |
|---|---|---|
| `/speckit-clarify` | Spec still has `[NEEDS CLARIFICATION]` markers | resolves them |
| `/speckit-checklist` | Need a domain checklist (UX, security, test) | `<domain>-checklist.md` |
| `/speckit-converge` | After implementation, consolidate drift | convergence report |
| `/speckit-analyze` | Periodic code analysis | Markdown report (strictly read-only; no file writes) |
| `/speckit-constitution` | Amend `.specify/memory/constitution.md` | new version + Sync Impact Report |

### 2.3 The per-feature folder

```
.specs/<feature>/
├── spec.md           # /speckit-specify output (user stories, FRs, success criteria)
├── plan.md           # /speckit-plan output (Constitution Check, data model, contracts)
├── tasks.md          # /speckit-tasks output (phased, [P] [USn] formatted)
├── checklists/       # /speckit-checklist output (domain quality)
├── design.md         # feature design (overview, glossary, architecture, diagrams)
├── bugfix.md         # only for bug-fix specs
├── review.md         # produced by GSD code-review agents
├── docplan.md        # new documentation set plan (Doc agent)
├── orchestration.md  # produced by BMAD orchestrator (when used)
└── requirements.md   # legacy: see .specs/1 - modernization-roadmap/
```

`requirements.md` and `design.md` predate the spec-kit pipeline in
this repo (legacy from before the spec-kit adoption). New
specs follow spec-kit's native shape: `spec.md` + `plan.md` +
`tasks.md`. The two coexist; the agent picks the shape that
matches the spec's lineage.

### 2.4 Task format

```
[ID] [P?] [Story] Description with exact file paths
```

- **`[P]`** — can run in parallel (different files, no
  dependencies).
- **`[Story]`** — user-story label (`US1`, `US2`, `US3`).
- **Phases** are top-level `## Phase N: <Name>` sections,
  typically: Setup → Foundational → US1 (P1) → US2 (P2) → … →
  Polish.
- **Wave graph** at the bottom of `tasks.md` (in `.specs/`
  here) or in `plan.md` (in spec-kit's native shape) is a
  JSON block:

  ```json
  { "waves": [
      { "wave": 1, "tasks": ["T001", "T002"] },
      { "wave": 2, "tasks": ["T003"] }
  ] }
  ```

### 2.5 The Constitution Check

`/speckit-plan` reads `.specify/memory/constitution.md` at
Phase 0 and fills the `plan.md` "Constitution Check" section
from it. Any principle violation that cannot be justified in
`plan.md` "Complexity Tracking" **blocks planning**. The
principles of the constitution v1.7.0 are the binding
contract; the agent does not interpret them — it cites them. (v1.7.0
removed OpenSpec and restated Principle VI as a three-tool split;
v1.5.0 added Principle IX on BMAD as the review/analysis layer;
v1.4.0 added Principle VIII on host-OS / shell-aware command
execution; v1.3.0 added Principle VII on sub-agent orchestration.)

### 2.5.1 The verification-gate source of truth

The spec-kit `tasks.md` is the verification-gate source of
truth. The per-turn fast gate and the full local CI suite
(`scripts/verify-ci-local.sh`) verify the code the tasks
produced; a task checkbox is marked `[X]` only after its test
slice passes.

### 2.6 spec-kit's relationship to GSD

- **spec-kit → GSD.** When a `/speckit-implement` task lands,
  the executor updates `.planning/STATE.md` (decisions,
  blockers, deferred items) and, if a requirement was
  validated or invalidated, `.planning/PROJECT.md` (move
  between Active / Validated / Out-of-Scope). The executor
  does **not** advance the roadmap pointer or mark phases
  complete — that's GSD's job.

### 2.7 When to invoke spec-kit as a sub-agent

- A GSD `gsd-plan-phase` orchestrator that needs a fresh
  per-feature spec drafted before it can size the phase.
- A BMAD orchestrator running a story that crosses multiple
  features and wants one spec-kit per feature.

---

## 3. BMAD — review, analysis, and adversarial-quality layer (`_bmad/`, `_bmad-output/`)

### 3.1 What BMAD does

BMAD is the project's review/analysis/adversarial-quality layer
(constitution Principle IX). It does **not** plan, implement, or
change-track; it questions, audits, and produces evidence that the
other two tools consume but do not auto-apply.

Four kinds of artifact, each with a fixed home:

1. **Briefs and PRDs** (analyst + PM) — `_bmad-output/planning-artifacts/{briefs,prds}/<id>/`.
2. **Implementation specs** — `_bmad-output/implementation-artifacts/`.
   These coexist with spec-kit `tasks.md`; the spec-kit file is the
   verification-gate source of truth.
3. **Review and analysis** — adversarial findings, edge-case catalogs,
   NFR audits, traceability matrices under `_bmad-output/`. Consumed
   by `/gsd-validate-phase`, `/gsd-secure-phase`, `/gsd-audit-milestone`,
   `/speckit-converge`, and `/speckit-analyze`.
4. **Deferred-work ledger** — `_bmad-output/implementation-artifacts/deferred-work.md`.

### 3.2 When to invoke BMAD as a sub-agent

- The pre-commit adversarial review gate: `bmad-code-review`
  (or `bmad-review-adversarial-general` for non-code artifacts).
  CRITICAL/HIGH findings block the commit.
- Phase and milestone audits: `bmad-check-implementation-readiness`,
  `bmad-testarch-trace`, `bmad-testarch-nfr`.
- Edge-case analysis of a diff or spec: `bmad-review-edge-case-hunter`.

### 3.3 BMAD's relationship to spec-kit and GSD

- **BMAD → spec-kit.** BMAD MUST NOT rewrite `.specs/<feature>/`
  files; it emits findings and the spec-kit agent applies changes.
- **BMAD → GSD.** BMAD findings that affect project state are
  promoted via `/gsd-complete-milestone`;
  BMAD does not advance the roadmap pointer itself.

---

## 4. Sub-agent invocation

### 4.1 The rule

> Any agent — including a main orchestrator and any in-flight
> sub-agent — MAY invoke any of GSD, spec-kit, or BMAD
> skills as a sub-agent when the work at hand crosses the
> seam between the tools.

The ownership rules in § 1.1 / § 2.1 / § 3 are preserved.
Concretely:

- A sub-agent **writes only to the directory owned by its own
  workflow tool** (GSD → `.planning/`, spec-kit →
  `.specs/` and `.specify/`).
- A sub-agent **reads from the other tools' directories** but
  does not rewrite them.
- The sub-agent's parent is responsible for catching
  ownership violations before they land.

### 4.2 Worked examples

| Parent | Sub-agent | Why |
|---|---|---|
| GSD `gsd-plan-phase` orchestrator | `speckit-specify` | The phase introduces a new feature that needs a spec drafted before planning. |
| GSD `gsd-codebase-mapper` run | `bmad-review-edge-case-hunter` | Edge-case catalog for a code area being mapped. |
| spec-kit `speckit-implement` nearing commit | `bmad-code-review` | Pre-commit adversarial review gate (zero CRITICAL/HIGH). |
| BMAD orchestrator running a multi-feature story | `speckit-specify` (per feature) | One spec per feature, drafted concurrently. |

### 4.3 Anti-patterns (these are violations)

- A GSD sub-agent editing a `.specs/<feature>/tasks.md`
  checkbox — that's `/speckit-implement`'s job.
- A spec-kit sub-agent editing `.planning/ROADMAP.md` or
  advancing the phase pointer — that's GSD's.
- A sub-agent of **any** kind rewriting a file owned by a
  different workflow tool without going through that tool's
  command.

---

## 5. Concurrency budget

### 5.1 The default

> Up to **3 sub-agents in flight concurrently, in addition
> to the main orchestrator.** Total in-flight count per
> level: 4 (1 main + 3 subs).

### 5.2 The per-level rule

The budget is **per agent, not per workflow tool**. A main
agent running an implementation that fans out to GSD and
spec-kit sub-agents is still capped at three concurrent
sub-agents. A sub-agent that itself spawns sub-agents gets
**its own independent budget of 3** — a sub-agent may not
"consume" its parent's budget, and deeper nesting is
permitted with the budget applied at every level.

### 5.3 The override path

Exceeding the budget (4+ sub-agents in flight at any level)
is permitted only when the originating artifact records an
explicit rationale:

- `proposal.md` "Why" section (for overruns anticipated
  before implementation), or
- `design.md` "Decisions" section (for overruns anticipated
  during design), or
- `tasks.md` task description (for the wave in question — the
  most common path for apply-time overruns).

The rationale is reviewed at the next
`/gsd-complete-milestone` boundary, alongside the rest of
the work the change has produced.

No environment variable, no config file, no CLI flag
overrides the budget. The override is qualitative and lives
next to the work it justifies, so the next milestone audit
sees it without a separate scan.

### 5.4 Quick check

> "Am I about to fan out to ≥ 4 sub-agents at once?"
> - **No** → proceed.
> - **Yes, and no rationale is recorded** → split into
>   multiple waves or record the rationale in the relevant
>   artifact first.
> - **Yes, and the rationale is already recorded** → proceed;
>   flag it to the next milestone audit.

---

## 6. The seams — how the tools compose

### 6.1 The single page diagram

```
             ┌─────────────────────────────────────────────┐
             │                  USER                       │
             │    (feature idea or bug report)             │
             └────────────────────┬────────────────────────┘
                                  │
             ┌────────────────────▼────────────────────────┐
             │                GSD (always on)              │
             │  .planning/ — PROJECT, REQUIREMENTS,        │
             │  ROADMAP, STATE, codebase/, milestones/     │
             └────────────────────┬────────────────────────┘
                                  │ reads & plans against
                                  ▼
             ┌─────────────────────────────────────────────┐
             │                 spec-kit                    │
             │  .specs/<feature>/ — spec, plan, tasks      │
             │  .specify/ — constitution, templates        │
             └────────────────────┬────────────────────────┘
                                  │ implements; writes to
                                  │ .planning/ (STATE, PROJECT)
                                  ▼
             ┌─────────────────────────────────────────────┐
             │           BMAD (review & audit)             │
             │  _bmad/ — config and skills                 │
             │  _bmad-output/ — reviews, audits, ledger    │
             │  Emits findings; owning workflow applies.   │
             └────────────────────┬────────────────────────┘
                                  │
                                  ▼
             ┌─────────────────────────────────────────────┐
             │      DOCKER COMPOSE STACK (runtime)         │
             │  api · web · db · reverse-proxy · adminer   │
             │  Verification gate:                         │
             │  docker compose build api web &&            │
             │  docker compose up -d --force-recreate      │
             │  && dotnet test                            │
             └─────────────────────────────────────────────┘
```

### 6.2 The handoff rules (one-liners)

| Direction | When | Artifact that moves | Who updates `.planning/STATE.md` |
|---|---|---|---|
| **GSD → spec-kit** | Phase references a feature | spec-kit `tasks.md` is read; GSD does not rewrite it | GSD |
| **spec-kit → GSD** | A spec-kit task lands | (none — read-only) | spec-kit (writes decision/blocker) |
| **spec-kit → GSD** | Requirement validated/invalidated | (none) | spec-kit (moves PROJECT.md list) |
| **BMAD → GSD** | Audit or review affects project state | findings in `_bmad-output/` | promoted via `/gsd-complete-milestone` |
| **BMAD → spec-kit** | Review finding on implemented code | findings in `_bmad-output/` | spec-kit applies; files `review.md` |

### 6.3 The verification gate (every mode, every change)

The verification gate is owned by the **runtime target** (the
Docker Compose stack), not by any of the workflow
tools. The tools produce the code; the gate verifies the code.

```bash
# Per-task gate (after every /speckit-implement task)
docker compose -f docker/docker-compose.yml build api web
docker compose -f docker/docker-compose.yml up -d --force-recreate api web
dotnet test src/ControlEasyReborn.sln
# (slice to the affected test projects at minimum)
```

No task is "done" until the rebuilt stack starts healthy and
the task's `dotnet test` slice passes against the running
containers. `STATE.md` is updated by the agent that finished
the work.

---

## 7. Common day-to-day questions

> **"I want to add a new feature. Where do I start?"**
> Run `/speckit-specify "<description>"` — the four-command
> pipeline is the default path for every feature and bug fix.

> **"I want to fix a bug. Where do I start?"**
> Same pipeline (`/speckit-specify` → `…` → `tasks.md`),
> but `tasks.md` is built around a `bugfix.md` analysis
> rather than a `spec.md` user-story set.

> **"I'm mid-phase. Can I update the spec?"**
> Yes — `requirements.md` and `design.md` are living
> documents. A change is documented via `docplan.md`
> (for a new doc; this repo has no `docchange.md`
> convention in use today). Update
> `.planning/STATE.md` with the change.

> **"I have a 4-agent parallel plan. Is that allowed?"**
> Only if the originating artifact records the rationale
> (proposal/design/tasks). The default is 3 sub-agents
> in flight; >3 needs justification that survives the
> next `/gsd-complete-milestone` audit.

> **"What file do I open to know the current state?"**
> `.planning/STATE.md` — it is the highest-level truth for
> the *current* state, per the constitution's
> source-of-truth tiebreakers.

---

## 8. Reference table — artifacts, owners, and homes

| Artifact | Canonical home | Owner | How to amend |
|---|---|---|---|
| Project brief, validated/active/out-of-scope lists | `.planning/PROJECT.md` | GSD | Re-validated at every `/gsd-complete-milestone` |
| Roadmap (34 phases) | `.planning/ROADMAP.md` | GSD | `/gsd-complete-milestone` |
| Requirements (v1/v2, traceability) | `.planning/milestones/v*.*-REQUIREMENTS.md` | GSD | `/gsd-complete-milestone` |
| Live state (decisions, blockers, deferred) | `.planning/STATE.md` | GSD **writer-of-record**; spec-kit & BMAD **writers** | Update whenever the fact changes |
| 7 codebase maps (STACK, STRUCTURE, ARCHITECTURE, CONVENTIONS, CONCERNS, INTEGRATIONS, TESTING) | `.planning/codebase/*.md` | GSD | `/gsd-map-codebase` |
| Per-phase folder (CONTEXT, RESEARCH, NN-PLAN, NN-SUMMARY, NN-VERIFICATION, VALIDATION, NN-UAT) | `.planning/milestones/v<ver>-phases/<NN>-<slug>/` | GSD | The phase-lifecycle commands |
| Per-feature spec (spec, plan, tasks, design, bugfix, review, analysis) | `.specs/<feature>/` | spec-kit | `/speckit-*` |
| Constitution (binding governance) | `.specify/memory/constitution.md` | spec-kit | `/speckit-constitution` |
| BMAD reviews, audits, deferred-work ledger | `_bmad-output/` | BMAD | `bmad-*` review skills; findings consumed, not auto-applied |
| ADR decision & rationale | `.planning/STATE.md` | GSD | When the decision is made |
| ADR finding that prompted the decision | `.specs/<feature>/review.md` | spec-kit | When the finding lands |

---

## 9. Source-of-truth tiebreakers (constitution, last section)

1. **Code is the lowest-level truth.** If `AGENTS.md` and the
   code disagree, the code wins and `AGENTS.md` is updated.
2. **`.planning/STATE.md` is the highest-level truth for the
   current state.** If `.specs/<feature>/tasks.md` and
   `.planning/STATE.md` disagree on what is "done",
   `STATE.md` wins (it is updated by the agent that finished
   the work).
3. **`.specify/memory/constitution.md` is non-negotiable
   within the scope of `/speckit-*` analysis.** If a
   principle needs to change, that is a separate, explicit
   constitution update — never silent reinterpretation.

---

## 10. Versions & last amended

- **Constitution:** v1.7.0 (ratified 2026-07-12,
  last amended 2026-09-21)
- **AGENTS.md:** no version pin (references the constitution by path, not by version)
- **This cheat sheet:** v1.4 — v1.4 on 2026-09-21 aligns with
  constitution v1.7.0 (OpenSpec removed; Principle VI restated as a
  three-tool split of GSD / spec-kit / BMAD; the OpenSpec lifecycle
  section, `/opsx:*` command tables, and OpenSpec seams removed;
  BMAD promoted to § 3 as a first-class seam participant).
  Promote to v1.x on any change to the three-tool ownership rule,
  the concurrency budget, the canonical bring-up procedure, the
  host-OS rule, or BMAD's scope.
- **spec-kit workflow version:** 1.0.0
  (`.specify/workflows/workflow-registry.json`)

---

*This document is a cheat sheet, not a governance artifact.
The constitution at `.specify/memory/constitution.md` is the
binding governance document; the runtime guide at
`AGENTS.md` is the binding operator reference. When in doubt,
read those two first.*