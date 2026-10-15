# Agent Token Optimization

Status: **Living document.** Updated whenever the project-owned agent surface
changes. Last verified 2026-10-10 against `feat/agent-frontmatter` (`28bf331`
+ distillation commit).

The project ships agent configuration files for several AI harnesses. Each
harness scans its own vendor-specific subdirectory at the repo root
(`.claude/`, `.agent/`, `.agents/`, `.codex/`, `.cursor/`, `.gemini/`,
`.kiro/`, `.opencode/`, plus `.amazonq/` and `.devin/` for newer harnesses).
Most of these are **spec-compliant wrappers** around the canonical
user-level skills under `~/.agents/skills/`; modifying them by editing
in place risks being silently overwritten by the next installer run.

This document records the deliberate choices that keep the **per-turn
input-token cost** of an opencode/Claude Code/Cursor/Codex session
against this repository as low as possible without violating the
[AGENTS-TEMPLATE.md](../AGENTS-TEMPLATE.md) reader contract (the
`AGENTS-SPEC.md` §Distribution spec it previously referenced has since
been removed from the repository).

---

## What we did (token-reduction work in this repo)

### Slim `AGENTS.md` kernel — `feat/agent-frontmatter`

- **Before:** 183 lines / ~15 727 bytes / ~3 900 tokens. Heavy Policy,
  Git worktree rule, naming convention, language conventions, and
  stack conventions all lived in the kernel.
- **After:** ~66 lines / ~3 900 bytes / ~1 000 tokens (working tree,
  re-measured after later kernel cleanup; includes the new YAML
  frontmatter and the skill-overlay pointers — the Playwright-Validation
  pointer now references the `webapp-testing` skill). Heavy content
  extracted to three sibling files that the agent reads only when the
  task touches the corresponding domain:
  - [`AGENTS.POLICY.md`](../AGENTS.POLICY.md) — hard policy (CI gate,
    platform-aware exec, prohibitions, workflow ownership). ~142 lines.
  - [`AGENTS.WORKTREES.md`](../AGENTS.WORKTREES.md) — mandatory Git
    worktree rule + naming convention. ~48 lines.
  - [`AGENTS.STACK.md`](../AGENTS.STACK.md) — stack, C# / Angular
    conventions, agent concurrency budget. ~43 lines.
- **Why frontmatter:** added `description`, `allowed-tools`, and
  `mode` so the opencode TUI can do tool-level filtering on the kernel
  itself, separate from the schema header
  (`<!-- agents-template-schema 1 -->`) declared in
  [`AGENTS-TEMPLATE.md`](../AGENTS-TEMPLATE.md) — the current kernel
  does not carry the marker (it was dropped in a later kernel cleanup;
  the file that previously required it, `AGENTS-SPEC.md`, has been
  removed from the repository).

### Extract heavy `speckit.*` command bodies into skills — `feat/agent-frontmatter`

- **Before:** 10 `.opencode/commands/speckit.*.md` files, each 6.6–20.2 KiB
  / 102–365 lines. The worst (`speckit.checklist.md`) was 20.2 KiB /
  365 lines and was **always** injected into the system prompt on
  every opencode session, even when the user wasn't invoking a speckit
  command. Net cost: ~122 KB / ~31 000 tokens always loaded.
- **After:** each `speckit.*` command is now a 5–14-line stub with
  `description` + (where applicable) `handoffs:` blocks. The original
  body lives at `.opencode/skills/speckit-<name>/SKILL.md` (with
  `name:` + `description:` + `handoffs:` frontmatter, BOM-free) and
  loads **only** when the command is invoked. Net cost: ~83 lines /
  ~760 tokens always loaded.
- **Pattern mirrors** what `bmad-*` commands already do: thin
  dispatcher in `commands/`, full body in `skills/`.
- **Note on path references:** the speckit-constitution skill body
  references `.specify/templates/commands/*.md` — that is the
  canonical spec-kit location (the upstream spec-kit ships its command
  files there). In this repo, the spec-kit command files are
  vendored under `.opencode/commands/`, but the skill body is a
  verbatim copy of the upstream spec-kit workflow and is not
  per-repo. If you fork spec-kit for this repo, update the body in
  place; otherwise treat the upstream reference as canonical.

### `playwright-validate` skill — `feat/agent-frontmatter`

- **`.opencode/skills/playwright-validate/SKILL.md`** — full
  validation loop using the Playwright MCP browser tools
  (`browser_navigate`, `browser_snapshot`, `browser_console_messages`,
  `browser_take_screenshot`, …). Allowed-tools restricts the skill to
  only those tools, so it cannot accidentally fall back to filesystem
  reads when smoke-testing a route.
