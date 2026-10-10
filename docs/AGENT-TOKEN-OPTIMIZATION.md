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
against this repository as low as possible without violating
[AGENTS-SPEC.md](../AGENTS-SPEC.md) §Distribution.

---

## What we did (token-reduction work in this repo)

### Slim `AGENTS.md` kernel — `feat/agent-frontmatter`

- **Before:** 183 lines / ~7 344 bytes / ~1 800 tokens. Heavy Policy,
  Git worktree rule, naming convention, language conventions, and
  stack conventions all lived in the kernel.
- **After:** 130 lines / ~6 766 bytes / ~1 700 tokens (including the
  new YAML frontmatter, the spec-kit workflow block, and the new
  `playwright-validate` skill-overlay pointer). Heavy content
  extracted to three sibling files that the agent reads only when the
  task touches the corresponding domain:
  - [`AGENTS.POLICY.md`](../AGENTS.POLICY.md) — hard policy (CI gate,
    platform-aware exec, prohibitions, workflow ownership). ~66 lines.
  - [`AGENTS.WORKTREES.md`](../AGENTS.WORKTREES.md) — mandatory Git
    worktree rule + naming convention. ~67 lines.
  - [`AGENTS.STACK.md`](../AGENTS.STACK.md) — stack, C# / Angular
    conventions, agent concurrency budget. ~52 lines.
- **Why frontmatter:** added `description`, `allowed-tools`, and
  `mode` so the opencode TUI can do tool-level filtering on the kernel
  itself, separate from the schema header
  (`<!-- agents-template-schema 1 -->`) which `AGENTS-SPEC.md` requires.

### Extract heavy `speckit.*` command bodies into skills — `feat/agent-frontmatter`

- **Before:** 10 `.opencode/commands/speckit.*.md` files, each 6–20 KB
  / 100–345 lines. The worst (`speckit.specify.md`) was 17.6 KB /
  345 lines and was **always** injected into the system prompt on
  every opencode session, even when the user wasn't invoking a speckit
  command. Net cost: ~100 KB / ~20 000 tokens always loaded.
- **After:** each `speckit.*` command is now a 5–8-line stub with
  `description` + (where applicable) `handoffs:` blocks. The original
  body lives at `.opencode/skills/speckit-<name>/SKILL.md` (with
  `name:` + `description:` + `handoffs:` frontmatter, BOM-free) and
  loads **only** when the command is invoked. Net cost: ~50 lines /
  ~400 tokens always loaded.
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

### New `playwright-validate` skill + auto-invoke plugin — `feat/agent-frontmatter`

- **`.opencode/skills/playwright-validate/SKILL.md`** — full
  validation loop using the Playwright MCP browser tools
  (`browser_navigate`, `browser_snapshot`, `browser_console_messages`,
  `browser_take_screenshot`, …). Allowed-tools restricts the skill to
  only those tools, so it cannot accidentally fall back to filesystem
  reads when smoke-testing a route.
