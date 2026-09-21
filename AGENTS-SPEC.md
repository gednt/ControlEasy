<!-- agents-spec-schema 1.2 -->

# AGENTS-SPEC.md — Reader Contract for `AGENTS.md` (v1.2)

> The authoritative specification for how agents read and obey `AGENTS.md` files written against the `agents-template-schema` family. The template (`AGENTS-TEMPLATE.md`) and any `AGENTS.md` written from it MUST conform to this spec. When the two conflict, this spec wins.

## Table of contents

1. [Scope](#scope)
2. [Terminology](#terminology)
3. [Schema versioning](#schema-versioning)
4. [Sections and ownership](#sections-and-ownership)
5. [Workflow blocks](#workflow-blocks)
6. [Skill overlays](#skill-overlays)
7. [Onboarding](#onboarding)
8. [Distribution](#distribution)
9. [Freshness stamps](#freshness-stamps)
10. [Reader algorithm](#reader-algorithm)
11. [Extension protocol](#extension-protocol)
12. [Conformance](#conformance)
13. [Change history](#change-history)

---

## Scope

This spec governs:

- `AGENTS.md` files written against `agents-template-schema 1` (or later).
- `AGENTS-TEMPLATE.md`, the canonical template that produces conforming `AGENTS.md` files.
- Any agent that reads a conforming `AGENTS.md`, regardless of which workflow or skill overlay produced or consumes the file.

This spec does **not** govern:

- The internal structure of workflow-owned artifacts (`_bmad-output/`, `.planning/`, `.impeccable/`, etc.). Those are owned by their workflows.
- The internal structure of skill-overlay sibling files (`PRODUCT.md`, `DESIGN.md`, etc.). Those are owned by their overlays.
- The content of `AGENTS.md` sections — only their structure and interpretation.

---

## Terminology

- **Agent** — any AI tool that reads `AGENTS.md` to inform its behavior in a repository (Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, Grok Build, OpenCode, Hermes, Pi, Kiro, Mistral Vibe, Rovo Dev, Trae, Veto, Qoder, custom harnesses).
- **Project** — the repository whose `AGENTS.md` is being read.
- **Workflow** — a system that produces planning or state artifacts and owns a marked block in `AGENTS.md`. Examples: BMAD, GSD-core.
- **Skill overlay** — a system that adds capabilities on top of an existing workflow without owning any `AGENTS.md` block. Examples: impeccable (design), formatters, linters, design detectors.
- **Owner marker** — an HTML comment of the form `<!-- owner:<scope> -->` opening a workflow-owned block, paired with `<!-- /owner -->` closing it.
- **Freshness stamp** — an HTML comment that records when a workflow block was last verified against a known-good state.

---

## Schema versioning

Every conforming `AGENTS.md` carries a header comment of the form:

```html
<!-- agents-template-schema <N> -->
```

where `<N>` is a positive integer. The header MUST appear:

1. Within the first 20 lines of the file (so an agent discovers it on a cheap prefix read).
2. Also as a footer comment at the very end of the file, so a partial-read agent that scrolls from the bottom still detects it.

The footer is redundant by design: it guards against agent harnesses that truncate large files.

A new minor version (e.g., `1.1`) adds sections or markers in a backward-compatible way. A new major version (e.g., `2`) may rename or repurpose sections and is **not** backward-compatible.

---

## Sections and ownership

An `AGENTS.md` written against schema 1 carries the following sections, in order. Sections MAY be omitted; sections in **bold** are recommended.

1. **Reader contract (minimal)** — restated at the top of `AGENTS.md` so the file is interpretable without this spec. MUST be present if `AGENTS-SPEC.md` is absent.
2. **Project** — one-line description, domain, users.
3. **Repo anatomy** — orientation, top-level layout.
4. **Build, test, and development commands** — orientation, canonical commands.
5. **Policy** — hard rules. Optional; may be a one-line placeholder.
6. **Workflow blocks** — one subsection per adopted workflow, each wrapped in `<!-- owner:<workflow> --> ... <!-- /owner -->` markers.
7. **Skill overlays** — pointer list to sibling files.
8. **Language conventions** — per-language style overrides; optional.
9. **Conventions that differ from defaults** — catch-all for project-wide conventions.

Section ownership rules:

- A section without an `<!-- owner:... -->` marker is **project-owned**. The agent obeys it as policy for this repository.
- A workflow block wrapped in `<!-- owner:<workflow> -->` markers is **workflow-owned**. The agent obeys it only if (a) the block is non-empty AND (b) the agent knows it is running that workflow. Otherwise it ignores the block.
- A workflow's onboarding or context-refresh skill MAY replace the contents of its own block. It MUST NOT modify another workflow's block or any project-owned section.
- A skill overlay owns **no** block. It is listed under `## Skill overlays` as a pointer to one or more sibling files.

Section names are case-insensitive but conventionally Title Case (`## Policy`, not `## policy`). An agent encountering an unknown section name ignores it without error.

---

## Workflow blocks

A workflow block has the structure:

```markdown
### <Workflow name>

<!-- owner:<workflow-code> -->
<!-- optional: <!-- verified YYYY-MM-DD against <sha> --> -->
<!-- optional: <!-- approved YYYY-MM-DD --> -->
<content owned by the workflow>
<!-- /owner -->
```

Rules:

- The block MUST be wrapped in matched `<!-- owner:<workflow-code> -->` and `<!-- /owner -->` comments.
- The `<workflow-code>` is a short lowercase identifier (`bmad`, `gsd`, ...). The same identifier MUST be used in `AGENTS-SPEC.md`'s [Supported workflows](#extension-protocol) table.
- Empty blocks (whitespace only, or only containing the explanatory comments in the template) are inert.
- Workflows MAY add additional HTML comments inside their block to mark sub-regions (e.g., BMAD's `<!-- verified ... -->` line). Sub-region markers MUST NOT escape the outer `<!-- /owner -->` boundary.
- An agent that runs multiple workflows simultaneously reads all populated blocks. Where two populated blocks conflict on the same topic (e.g., both prescribe a merge ceremony), the agent follows the **more specific** block. Specificity is determined by which workflow the agent treats as authoritative for that topic; this spec does not prescribe a global precedence order.

### Supported workflows

| Code       | Name      | Owns                              | Freshness stamp type |
| ---------- | --------- | --------------------------------- | -------------------- |
| `bmad`     | BMAD      | Architecture, planning artifacts  | `verified <sha>`     |
| `gsd`      | GSD-core  | Phase state, atomic-commit ceremony | `verified <sha>`   |

---

## Skill overlays

A skill overlay is listed in `AGENTS.md` under `## Skill overlays` as a pointer:

```markdown
- **<overlay name>** — `<path/to/sibling/file>`. <one-line role>.
```

An overlay may also ship one or more **skills** (executable onboarding, refresh, or maintenance procedures). A skill is identified by its directory under the overlay (e.g., `agents-init/`) and is named in the overlay's pointer with a brief description of when to invoke it.

Rules:

- The overlay MUST NOT introduce any `<!-- owner:... -->` block in `AGENTS.md`.
- The overlay's pointers MUST resolve to existing files or directories relative to the repository root.
- The agent reads the sibling file(s) directly when its tasks touch the overlay's domain (e.g., impeccable's `PRODUCT.md` and `DESIGN.md` are read before any UI work).
- The overlay MAY write files under a project-local subdirectory (e.g., `.impeccable/`) without touching `AGENTS.md`.
- An overlay that ships skills MUST document the skill's name, invocation, and preconditions in the pointer line so an agent knows when to run it.

### Supported overlays

| Name             | Pointer(s)                                                  | Read / invoke when                       |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `impeccable`     | `PRODUCT.md`, `DESIGN.md`                                   | Any UI/design work                       |
| `agents-template` | `AGENTS-TEMPLATE.md`, `AGENTS-SPEC.md`, `agents-init/SKILL.md` | Editing the schema or onboarding a project (read template + spec; run `agents-init` to scaffold) |

---

## Onboarding

A downstream project that adopts the schema writes a conformant `AGENTS.md` by running an **onboarding skill** shipped by the agents-template overlay. The canonical onboarding skill is `agents-init`. The contract between the onboarding skill and the schema is:

- The onboarding skill reads `AGENTS-TEMPLATE.md` and replaces its placeholders with project-specific content. It MUST NOT modify the schema header/footer, the `## Reader contract (minimal)` section, or the empty workflow-block markers.
- The onboarding skill is **non-destructive**: it MUST archive any existing `AGENTS.md` to `AGENTS.md.<suffix>.bak` before overwriting. The suffix is the project slug (preferred) or a date stamp (fallback).
- The onboarding skill MUST verify conformance against §Conformance before declaring success. If any check fails, the skill aborts and surfaces the failed checks; it does not write a non-conformant file.
- The onboarding skill does **not** write workflow-owned artifacts (BMAD's `_bmad-output/`, GSD's `.planning/`). Those are the workflows' own onboarding skills' jobs, which run *after* the schema-1 onboarding and fill the workflow blocks.
- The onboarding skill is idempotent: re-running it on a project with a conformant `AGENTS.md` is allowed and offers *refresh in place* (default) or *archive and rewrite*.

A project may ship its own onboarding skill under its own overlay. Such a skill MUST honor the same contract. Register the skill in the Supported overlays table by extending the `agents-template` row or adding a new overlay row.

---

## Distribution

A skill that conforms to this spec is **inert** until a harness can find it. Each agent harness scans one or more vendor-specific directories at the repo root (or under the user's home directory) for skill and slash-command definitions. The canonical skill body lives in a single place; vendor-specific entries are thin wrappers that point at it.

### Canonical skill location

A skill body MUST live in a single file whose path is documented in the overlay's pointer in `AGENTS.md`. The agents-template overlay's canonical skill is `agents-init/SKILL.md`. All vendor-specific wrappers dispatch to this file.

### Vendor wrapper shapes

Two shapes are in use across the supported harnesses:

- **Flat-file slash command** — a single file with frontmatter that the harness registers as a slash command. Body is short: frontmatter + a pointer to the canonical skill. Used by Claude Code, OpenCode, Codex (prompts), Cursor, Gemini CLI, GitHub Copilot.
- **Directory-with-`SKILL.md` skill** — a directory containing a `SKILL.md` (and optionally other files) that the harness auto-discovers. Body is the full skill. Used by Antigravity, Codex (skills), Hermes, Kiro, Pi, Qoder, Rovo Dev, Trae, Trae-CN, Vibe, DeepSeek Harness, Mistral Vibe.

A wrapper MUST be a copy of the canonical skill (for directory-with-`SKILL.md` shapes) or a thin dispatcher (for flat-file slash commands). Wrappers MUST NOT silently modify the canonical skill body.

### Vendor matrix

| Harness            | Wrapper path (project-local)                       | Shape                          | Notes                                                                              |
| ------------------ | --------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| Claude Code        | `.claude/commands/agents-init.md`                   | Flat-file slash command        | Anthropic's flagship harness.                                                       |
| OpenCode           | `.opencode/command/agents-init.md`                  | Flat-file slash command        | Singular `command/`.                                                                |
| Codex (slash)      | `.codex/prompts/agents-init.md`                     | Flat-file slash command        | Codex also has a skills system; both are supported.                                 |
| Codex (skill)      | `.agents/skills/agents-init/SKILL.md`               | Directory-with-`SKILL.md`       | Plural `.agents/`.                                                                   |
| Cursor (slash)     | `.cursor/commands/agents-init.md`                   | Flat-file slash command        |                                                                                    |
| Cursor (skill)     | `.cursor/skills/agents-init/SKILL.md`               | Directory-with-`SKILL.md`       |                                                                                    |
| Gemini CLI         | `.gemini/commands/agents-init.toml`                 | Flat-file slash command (TOML) | TOML frontmatter, not YAML.                                                         |
| Antigravity        | `.agent/skills/agents-init/SKILL.md`                | Directory-with-`SKILL.md`       | Singular `.agent/` (not `.agents/`). Google's flagship.                             |
| GitHub Copilot     | `.github/prompts/agents-init.prompt.md`             | Flat-file prompt file          | `.prompt.md` suffix is the Copilot convention.                                     |
| Hermes             | `.hermes/skills/agents-init/SKILL.md`               | Directory-with-`SKILL.md`       | Project-local skills require a `hermes skills trust` step.                          |
| Kiro               | `.kiro/skills/agents-init/SKILL.md`                 | Directory-with-`SKILL.md`       |                                                                                    |
| Pi                 | `.pi/skills/agents-init/SKILL.md`                   | Directory-with-`SKILL.md`       |                                                                                    |
| Qoder              | `.qoder/skills/agents-init/SKILL.md`                | Directory-with-`SKILL.md`       |                                                                                    |
| Rovo Dev           | `.rovodev/skills/agents-init/SKILL.md`              | Directory-with-`SKILL.md`       | Atlassian.                                                                          |
| Trae               | `.trae/skills/agents-init/SKILL.md`                 | Directory-with-`SKILL.md`       |                                                                                    |
| Trae-CN            | `.trae-cn/skills/agents-init/SKILL.md`              | Directory-with-`SKILL.md`       |                                                                                    |
| Vibe               | `.vibe/skills/agents-init/SKILL.md`                 | Directory-with-`SKILL.md`       | Mistral.                                                                             |
| DeepSeek Harness   | `.dsh/skills/agents-init/SKILL.md`                  | Directory-with-`SKILL.md`       |                                                                                    |
| Veto (global)      | `~/.veto/skills/agents-init/SKILL.md`                | Directory-with-`SKILL.md`       | Project-local install is discouraged; use the global path.                          |

The seven priority wrappers shipped in this repository are: Claude Code, OpenCode, Codex (slash + skill), Cursor (slash), Gemini CLI, Antigravity, and GitHub Copilot. Other vendors are supported via the installer in `scripts/install.sh` and `scripts/install.ps1`, which detects the user's installed harness and copies the right wrapper.

### Installer behavior

The installer scripts (`scripts/install.sh`, `scripts/install.ps1`) detect installed harnesses by looking for their home-directory markers (`~/.claude/`, `~/.opencode/`, `~/.codex/`, `~/.cursor/`, `~/.gemini/`, `~/.agent/`, `~/.config/gh-copilot/`, etc.) and, for each detected harness, copy the corresponding wrapper to the user's home directory (for global-install vendors) or print instructions for project-local vendors that the user must run themselves.

The installer MUST NOT overwrite an existing wrapper without confirmation. It MUST print a summary of which wrappers it installed and which it skipped.

---

## Freshness stamps

A workflow block MAY carry a freshness stamp as the first or last line inside the `<!-- owner -->` region:

- `<!-- verified YYYY-MM-DD against <sha> -->` — the workflow's content was last verified against commit `<sha>` on `<date>`. Used by stateful workflows (BMAD, GSD-core).
- `<!-- approved YYYY-MM-DD -->` — the workflow's content was last approved on `<date>`. Used by change-driven workflows.

Semantics:

- A workflow onboarding or refresh skill SHOULD update the stamp when it rewrites the block.
- An agent SHOULD treat a stale stamp (older than the latest commit that touches files the workflow owns) as a signal to re-run the workflow's onboarding or context-refresh skill before trusting the block's content.
- An agent MUST NOT enforce a freshness threshold on its own. Staleness is a hint, not a hard error.
- Project-owned sections and overlay pointers do not carry freshness stamps.

---

## Reader algorithm

When an agent encounters `AGENTS.md` in a repository:

1. Read the file's first 20 lines and the last 5 lines. Locate the `<!-- agents-template-schema N -->` header (one or both should be present). If neither is present, treat the file as **legacy** and apply best-effort interpretation: section names map to their schema-1 counterparts if recognizable.
2. Read the `## Reader contract (minimal)` section if present. Honor the five obligations listed there.
3. For each section in order:
   - If wrapped in `<!-- owner:<workflow> -->` markers and the agent knows it runs that workflow and the block is non-empty: obey the contents.
   - Otherwise, if unwrapped: obey the contents as project policy.
4. Resolve the `## Skill overlays` list. For each pointer, read the referenced file(s) lazily — when the agent's task touches the overlay's domain.
5. If a workflow block carries a freshness stamp, check the stamp against the repository's recent commit history. If the stamp is stale, surface a soft warning to the user ("BMAD context last verified against `<old-sha>`; consider running `bmad-project-context` to refresh") before obeying the block.
6. Ignore unknown sections, unknown `<!-- owner:<scope> -->` codes, and unknown freshness-stamp types.

---

## Extension protocol

New workflows and overlays join the spec by addition, not modification. To register a new workflow or overlay:

1. **Choose a code.** For workflows, a short lowercase identifier (`myflow`). For overlays, a short name (`myoverlay`).
2. **Define the block template.** For workflows, a markdown skeleton the workflow's onboarding skill writes into its `<!-- owner:<code> --> ... <!-- /owner -->` region. For overlays, a sibling-file structure.
3. **Choose a freshness-stamp type.** Reuse `verified <sha>` or `approved <date>`, or define a new one with explicit semantics.
4. **Add a row** to the relevant table in this spec (Supported workflows or Supported overlays).
5. **Bump the schema footer** in this spec and the template (`<!-- agents-spec-schema 1 -->` → `<!-- agents-spec-schema 1.1 -->
` for additions, `<!-- agents-spec-schema 2 -->` for breaking changes).

Additions are backward-compatible: existing `AGENTS.md` files continue to obey correctly because unknown `<!-- owner:<code> -->` blocks are ignored when the agent does not run that workflow. Breaking changes (renaming a section, repurposing a marker) require a major version bump.

The spec does not require a central registry. Workflow and overlay authors are responsible for proposing their entries; the spec is updated by the template maintainer when consensus forms.

---

## Conformance

A file is **conformant** if:

1. It carries both the header and footer `<!-- agents-template-schema N -->` markers.
2. Its `## Reader contract (minimal)` section contains the five obligations listed in the template, in the listed order, with wording substantively equivalent.
3. Every `<!-- owner:<code> -->` marker is paired with a matching `<!-- /owner -->`.
4. Every workflow block references a `<code>` listed in the [Supported workflows](#extension-protocol) table, or one added by a future version of this spec.
5. Every `## Skill overlays` pointer references a file or directory that exists in the repository.

An agent MUST treat a non-conformant file as a best-effort input: it parses what it can, ignores what it cannot, and does not error.

---

## Change history

- **v1** (initial) — five-section schema, workflow blocks, skill overlays, freshness stamps, extension protocol.
- **v1.1** — added Onboarding section. Overlays may now ship skills (not just point at sibling files); the agents-template overlay is registered with three pointers (template, spec, `agents-init` skill); conformance rule 5 generalized from "files" to "files or directories."
- **v1.2** — added Distribution section. Documented the vendor-wrapper convention, the full vendor matrix, and the installer scripts. Added Antigravity to the priority vendor list.

<!-- agents-spec-schema 1.2 -->
