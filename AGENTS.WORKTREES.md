---
description: "Mandatory Git worktree rule for ControlEasy Reborn: all Git work happens in a worktree under .worktrees/, never commit/branch/push/merge on main; canonical PowerShell wrapper and naming convention. Load before any commit, branch, or merge."
allowed-tools: [Read, Grep, Glob, Bash(git status *), Bash(git log *), Bash(git diff *), Bash(git worktree *), Bash(git show-ref *), Bash(scripts/worktree-up*), Bash(scripts/worktree-down*)]
mode: primary
---

<!-- Last reviewed: 2026-10-10 against constitution v1.7.0. Project-owned sibling file. -->

# Git Worktree Rule — ControlEasy Reborn

Mandatory for every agent (AI or human).

## The rule

- **The main tree stays pristine.** The main checkout on `main` is read-only for agents until work is committed: no edits, no generated artifacts, no build/test outputs, no formatting, no `.gitignore` churn, no commits. Read-only commands (`git status`, `git log`, `git diff`, grep/search) are the only operations permitted on the main checkout. Before starting work, create a worktree (below) and do all reading, editing, building, testing inside it.
- **All Git work happens in a worktree.** Never commit, branch, push, or merge on `main`. The only permitted operation on `main` is fast-forwarding it to a feature branch's tip after a human has reviewed and approved the change. Create a worktree under `<repo-root>/.worktrees/` on a branch `feat/<slug>` or `fix/<slug>`, where `<slug>` is a semantic, lowercase, hyphen-separated name.
- **Worktrees live under `.worktrees/`.** Ensure `.worktrees/` is in `.gitignore` so worktree contents are never tracked. Canonical path: `<repo-root>/.worktrees/<branch-with-slashes-as-hyphens>` (e.g., `.worktrees/feat-dashboard-live-stats`).
- **The agent reports done; the human merges on `main`.** Commit, branch, and push inside the worktree, then stop. The agent MUST NOT run `git merge` on `main` unless the human explicitly says, in the current turn, "merge on main." After a merge, remove the worktree and its directory.
- **One task, one worktree, one branch.** Do not reuse a slug, branch, or worktree path between concurrent tasks.
- **Atomic commits land on the worktree branch only.** See `AGENTS.POLICY.md` §Atomic commits for the rule (one logical change per commit, each commit must build green, Conventional Commits message format).
- **Push after every commit.** After each atomic commit, run `git push -u origin <branch>` (first push) or `git push` (subsequent). On push failure (no network, no auth, branch protection, missing remote): keep the commit local, surface the error and the SHA to the user, do **not** mark the task done. The agent never retries a failed push, never falls back to another remote, never force-pushes.
- **Clean up after merge.** `git worktree remove .worktrees/<branch-with-slashes-as-hyphens>`. Do not touch unrelated worktrees, branches, or paths.
- **No force-push, no rewriting shared history.** Do not rewrite commits that have been pushed or that other worktrees share. Local-only history rewrites (interactive rebase before push) are allowed when no one else depends on the branch.

## Canonical command — Windows host

Run from the repo root:

```powershell
scripts/worktree-up.ps1 -Branch feat/<slug>
```

The wrapper performs the pre-flight check (branch absent, worktree path free), creates the worktree under `.worktrees/`, and writes the per-worktree Compose override.

**POSIX host:** equivalent is `git worktree add ".worktrees/$(echo $BRANCH | tr / -)" -b "$BRANCH"` — reference only; do not invoke from a Windows host shell (see `AGENTS.POLICY.md` §Platform-aware command execution).

## Worktree naming convention

| Item           | Pattern                                            | Example                              |
|----------------|----------------------------------------------------|--------------------------------------|
| Branch         | `feat/<slug>` or `fix/<slug>`                      | `feat/dashboard-live-stats`          |
| Worktree path  | `.worktrees/<branch-with-slashes-as-hyphens>`      | `.worktrees/feat-dashboard-live-stats`|
| Compose project| `ce-<branch-hyphens>`                              | `ce-feat-dashboard-live-stats`       |
| Traefik host   | `ce-<branch>.localhost`                            | `ce-feat-dashboard-live-stats.localhost`|
| Host port      | `18080 + (worktree-index × 10)`                    | `18090`                              |
| DB volume      | `ce-<branch>-mysql-data`                           | `ce-feat-dashboard-live-stats-mysql-data`|

Scripts: `scripts/worktree-up.ps1` / `.sh` (create), `scripts/worktree-down.ps1` / `.sh` (tear down). The PowerShell wrappers perform the pre-flight check; the shell forms are reference only.