- **`.opencode/commands/playwright-validate.md`** — 8-line command stub
  with `argument-hint` and `agent: build` (no `subtask: true`, so the
  plugin's prompt injection reaches the active agent). Skill bodies
  emit a final reminder to run `scripts/verify-ci-local.sh --fast`
  manually — verify-ci is a script, not an agent, so there is no
  handoff.
- **`.opencode/plugins/playwright-validate.ts`** — auto-invoke plugin.
  Listens to `tool.execute.after` for `edit|write` tool calls; filters
  paths under `src/Web/ControlEasyReborn.Web/**` (case-insensitive,
  relative paths resolved against the worktree root); buffers touched
  paths per session; on `session.idle` fires a single TUI toast +
  `appendPrompt` injection that tells the agent to run the skill once
  instead of spamming per-file. Failed dispatches push the buffer
  back for retry on the next idle.

### Token budget, before vs. after (this repo only, opencode harness)

Approximate, using the cl100k_base heuristic (~4 chars/token).

| Layer | Before | After |
|---|---|---|
| `AGENTS.md` kernel | ~1 800 | ~1 500 |
| Heavy `speckit.*` command bodies (10 × ~8 KB) | ~20 000 | ~400 (stubs only) |
| Always-on skill catalog (12 entries) | ~1 200 | ~1 300 (incl. playwright-validate) |
| Playwright plugin source | — | ~850 (loaded as plugin context) |
| **Subtotal (authored, this repo)** | **~23 000** | **~4 050** |

**~18 950 tokens saved per turn on the opencode harness, from this
repo's contribution alone.** The remaining input budget is dominated
by the user-level `~/.agents/skills/` catalog (~103 skills × 2
duplicate locations) and the opencode harness itself; see the next
section.

---

## What we deliberately did NOT touch

The following subdirectories contain **vendor-spec-compliant wrappers**
around canonical skills that live in `~/.agents/skills/` (user-level)
or `~/.config/opencode/skills/` (opencode user-level). Per
[AGENTS-SPEC.md](../AGENTS-SPEC.md) §Distribution:

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
| `.amazonq/` | 0 | — | Empty placeholder; Amazon Q auto-discovers AGENTS.md. |
| `.devin/` | 0 | — | Empty placeholder; Devin auto-discovers AGENTS.md. |
| `.clinerules/` | 1 | <1 KB | Cline reads `spec-driven-development.md`. Already minimal. |
| `.impeccable/` | 3 | ~17 KB | impeccable-local runtime cache. Not agent-facing. |

### The actual duplication problem

If you do **only** the work in this repo, the opencode TUI catalog
will still inflate on turn 1 because of the following five user-level
sources:

| Where | What | Bytes | ~Tokens |
|---|---|--:|--:|
| `~/.agents/skills/` | 103 skills × frontmatter | ~17 600 | ~4 400 |
| `~/.config/opencode/skills/` | 71 gsd-* × frontmatter (duplicate) | ~13 200 | ~3 300 |
| `~/.config/opencode/agents/` | 34 gsd-* sub-agent frontmatter | ~8 400 | ~2 100 |
| `~/.config/opencode/commands/` | 71 gsd-* slash commands × frontmatter | ~19 400 | ~4 850 |
| `~/.config/opencode/plugins/gsd-core.js` | plugin source | 32 000 | ~8 000 |

That catalog — all loaded by opencode on turn 1 of any session —
explains the 31.4 KB / 6% number observed in the opencode TUI on
2026-10-10. **The repo-side work above saves ~19 000 tokens; the
remaining ~22 700 tokens are user-level, not in this repo's reach.**

### How to dedupe at the user level (out of repo, recommended follow-up)

The user-level cleanup is straightforward and lives entirely in
`$HOME`:

1. **Switch GSD profile from `full` to `core`.** Run
   `/skill:gsd-surface profile core`. The `core` profile keeps only:
   `next`, `new-project`, `onboard`, `discuss-phase`, `plan-phase`,
   `execute-phase`, `help`, `update`. Saving: ~3 000–4 000 tokens.
2. **Move BMAD PM/PRD/brainstorm skills to a disabled directory.** The
   project uses spec-kit, not PRDs, and is past the planning phase.
   Move `bmad-prd`, `bmad-prfaq`, `bmad-product-brief`,
   `bmad-create-epics-and-stories`, `bmad-create-architecture`,
   `bmad-sprint-planning`, `bmad-brainstorming`, `bmad-forge-idea`,
   `bmad-deep-recon`, `bmad-advanced-elicitation`, `bmad-party-mode`,
   `bmad-ux` to `~/.agents/skills-disabled/`. Saving: ~600–800
   tokens.
3. **Dedupe gsd-* skills between `~/.agents/skills/` and
   `~/.config/opencode/skills/`.** Delete one or the other; the opencode
   plugin (`gsd-core.js`) re-stages the canonical set on next run.
   Saving: ~3 300 tokens.
4. **Slim the gsd-core.js plugin.** Currently 32 KB; most of it is
   subprocess-reuse scaffolding. Replace with a minimal early-return
   if you don't need the GSD-side hooks. Saving: ~6 000 tokens.

Combined, those four steps would bring the opencode TUI down from
~31 400 tokens to ~13 000–15 000 tokens on turn 1, all without
losing any functionality this project actually uses.

---

## What we did NOT do (yet)

- **Mirror the `playwright-validate` hook into the other vendor dirs.**
  AGENTS.md mentions Stop hooks for the verify-ci gate in
  `.claude/settings.json`, `.codex/hooks.json`, and `.cursor/hooks.json`,
  but only impeccable's hook is wired today. Adding a parallel
  Playwright validation hook to each would require (a) a hook script
  per vendor format (`.cjs`, `.sh`, `.ps1`) and (b) updates to each
  `hooks.json` / `settings.json`. Bounded change, ~30 lines per
  vendor; can be a follow-up commit if needed.
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
for p in ['AGENTS.md', '.agents/rules/local-ci-verification.md',
          '.opencode/plugins/playwright-validate.ts']:
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
