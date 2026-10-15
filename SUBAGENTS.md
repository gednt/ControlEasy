---
description: "Sub-agent entry point for ControlEasy Reborn. Sub-agents have unrestricted tool access. Inherit all governance from the linked sibling files — do not duplicate or relax them."
allowed-tools: [all]
mode: primary
---

# SUBAGENTS.md — Sub-agent entry point

You are a sub-agent for ControlEasy Reborn. You have full tool access. The parent agent dispatches you with a focused task; you execute and return.

**Before acting, read and obey the linked governance files.** Do not relax any rule, even if the task seems trivial.

- [`AGENTS.md`](AGENTS.md) — project orientation, build/test commands, skill-overlay index.
- [`AGENTS.POLICY.md`](AGENTS.POLICY.md) — hard policy: local CI gate, Web SPA gate, platform-aware exec, prohibitions, **no work on `main`**.
- [`AGENTS.WORKTREES.md`](AGENTS.WORKTREES.md) — mandatory Git worktree rule and naming convention.
- [`AGENTS.STACK.md`](AGENTS.STACK.md) — stack, C# / Angular conventions, concurrency budget.

## Operating rules

1. **No work on `main`.** All commits, branches, pushes, builds, and tests run inside a worktree under `.worktrees/` on a `feat/<slug>` or `fix/<slug>` branch. Create the worktree via `scripts/worktree-up.ps1 -Branch feat/<slug>` (Windows) or the POSIX equivalent (see `AGENTS.WORKTREES.md`).
2. **No host-side tool installation.** Do not install tools on the host (`apt`, `brew`, `choco`, `winget`, `npm install -g`, `dotnet tool install -g`, `pip`, etc.). All tooling runs inside containers. If a required tool is missing and Docker is not running, surface the missing dependency to the user and stop. Do not start Docker on the user's behalf.
3. **Local CI gate is mandatory for code changes.** Per-turn fast gate after any code change (`scripts/verify-ci-local.sh --fast`); full gate at task completion (`scripts/verify-ci-local.sh`). For `src/Web/ControlEasyReborn.Web/**` changes, also run the Web SPA gate recipe in `AGENTS.POLICY.md` §Web SPA gate. **Skip both gates for documentation-only changes** — see `AGENTS.POLICY.md` §Documentation-only exception for the allowlist.
4. **Honour hard prohibitions.** No EF Core, no MediatR, no MVC controllers, no cross-tenant access (always use `ITenantAwareLinqFactory`), no real-user data in tests, BCrypt ≥ 11, ProblemDetails + Serilog.
5. **Sub-agent concurrency budget.** Max 3 sub-agents in flight per level (1 main + 3 subs). Exceeding requires explicit rationale.
6. **Pre-commit adversarial review.** No `git commit` until (1) the full local CI gate is green and (2) adversarial review returns zero CRITICAL/HIGH findings. **Cross-CLI protocol:** the reviewer must be an AI other than the authoring one. Running in OpenCode → dispatch via Codex CLI (`codex exec`); running in Codex → dispatch via OpenCode CLI (`opencode run`); other harnesses → any available sibling CLI. Last resort: an in-harness subagent on a model family different from the authoring model's, with the degradation noted in the review output.
7. **Stop and report.** Commit, push inside the worktree, then return. Do not merge on `main`; the human merges. Every commit is pushed to `origin` immediately — see `AGENTS.WORKTREES.md` §Push after every commit.

You have full tool access — use it. The constraints above are non-negotiable.