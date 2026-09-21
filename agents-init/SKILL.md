---
name: agents-init
description: Scaffold or refresh an `AGENTS.md` for any project, against the `agents-template-schema`. Use when the user wants to set up `AGENTS.md` for the first time in a new repo, refresh an existing one, or migrate a project that has a non-conformant `AGENTS.md` (e.g., one written before this schema existed). Detects whether the repo is brownfield (existing signals) or greenfield (empty) and asks only the questions the repo can't answer. Never overwrites the user's existing `AGENTS.md` without archiving it first.
---

# agents-init

A one-shot onboarding skill for the universal `AGENTS.md` schema (version 1). Runs in any repository, in any language, with or without an existing planning workflow.

The skill does three things, in order:

1. **Detect** — read the repo and decide brownfield vs. greenfield. Build a map of known facts.
2. **Interview** — ask the user only about gaps. For greenfield repos, ask from scratch. For brownfield repos, auto-fill from the detected facts and confirm.
3. **Write** — copy `AGENTS-TEMPLATE.md` into the repo as `AGENTS.md`, replace placeholders with the answers, archive the previous `AGENTS.md` if one exists, and verify conformance against `AGENTS-SPEC.md`.

The skill is **idempotent** in the sense that re-running it on a repo with a conformant `AGENTS.md` is allowed — it offers to archive and rewrite, or to update specific sections in place. It is **not** destructive: it never overwrites an existing `AGENTS.md` without writing the previous contents to `AGENTS.md.<original-name>.bak` first.

---

## Phase 1 — Detect

Read the repo and build a "known facts" map. The map is the source of truth for what the interview can skip.

### Project identity

| Source                                               | Field          |
| ---------------------------------------------------- | -------------- |
| `package.json` `.name`                               | project name   |
| `package.json` `.description`                        | description    |
| `Cargo.toml` `[package] name`                        | project name   |
| `Cargo.toml` `[package] description`                 | description    |
| `pyproject.toml` `[project] name`                    | project name   |
| `pyproject.toml` `[project] description`             | description    |
| `<name>.sln` or `*.csproj` `<RootNamespace>`         | project name   |
| `pom.xml` `<artifactId>` / `<description>`           | project name + description |
| `go.mod` module path                                 | project name   |
| `README.md` first heading + first paragraph          | name + description (fallback) |

If multiple sources disagree, prefer the one closest to the project's primary language. Note the disagreement in the interview so the user resolves it.

### Repo anatomy

Enumerate the top-level entries (`ls -la` equivalent). For each directory, classify it:

- **Source** — code, configuration, tests, documentation the project authors wrote (`src/`, `lib/`, `tests/`, `docs/`, `internal/`, `cmd/`, `pkg/`).
- **Generated** — build output, caches, distribution bundles (`dist/`, `build/`, `target/`, `node_modules/`, `.next/`, `coverage/`).
- **Workflow-owned** — directories that signal an adopted workflow:
  - `_bmad/`, `_bmad-output/` → BMAD
  - `.planning/` → GSD-core
- **Overlay-owned** — directories that signal an adopted overlay:
  - `.impeccable/`, `PRODUCT.md`, `DESIGN.md` → impeccable
  - `.eslintrc*`, `eslint.config.*`, `.prettierrc*` → linter/formatter overlays
  - `.github/skills/`, `.claude/skills/`, `.cursor/skills/` → other overlays
- **VCS / meta** — `.git/`, `.gitignore`, `.gitattributes`, `.github/`, `.gitlab/`, `.vscode/`, `.idea/`.

The interview presents this classification to the user and asks which entries to document in `## Repo anatomy`.

### Build, test, dev commands

Detect by file:

