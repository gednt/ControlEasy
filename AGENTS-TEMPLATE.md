<!-- agents-template-schema 1 -->

# AGENTS.md Template (v1)

Schema-driven template for `AGENTS.md` that works across BMAD, GSD-core, impeccable, and future workflow or skill overlays. Replace example content with project content; keep the section structure, ownership markers, and freshness stamps.

Workflow-owned machinery (BMAD project-context block, GSD state slice, etc.) lives in marked blocks. Skill overlays are pointers to sibling files; they own no block. The reader contract below makes this file self-contained.

---

## Reader contract (minimal)

1. Sections without `<!-- owner:... -->` are **project-owned** — their content is binding for this repository.
2. Sections marked `<!-- owner:<workflow> -->` are **workflow-owned** — obey the *non-empty* blocks for workflows you run; empty blocks are inert.
3. A freshness stamp (`<!-- verified YYYY-MM-DD against <sha> -->` / `<!-- approved YYYY-MM-DD -->`) on a workflow block is a cache-invalidation signal.
4. `## Skill overlays` lists sibling files; read them directly. No overlay owns a block in `AGENTS.md`.
5. The schema header (`<!-- agents-template-schema 1 -->`) declares the schema version. Unknown section names are ignored, not errored.

---

## Project

<one-line description of the project, domain, and primary users. Replace this paragraph.>

---

## Repo anatomy

<orientation. Top-level layout so an agent can find things without guesswork.>

- `<path>/` — <what lives here, source vs. generated, tracked vs. gitignored>.
- `<path>/` — <…>.
- `<path>/` — <…>.

Rules of thumb:

- Generated output (build artifacts, distribution bundles, provider-specific harness folders) lives in gitignored or explicitly tracked-for-release paths. Mark them clearly.
- Configuration files at the repo root (`package.json`, `Cargo.toml`, `pyproject.toml`, `*.csproj`, `pom.xml`, etc.) are project-owned; do not put policy or conventions in them.

---

## Build, test, and development commands

<orientation. Canonical commands for build, lint, test, local development. Use the project's actual toolchain.>

### Build

- `<command>` — <what it does>.

### Test

- `<command>` — <what it does, what kind of tests (unit/integration/E2E)>.

### Lint / format

- `<command>` — <what it does>.

### Local development

- `<command>` — <how to run the app locally>.

If the project uses containers, name the compose file and the project-name convention so an agent does not collide with another worktree's stack.

---

## Policy

<hard rules the agent must not violate. Keep short and enforceable. If a rule is process rather than policy (e.g., "wait for user confirmation before merging"), it belongs in the workflow block for the workflow that owns that process.>

- <rule 1>.
- <rule 2>.

If the project has **no** hard policy beyond what the workflows enforce, leave this section as a one-line placeholder: `_No project-level policy; see workflow blocks for ceremony._`

### Git worktree rule (recommended for adoption)

Strongly recommended for every project that adopts this template. Include it unless the project has a documented reason to diverge (e.g., a project that is itself a Git implementation and tests worktree internals).

- **All Git work happens in a worktree.** Never commit, branch, push, or merge on `main`. The only permitted operation on `main` is fast-forwarding it to a feature branch's tip after a human has reviewed and approved the change. Create a worktree at `.worktrees/<task>/` on a branch `feat/<task>`, where `<task>` is a semantic, lowercase, hyphen-separated name describing the change (e.g., `add-worktree-policy`).
- **The agent reports done; the human merges on `main`.** Commit, branch, and push inside the worktree, then stop. The agent MUST NOT run `git merge` on `main` for any reason. The only exception: the human explicitly says, in the current turn, "merge on main." Approval of the change is not an instruction to merge.
- **Pre-flight check before creating a worktree.** Read-only Git commands confirm that `feat/<task>` does not already exist and that `.worktrees/<task>/` is not already a worktree. If either exists, abort and pick a different task name.
- **One task, one worktree, one branch.** Do not reuse a `<task>` slug, a `feat/<task>` branch, or a `.worktrees/<task>/` path between concurrent tasks.
- **Canonical command.** `git worktree add -b feat/<task> .worktrees/<task> main` creates branch and path in one step.
- **Clean up after merge.** After a change merges to `main` and is verified, remove only the worktree you created: `git worktree remove .worktrees/<task>`. Do not touch unrelated worktrees, branches, or paths.
- **No force-push, no rewriting shared history.** Do not rewrite commits that have been pushed or that other worktrees share. Local-only history rewrites (interactive rebase before push) are allowed when no one else depends on the branch.

---

## Workflow blocks

Each block is owned by one workflow. An empty block is inert — an agent that does not run that workflow ignores it. Workflows MAY replace their own block on refresh. Workflows MUST NOT modify another workflow's block.

### BMAD

<!-- owner:bmad -->
<!-- BMAD's project-context skill writes its durable context here. Delete this block if the project does not use BMAD. -->
<!-- /owner -->

### GSD-core

<!-- owner:gsd -->
<!-- GSD's onboarding skill writes its state slice here. Delete this block if the project does not use GSD-core. -->
<!-- /owner -->

### Other workflows

Add a new `<!-- owner:<workflow> -->` block here when adopting a new workflow. Document the extension protocol in this file (see the Workflow blocks section above for block ownership rules).

---

## Skill overlays

Skill overlays own no block. They are sibling files read directly when needed. List every active overlay here as a pointer.

- **impeccable** — `PRODUCT.md` (durable product truth), `DESIGN.md` (visual direction). Read both before any UI work.
- **<overlay name>** — `<path/to/sibling/file>`. <What it tells the agent.>

If a project stops using an overlay, remove its line. Do not leave stale pointers.

---

## Language conventions

Optional. Add one subsection per language the project uses. Delete the subsection if the project follows the language's default style.

### <Language>

<replace with rules that differ from the language's defaults — formatting, naming, file organization, library choices. If you reimplement something the standard library provides, name the standard alternative.>

---

## Conventions that differ from defaults

<catch-all for project-wide conventions that don't fit elsewhere: branch naming, commit message style, worktree layout, schema-naming rules, deployment topology.>

- <convention>.
- <convention>.

---

<!-- agents-template-schema 1 -->