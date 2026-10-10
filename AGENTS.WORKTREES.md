<!-- Last reviewed: 2026-10-10 against constitution v1.7.0. Project-owned
     sibling file, not a workflow block — does not carry an AGENTS-SPEC
     freshness stamp (those belong only on workflow blocks per
     AGENTS-SPEC.md §Freshness stamps). -->

# Git Worktree Rule — ControlEasy Reborn

Mandatory for every agent (AI or human). Lives outside `AGENTS.md` so the
kernel stays small; the parent file points here.

## The rule

- **The main tree stays pristine.** The main checkout (repo root on
  `main`) is read-only for agents until work is committed: no file edits,
  no generated artifacts, no build/test outputs, no formatting, no
  `.gitignore` churn, and no commits. Before starting any work, an agent
  MUST first create a worktree (see below) and do all reading, editing,
  building, and testing inside it. Read-only commands (`git status`,
  `git log`, `git diff`, grep/search) are the only operations permitted
  on the main checkout.
- **All Git work happens in a worktree.** Never commit, branch, push, or
  merge on `main`. The only permitted operation on `main` is
  fast-forwarding `main` to a feature branch's tip after a human has
  reviewed and approved the change. Create a dedicated Git worktree
  under `<repo-root>/.worktrees/` on a branch `feat/<slug>` or
  `fix/<slug>`, where `<slug>` is a semantic, lowercase, hyphen-separated
  name describing the change.
- **Worktrees live inside the repo, under `.worktrees/`.** Ensure
  `.worktrees/` is listed in `.gitignore` so worktree contents are never
  tracked. Canonical path: `<repo-root>/.worktrees/<branch-with-slashes-as-hyphens>`
  (e.g., `.worktrees/feat-dashboard-live-stats`).
- **The agent reports done; the human merges on `main`.** Commit, branch,
  and push inside the worktree, then stop. The agent MUST NOT run
  `git merge` on `main` for any reason, unless the human explicitly says,
  in the current turn, "merge on main.". If the human says it to merge on
  main, remove the worktree and its directory after the merge.
- **Pre-flight check before creating a worktree.** Use only read-only
  Git commands to confirm the branch does not already exist and the
  worktree path is not already in use. If either exists, abort and pick a
  different slug.
- **One task, one worktree, one branch.** Do not reuse a slug, a branch,
  or a worktree path between concurrent tasks.
- **Canonical command (Windows host — preferred).** Run the
  cross-platform PowerShell wrapper from the repo root:
  ```powershell
  scripts/worktree-up.ps1 -Branch feat/<slug>
  ```
  The wrapper performs the pre-flight check (branch does not exist,
  worktree path is free), creates the worktree under `.worktrees/`,
  and writes the per-worktree Compose override. It is the supported
  translation for Windows hosts.

- **Canonical command (POSIX host — reference only).** If running on a
  POSIX host (macOS, Linux, devcontainer), the equivalent shell form
  is:
  ```bash
  git worktree add ".worktrees/$(echo $BRANCH | tr / -)" -b "$BRANCH"
  ```
  Do not invoke this snippet from a Windows host shell — see
  `AGENTS.POLICY.md` §Platform-aware command execution.
- **Clean up after merge.** After a change merges to `main` and is
  verified, remove only the worktree you created:
  `git worktree remove .worktrees/<branch-with-slashes-as-hyphens>`. Do
  not touch unrelated worktrees, branches, or paths.
- **No force-push, no rewriting shared history.** Do not rewrite commits
  that have been pushed or that other worktrees share. Local-only history
  rewrites (interactive rebase before push) are allowed when no one else
  depends on the branch.

## Worktree naming convention

| Item           | Pattern                                          | Example                              |
|----------------|--------------------------------------------------|--------------------------------------|
| Branch         | `feat/<spec-id>-<slug>` or `fix/<spec-id>-<slug>` | `feat/dashboard-live-stats`         |
| Worktree path  | `.worktrees/<branch-with-slashes-as-hyphens>`     | `.worktrees/feat-dashboard-live-stats` |
| Compose project| `ce-<branch-hyphens>`                            | `ce-feat-dashboard-live-stats`       |
| Traefik host   | `ce-<branch>.localhost`                          | `ce-feat-dashboard-live-stats.localhost` |
| Host port      | `18080 + (worktree-index × 10)`                  | `18090`                              |
| DB volume      | `ce-<branch>-mysql-data`                         | `ce-feat-dashboard-live-stats-mysql-data` |

Scripts: `scripts/worktree-up.ps1` / `.sh` (create),
`scripts/worktree-down.ps1` / `.sh` (tear down).

## Pre-flight command (recommended)

The pre-flight is built into `scripts/worktree-up.ps1`; invoking it
performs both checks (branch absent, worktree path free) before
creating the worktree. On a POSIX host, the equivalent shell form is
shown here **for reference only** — do not invoke it from a Windows
host shell.

```bash
# POSIX reference only.
git show-ref --verify --quiet "refs/heads/$BRANCH" && {
  echo "branch $BRANCH already exists"; exit 1; }
test -e ".worktrees/$(echo $BRANCH | tr / -)" && {
  echo "worktree path in use"; exit 1; }
git worktree add ".worktrees/$(echo $BRANCH | tr / -)" -b "$BRANCH"
```