| File                              | Build             | Test                | Dev               |
| --------------------------------- | ----------------- | ------------------- | ----------------- |
| `package.json` scripts            | `build`           | `test`              | `dev` / `start`   |
| `Cargo.toml`                      | `cargo build`     | `cargo test`        | `cargo run`       |
| `pyproject.toml`                  | project-specific  | `pytest` / `tox`    | project-specific  |
| `Makefile`                        | first `build:` target | first `test:` target | first `run:` / `dev:` target |
| `.github/workflows/*.yml`         | (per job)         | (per job)           | (per job)         |
| `docker-compose*.yml`             | `docker compose up` | (in compose file) | `docker compose up` |
| `scripts/Testar.ps1`, `scripts/Desenvolver.ps1` | custom | custom | custom |

If multiple sources are present, prefer the most specific (project script file over CI over generic). Show the user what's detected and ask for confirmation or correction.

### Existing `AGENTS.md`

Read the file if present. Test for schema-1 conformance:

- Header comment `<!-- agents-template-schema 1 -->` in the first 20 lines.
- Footer comment `<!-- agents-template-schema 1 -->` in the last 5 lines.
- Five obligations in `## Reader contract (minimal)`.
- `<!-- owner:<code> -->` markers paired with `<!-- /owner -->`.

If the file is conformant, the skill offers two paths: (a) **refresh in place** — re-run detection, update only changed sections, preserve the user's prose; (b) **archive and rewrite** — move to `AGENTS.md.<original-name>.bak` and write a fresh conformant file. The default is (a) for conformant files, (b) for non-conformant files.

### Existing workflow signals

If any workflow-owned directories are detected, note them. The interview asks the user to confirm each detected workflow and to declare any workflows that are in use but leave no on-disk signal (rare; the user usually adds the signal directory themselves).

---

## Phase 2 — Interview

Ask only what detection couldn't answer. The interview is a structured question list, not a free-form conversation. Group questions by the section of `AGENTS.md` they'll populate.

### Project

- **Name** (if not detected or detection was ambiguous): the project name as it should appear in `## Project` and in repository metadata.
- **One-line description**: a single sentence covering what the project does, its domain, and its primary users. The skill offers the detected description as a starting point; the user confirms or rewrites.
- **Language of `AGENTS.md`**: the language the populated `AGENTS.md` should be written in. Default to the language of the detected `README.md`; if no README, default to English. The template and spec are always in English; only the populated `AGENTS.md` follows the project's choice.

### Repo anatomy

Present the detected top-level entries with their classifications. Ask the user to mark which entries to document in `## Repo anatomy` and to add a one-line role for each. Defaults:

