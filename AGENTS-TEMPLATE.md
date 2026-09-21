<!-- agents-template-schema 1 -->

# AGENTS.md Template (v1)

> A schema-driven template for `AGENTS.md` that works across BMAD, GSD-core, impeccable, and any future workflow or skill overlay. Replace the example content with your own; keep the section structure, ownership markers, and freshness stamps.

The template is **workflow-neutral by default**. Workflow-specific machinery (BMAD's project-context block, GSD's state slice, etc.) lives in marked, workflow-owned blocks. Skill overlays (impeccable, linters, formatters, design detectors) are listed as pointers to sibling files; they do not own any block.

For the authoritative reader contract — how agents interpret this template, the extension protocol, and how freshness stamps behave — see `AGENTS-SPEC.md`.

---

## Reader contract (minimal)

An agent reading `AGENTS.md` alone (without `AGENTS-SPEC.md`) MUST:

1. Treat sections without an `<!-- owner:... -->` comment as **project-owned**: their content is binding for this repository and the agent obeys it.
2. Treat sections marked `<!-- owner:<workflow> -->` as **workflow-owned**: the agent obeys the *non-empty* blocks for workflows it knows it is running. Empty blocks (between `<!-- owner:<workflow> -->` and `<!-- /owner -->` with no content) are inert.
3. Honor a freshness stamp (`<!-- verified YYYY-MM-DD against <sha> -->` or `<!-- approved YYYY-MM-DD -->`) on workflow blocks as a cache-invalidation signal. Orientation sections do not carry stamps.
4. Treat the `## Skill overlays` list as a set of pointers to sibling files. The agent reads those sibling files directly; it does not assume any overlay owns anything in `AGENTS.md`.
5. Treat the schema header (`<!-- agents-template-schema 1 -->`) as the version this file conforms to. Unknown section names do not error; the agent ignores them.

---

## Project

<one-line description of the project, its domain, and its primary users. Replace this paragraph.>

---

## Repo anatomy

<orientation. Describe the top-level layout so an agent can find things without guesswork.>

- `<path>/` — <what lives here, source vs. generated, tracked vs. gitignored>.
- `<path>/` — <...>.
- `<path>/` — <...>.

Rules of thumb:

- Generated output (build artifacts, distribution bundles, provider-specific harness folders) goes in paths that are either gitignored or explicitly tracked-for-release. Mark them clearly.
- Configuration files at the repo root (`package.json`, `Cargo.toml`, `pyproject.toml`, `*.csproj`, `pom.xml`, etc.) are project-owned; do not put policy or conventions in them.

---

## Build, test, and development commands

<orientation. List the canonical commands an agent should run for build, lint, test, and local development. Use the project's actual toolchain.>

### Build

- `<command>` — <what it does>.

### Test

- `<command>` — <what it does, what kind of tests (unit/integration/E2E)>.

### Lint / format

- `<command>` — <what it does>.

### Local development

- `<command>` — <how to run the app locally>.

If the project uses containers for any of the above, name the compose file and the project-name convention here so an agent does not collide with another worktree's stack.

---

## Policy

<hard rules the agent must not violate. Keep this section short and enforceable. If a rule is process rather than policy (e.g., "wait for user confirmation before merging"), it belongs in the workflow block for the workflow that owns that process, not here.>

- <rule 1>.
- <rule 2>.

If the project has **no** hard policy beyond what the workflows enforce, leave this section as a one-line placeholder: `_No project-level policy; see workflow blocks for ceremony._`

The following Git worktree rule is **strongly recommended** for every project that adopts this template. Include it unless the project has a documented reason to diverge (for example, a project that is itself a Git implementation and needs to test worktree internals).

### Git worktree rule (recommended for adoption)

- **All Git work happens in a worktree.** When an agent (AI or human) is making a change, never commit, branch, push, or merge on `main`. The only permitted operation on `main` is fast-forwarding `main` to a feature branch's tip after a human has reviewed and approved the change. Create a dedicated Git worktree at `.worktrees/<task>/` on a branch `feat/<task>`, where `<task>` is a semantic, lowercase, hyphen-separated name describing the change (e.g., `add-worktree-policy`, `fix-workflow-block-precedence`).
- **The agent reports done; the human merges on `main`.** The agent commits, branches, and pushes inside the worktree, then stops. The agent MUST NOT run `git merge` on `main` for any reason. The only exception: the human explicitly says, in the current turn, "merge on main." Anything else — including approval of the change — is not an instruction to merge.
- **Pre-flight check before creating a worktree.** Use only read-only Git commands to confirm that the branch `feat/<task>` does not already exist and that the path `.worktrees/<task>/` is not already a worktree. If either exists, abort and pick a different task name.
- **One task, one worktree, one branch.** Do not reuse a `<task>` slug, a `feat/<task>` branch, or a `.worktrees/<task>/` path between concurrent tasks. The same name may be reused only after the previous worktree is removed and its branch is merged or deleted.
- **Canonical command.** `git worktree add -b feat/<task> .worktrees/<task> main` is the canonical way to create the worktree; it creates the branch and the path in one step.
- **Clean up after merge.** After a change merges to `main` and is verified, remove only the worktree you created: `git worktree remove .worktrees/<task>`. Do not touch unrelated worktrees, branches, or paths.
- **No force-push, no rewriting shared history.** Do not rewrite commits that have been pushed or that other worktrees share. Local-only history rewrites (interactive rebase before push) are allowed when no one else depends on the branch.

---

## Workflow blocks

Each block below is owned by one workflow. The block is **inert** when empty — an agent that does not run that workflow ignores it. Workflows may replace the contents of their own block on refresh (e.g., BMAD's `bmad-project-context` regenerates the BMAD block; GSD's `gsd-onboard` regenerates the GSD block). Workflows MUST NOT modify another workflow's block.

### BMAD

<!-- owner:bmad -->
<!-- BMAD's project-context skill writes its durable context here. Delete this block if the project does not use BMAD. -->
<!-- /owner -->

### GSD-core

<!-- owner:gsd -->
<!-- GSD's onboarding skill writes its state slice here. Delete this block if the project does not use GSD-core. -->
<!-- /owner -->

### Other workflows

Add a new `<!-- owner:<workflow> -->` block here when adopting a new workflow. Document the block in `AGENTS-SPEC.md` (see Extension protocol).

---

## Skill overlays

Skill overlays do not own any block in `AGENTS.md`. They are **sibling files** that the agent reads directly when needed. List every active overlay here as a pointer.

- **impeccable** — `PRODUCT.md` (durable product truth), `DESIGN.md` (visual direction). Read both before any UI work.
- **<overlay name>** — `<path/to/sibling/file>`. <What it tells the agent.>

If a project stops using an overlay, remove its line. Do not leave stale pointers.

---

## Language conventions

Optional. Add one subsection per language the project uses. If the project follows the language's default style without modification, delete the subsection.

### <Language>

<replace this with rules that differ from the language's defaults — formatting, naming, file organization, library choices. If you reimplement something the standard library provides, name the standard alternative here.>

---

## Conventions that differ from defaults

<catch-all for project-wide conventions that don't fit elsewhere: branch naming, commit message style, worktree layout, schema-naming rules, deployment topology. Use the categories the project actually needs.>

- <convention>.
- <convention>.

---

<!-- agents-template-schema 1 -->