- **`.opencode/commands/playwright-validate.md`** — 8-line command stub
  with `argument-hint` and `agent: build` (no `subtask: true`, so the
  plugin's prompt injection reaches the active agent). No skill body
  references verify-ci; the thin `.opencode/commands/verify-ci.md`
  stub is what dispatches `scripts/verify-ci-local.sh` — verify-ci is
  a script, not an agent, so there is no handoff.
- The former `.opencode/plugins/playwright-validate.ts` auto-invoke
  plugin was retired. `AGENTS.md` now makes real-browser validation an
  explicit contributor responsibility after Angular SPA edits.

### Token budget, before vs. after (this repo only, opencode harness)

Approximate, using the cl100k_base heuristic (~4 chars/token).

| Layer | Before | After |
|---|---|---|
| `AGENTS.md` kernel | ~1 800 | ~1 500 |
| Heavy `speckit.*` command bodies (10 × ~12.5 KB) | ~31 000 | ~400 (stubs only) |
| Always-on skill catalog (12 entries) | ~1 200 | ~1 300 (incl. playwright-validate) |
| Playwright plugin source | — | 0 (plugin retired; no longer loaded) |
| **Subtotal (authored, this repo)** | **~23 000** | **~4 050** |

**~18 950 tokens saved per turn on the opencode harness, from this
repo's contribution alone.** The remaining input budget is dominated
by the user-level `~/.agents/skills/` catalog (~104 skills × 2
duplicate locations) and the opencode harness itself; see the next
section.

---

## What we deliberately did NOT touch

The following subdirectories contain **vendor-spec-compliant wrappers**
around canonical skills that live in `~/.agents/skills/` (user-level)
or `~/.config/opencode/skills/` (opencode user-level). Per the former `AGENTS-SPEC.md` §Distribution (that file has since
been removed from the repository; the rule text is quoted below for
reference):

> Wrappers MUST be a copy of the canonical skill (for
> directory-with-`SKILL.md` shapes) or a thin dispatcher (for
> flat-file slash commands). Wrappers MUST NOT silently modify the
> canonical skill body.

These wrappers are regenerated by the BMAG / GSD / impeccable
installers (`bin/install.js`, `scripts/install.ps1`, etc.). Hand-editing
them produces a no-op the next time an installer runs. The right place
to dedupe is the **installer**, not the wrappers.

| Subdirectory | Files | Bytes | Reason untouched |
|---|--:|--:|---|
| `.claude/` | 969 | ~12 MB | Claude Code vendor wrapper around canonical `~/.agents/skills/` skills. Regenerated by `scripts/install.sh`. |
| `.agent/` | 964 | ~12 MB | Antigravity vendor wrapper. Same canonical source. |
| `.agents/` | 964 | ~12 MB | Codex skills wrapper. Same canonical source. |
| `.cursor/` | 57 | ~2 MB | Cursor vendor wrapper around the `impeccable` skill tree. Regenerated by impeccable's installer. |
| `.gemini/` | 51 | ~2 MB | Gemini CLI wrapper around `impeccable`. |
| `.kiro/` | 52 | ~2 MB | Kiro wrapper around `impeccable`. |
| `.codex/` | 1 | <1 KB | Just `hooks.json`; PostToolUse + Stop hooks for the existing impeccable detector. (The `impeccable` runtime cache lives separately at `.impeccable/`.) |
| `.amazonq/` | 1 | <1 KB | `rules/spec-driven-development.md`; Amazon Q auto-discovers AGENTS.md. |
| `.devin/` | 1 | <1 KB | `rules/spec-driven-development.md`; Devin auto-discovers AGENTS.md. |
| `.clinerules/` | 1 | <1 KB | Cline reads `spec-driven-development.md`. Already minimal. |
| `.impeccable/` | 4 | ~17 KB | impeccable-local runtime cache. Not agent-facing. |

### The actual duplication problem

If you do **only** the work in this repo, the opencode TUI catalog
will still inflate on turn 1 because of the following five user-level
sources:

| Where | What | Bytes | ~Tokens |
|---|---|--:|--:|
| `~/.agents/skills/` | 104 skills × frontmatter | ~17 600 | ~4 400 |
| `~/.config/opencode/skills/` | 72 gsd-* × frontmatter (duplicate) | ~13 200 | ~3 300 |
| `~/.config/opencode/agents/` | 64 gsd-* agent definitions × frontmatter | ~16 100 | ~4 000 |
| `~/.config/opencode/commands/` | 72 gsd-* slash commands × frontmatter | ~19 400 | ~4 850 |
| `~/.config/opencode/plugins/gsd-core.js` | plugin source | — | — (plugin no longer present; `plugins/` dir removed) |

That catalog — all loaded by opencode on turn 1 of any session —
explains the 31.4 KB / 6% number observed in the opencode TUI on
2026-10-10. **The repo-side work above saves ~19 000 tokens; the
remaining ~22 700 tokens are user-level, not in this repo's reach.**

### How to dedupe at the user level (out of repo, recommended follow-up)

The user-level cleanup is straightforward and lives entirely in
`$HOME`:

1. **Switch GSD profile from `full` to `core`.** Run
   `/skill:gsd-surface profile core`. The `core` profile keeps only:
   `new-project`, `discuss-phase`, `plan-phase`, `execute-phase`,
   `phase`, `help`, `update`, `surface`. Saving: ~3 000–4 000 tokens.
2. **Move BMAD PM/PRD/brainstorm skills to a disabled directory.** The
   project uses spec-kit, not PRDs, and is past the planning phase.
   Move `bmad-prd`, `bmad-prfaq`, `bmad-product-brief`,
   `bmad-create-epics-and-stories`, `bmad-architecture`,
   `bmad-sprint-planning`, `bmad-brainstorming`, `bmad-forge-idea`,
   `bmad-deep-recon`, `bmad-advanced-elicitation`, `bmad-party-mode`,
   `bmad-ux` to `~/.agents/skills-disabled/`. Saving: ~600–800
   tokens.
3. **Dedupe gsd-* skills between `~/.agents/skills/` and
   `~/.config/opencode/skills/`.** Delete one or the other; no
   opencode plugin re-stages the canonical set anymore (`gsd-core.js`
   was removed; GSD runtime code now lives at `~/.agents/gsd-core/`).
   Saving: ~3 300 tokens.
4. **Slim the gsd-core.js plugin.** No longer applicable — the plugin
   is not present at `~/.config/opencode/plugins/` and the directory
   has been removed; GSD runtime code now lives at
   `~/.agents/gsd-core/bin/lib/`. Saving: already realized.

Combined, those four steps would bring the opencode TUI down from
~31 400 tokens to ~13 000–15 000 tokens on turn 1, all without
losing any functionality this project actually uses.

---

## What we did NOT do (yet)

- **Automate `playwright-validate` in vendor-specific hooks.** The
  repository currently relies on the explicit contributor rule in
  `AGENTS.md`; automation would require a hook script per vendor format
  plus the corresponding settings updates.
- **Slim `~/.agents/skills/` from "full" install to a project-curated
  subset.** Out of repo; see the previous section.
- **Fix the installer to stop writing three near-identical copies.**
  Out of repo; would touch `scripts/install.sh` / `scripts/install.ps1`
  in the BMAD / GSD / impeccable upstream skill repos, not in this
  repository.

---

## How to verify the savings

```bash
# Repo contribution only.
python -c "
import tiktoken, os
enc = tiktoken.get_encoding('cl100k_base')
total = 0
for p in ['AGENTS.md', '.agents/rules/local-ci-verification.md']:
    total += len(enc.encode(open(p, encoding='utf-8').read()))
for d in os.listdir('.opencode/skills'):
    fp = f'.opencode/skills/{d}/SKILL.md'
    if os.path.isfile(fp):
        # catalog only — first '---' block
        body = open(fp, encoding='utf-8').read().split('---', 2)[1]
        total += len(enc.encode(body))
print('authored turn-1 contribution: ', total, 'tokens')
"
```

Compare the output to the equivalent run before this commit
(`git checkout main -- AGENTS.md .opencode/commands/speckit.specify.md`).

---

## Windows-host Web SPA gate (added 2026-10-12)

Windows binds do not propagate `node_modules/.bin/` symlinks into Linux
containers, and `cp -r` of an in-flight `npm ci` populating `node_modules/`
races and fails intermittently. Use the recipe in
[`AGENTS.POLICY.md` §Web SPA gate / Fallbacks](../AGENTS.POLICY.md) — the
single bind-mount of the source tree is replaced with a `cp -r` of the
Web folder (excluding `node_modules`, `.angular`, `test-results`, `.git`)
into the container's native filesystem, then `npm ci` runs in-container.
Everything else (lint, playwright install, karma) is bit-for-bit
equivalent to the Gitea `lint` job.