- All source directories: include.
- All generated directories: include only if they appear in CI output or distribution paths.
- Workflow-owned directories: include with a note that the workflow owns them.
- VCS / meta directories: exclude (they're noise to an agent).

### Build, test, dev

For each command, show the detected value and ask the user to confirm or supply the canonical command. If a category (e.g., lint) has no detection, ask. If the project uses containers, ask for the compose-file name and the project-name convention.

### Policy

Ask: "Does this project have hard rules an agent must not violate, beyond what the workflows enforce?" If yes, capture them one at a time. If no, write the section as a one-line placeholder: `_No project-level policy; see workflow blocks for ceremony._`

Hard rules are project-enforced prohibitions (don't commit secrets, don't run `docker system prune`, don't push to `main` without review). Process rules (wait for user confirmation, run the test suite before merging) belong in the workflow blocks, not here.

### Workflows

Present the detected workflows (if any) and ask the user to confirm. Then ask if any of BMAD or GSD-core should be adopted even if not detected. For each adopted workflow, the skill writes an empty `<!-- owner:<code> --> ... <!-- /owner -->` block and tells the user to run that workflow's own onboarding skill to fill it.

If the user is unsure, the skill offers a one-line description of each:

- **BMAD** — plans the project (PRD, architecture, epics, stories) and writes binding artifacts under `_bmad-output/`. Best for projects that need a full planning phase before any code.
- **GSD-core** — runs an execute-verify loop against a phase plan in `.planning/`. Best for projects that already have requirements and want to ship in vertical slices.

### Skill overlays

Present the detected overlays (if any) and ask the user to confirm. Then ask if the project uses any overlays that leave no on-disk signal. For each adopted overlay, add a pointer line in `## Skill overlays`. The skill does **not** verify that the pointer resolves to an existing file — the user is responsible for that, and the spec's conformance rule 5 will catch a broken pointer when next an agent reads the file.

Common overlays:

- **impeccable** — design skill. Pointer: `PRODUCT.md` + `DESIGN.md`. Read before any UI work.
- **agents-template** — the schema artifacts themselves. Pointer: `AGENTS-TEMPLATE.md` + `AGENTS-SPEC.md`. Read before editing `AGENTS.md`.
- Linters, formatters, test runners — typically no `AGENTS.md` pointer; their config files are sufficient. Include a pointer only if the overlay has its own skills or rules that live outside the standard config.

### Language conventions

For each language detected in the repo, ask: "Does this project follow the language's default style, or does it have project-specific overrides?" If overrides, capture them. If defaults, skip the subsection for that language.

### Conventions that differ from defaults

Ask the user for any catch-all conventions: branch naming, commit message style, worktree layout, schema-naming rules, deployment topology. If none, the section may be omitted entirely.

---

## Phase 3 — Write

Take the interview answers + the detected facts and write `AGENTS.md`.

### Write protocol

1. **Locate `AGENTS-TEMPLATE.md`.** In this repo it's at `./AGENTS-TEMPLATE.md`. In a downstream project, the skill expects `AGENTS-TEMPLATE.md` to be vendored (copied into the repo root at install time). If the template is missing, the skill aborts with a clear error: "`AGENTS-TEMPLATE.md` not found in repo root. The agents-template overlay must be installed before `agents-init` can write a conformant `AGENTS.md`."

2. **Copy the template to `AGENTS.md`.** If `AGENTS.md` already exists, archive it first:
   - If the existing file's name is exactly `AGENTS.md`, rename to `AGENTS.md.<detected-or-archive-suffix>.bak`. The suffix is the project's slugified name (e.g., `AGENTS.md.bookingexperience-bak`) or a timestamp (`AGENTS.md.2026-09-11.bak`) if no project name is available.
   - Record the archived path in the skill's transcript so the user can recover.

3. **Replace placeholders.** Walk the template's `Project`, `Repo anatomy`, `Build, test, and development commands`, `Policy`, `Workflow blocks`, `Skill overlays`, `Language conventions`, `Conventions that differ from defaults` sections and replace their `<...>` placeholders with the collected values. Leave untouched:
   - The schema header and footer comments.
   - The `## Reader contract (minimal)` section.
   - The empty `<!-- owner:<code> -->` blocks (these are inert and will be filled by each workflow's own onboarding skill).

4. **Verify conformance.** Apply the conformance checklist from `AGENTS-SPEC.md` §10:
   - Header and footer `<!-- agents-template-schema 1 -->` markers present.
   - `## Reader contract (minimal)` carries the five obligations in order.
   - Every `<!-- owner:<code> -->` is paired with `<!-- /owner -->`.
   - Every workflow code is in the Supported workflows table.
   - Every `## Skill overlays` pointer resolves to an existing file or directory.

   If any check fails, the skill **does not** write the file. It returns the failed checks to the user for correction.

5. **Present the result.** Show the user the populated `AGENTS.md` (full file, not a diff) and ask for explicit confirmation before committing. The user must approve; the skill does not auto-commit.

6. **Tell the user what's next.** For each adopted workflow that has an empty block, name the workflow's onboarding skill and the command to run it:
   - BMAD → "Run `bmad-project-context` to fill the BMAD block."
   - GSD-core → "Run `gsd-onboard` to fill the GSD block."

   For each adopted overlay, confirm the pointer and tell the user the skill does not manage the overlay's internal files.

### What the skill does not do

- It does not write BMAD planning artifacts or GSD state files. Those are the workflows' jobs.
- It does not write `PRODUCT.md`, `DESIGN.md`, or any other overlay sibling file. Pointers only.
- It does not install BMAD, GSD-core, impeccable, or any other tool. It writes the file that tells an agent those tools are in use.
- It does not commit. The user reviews and commits.
- It does not delete archived files. The user is responsible for cleaning up `AGENTS.md.*.bak` after confirming the new `AGENTS.md` is correct.

---

## Re-running agents-init

The skill is safe to re-run. Behavior depends on the state of the existing `AGENTS.md`:

- **Conformant `AGENTS.md` present** — offer *refresh in place* (update only changed sections) or *archive and rewrite* (default: refresh in place).
- **Non-conformant `AGENTS.md` present** — offer *archive and rewrite* only (default: rewrite).
- **No `AGENTS.md`** — write a fresh one.

A re-run also picks up newly adopted workflows or overlays. If the user has added BMAD since the last `AGENTS.md` was written, the skill offers to add the BMAD block.

---

## Invocation

This skill is the canonical body. It is invoked by a vendor-specific wrapper that the user's harness discovers at session start. Wrappers come in two shapes:

- **Slash command** — the user types `/agents-init` (or the harness's equivalent) and the wrapper's frontmatter routes execution to this file.
- **Skill auto-discovery** — the harness reads the `description` frontmatter and offers the skill contextually, or invokes it when the user's task matches.

### In-repo wrappers (shipped)

This repository ships thin wrappers for the seven most popular harnesses. The wrappers live at the vendor-specific paths and dispatch to this canonical skill body:

| Harness            | Wrapper path                                        | Shape                  |
| ------------------ | --------------------------------------------------- | ---------------------- |
| Claude Code        | `.claude/commands/agents-init.md`                   | Slash command          |
| OpenCode           | `.opencode/command/agents-init.md`                  | Slash command          |
| Codex (slash)      | `.codex/prompts/agents-init.md`                     | Slash command          |
| Codex (skill)      | `.agents/skills/agents-init/SKILL.md`               | Skill auto-discovery   |
| Cursor (slash)     | `.cursor/commands/agents-init.md`                   | Slash command          |
| Gemini CLI         | `.gemini/commands/agents-init.toml`                 | Slash command (TOML)   |
| Antigravity        | `.agent/skills/agents-init/SKILL.md`                | Skill auto-discovery   |
| GitHub Copilot     | `.github/prompts/agents-init.prompt.md`             | Prompt file            |

Slash-command wrappers are short: frontmatter + a one-line pointer to this file. Skill auto-discovery wrappers are copies of this file (the harness expects to find `SKILL.md` at the canonical path).

### Long-tail wrappers (installer)

For harnesses not in the in-repo list, run `scripts/install.sh` (POSIX) or `scripts/install.ps1` (Windows). The installer detects installed harnesses and copies the right wrapper to the right location. The full vendor matrix is in `AGENTS-SPEC.md` §Distribution.

### Downstream project usage

A downstream project that adopts the agents-template overlay:

1. Vendors `AGENTS-TEMPLATE.md`, `AGENTS-SPEC.md`, and `agents-init/SKILL.md` into the repo root.
2. Either ships the in-repo vendor wrappers for the user's harness, OR runs the installer, OR copies the wrapper that matches the user's harness.
3. Adds a pointer in the project's `## Skill overlays` section: `- **agents-template** — AGENTS-TEMPLATE.md, AGENTS-SPEC.md, agents-init/SKILL.md`.

A downstream project MUST NOT modify the canonical skill body. If a project needs custom onboarding behavior, it ships its own skill under its own overlay and points at that instead.

---

## Inputs and outputs

**Inputs:** the repository (read-only), the user's answers to the interview, the `AGENTS-TEMPLATE.md` (read-only).

**Outputs:**

- `AGENTS.md` — populated, conformant, replacing or newly created.
- `AGENTS.md.<suffix>.bak` — the previous `AGENTS.md`, if any. Never overwritten; if a bak with the same suffix exists, the skill aborts and asks the user to resolve manually.
- A short transcript (printed to the conversation, not written to disk) listing the detected facts, the interview answers, the conformance check results, and the next steps the user should run.

**Side effects:** none beyond the two file changes above. The skill does not touch git, does not install packages, does not write to any other location.
