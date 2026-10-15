---
description: "Hard policy for ControlEasy Reborn: two-tier local CI gate, Web SPA gate for src/Web/ControlEasyReborn.Web/**, platform-aware command execution, hard prohibitions, workflow ownership. Load before any non-trivial change."
allowed-tools: [Read, Grep, Glob, Bash(docker compose *), Bash(docker run *), Bash(git status *), Bash(git log *), Bash(git diff *), Bash(make *), Bash(scripts/verify-ci-local*), Bash(scripts/worktree-up*), Bash(scripts/worktree-down*), Bash(npm ci --legacy-peer-deps), Bash(npm run lint), Bash(npm test *), Bash(npx playwright install *)]
mode: primary
---

<!-- Last reviewed: 2026-10-10 against constitution v1.7.0. Project-owned sibling file. -->

# Hard Policy — ControlEasy Reborn

Mandatory rules an agent must not violate. Pointed to from `AGENTS.md` §Policy.

## Mandatory Local CI Verification Gate

Two-tier cadence. **No task is "done" until both tiers pass on the final state.**

1. **Per-Turn Fast Gate — `scripts/verify-ci-local.sh --fast`.** Format check (`dotnet format --verify-no-changes`), Release build, unit + architecture tests. No Docker downloads, ~3 s. Runs on agent stop after any turn that modified a code file.
2. **Task Completion Full Gate — `scripts/verify-ci-local.sh`.** Full 6-stage suite: format, build, unit + architecture tests, Testcontainers MySQL integration tests, Angular Docker production build, OpenAPI client drift check. Runs once at task completion, not per turn. Docker-pulling stages (`Testcontainers MySQL`, Angular Docker web build) MUST NOT run inside Docker except for this final gate.

### Documentation-only exception

A change is **documentation-only** when *every* modified file is one of:

- `**/*.md`, `**/*.mdx`, `**/*.txt`, `**/*.adoc`, `**/*.rst`
- `docs/**`
- `mockup/**` (UI mockups are documentation)
- `AGENTS*.md`, `SUBAGENTS.md` (policy / sub-agent files)

For documentation-only changes the Fast Gate and Full Gate are **skipped**. They produce no binary artifacts, so format checks, builds, and tests are N/A. The change still must obey:

- **Markdown lint** if a project-wide linter is configured (e.g., `markdownlint-cli2` via `npm run lint:md`, `mdl`, etc.). Skip lint silently if no linter is configured — do **not** install one on the host.
- **Cross-reference / link check** if a project-wide link checker is configured (e.g., `lychee`). Skip silently if none.
- The **no work on `main`** and **no host-side tool installation** prohibitions still apply.

## Web SPA gate (Angular `npm test` + `npm run lint`)

`scripts/verify-ci-local.sh` does not exercise Angular tests or ESLint — both run only inside the Gitea `lint` job. The fast and full gates above are necessary but **not sufficient** for changes under `src/Web/ControlEasyReborn.Web/`.

**Mandatory on every change to `src/Web/ControlEasyReborn.Web/**`, regardless of agent environment.** No commit, push, or "done" claim is valid until this gate is green on the final state.

**Canonical recipe — bit-for-bit parity with the Gitea `lint` job. Run from the repo root:**

```bash
cat > /tmp/ci-lint.sh <<'SH'
#!/bin/sh
set -eu
cd /workspace/src/Web/ControlEasyReborn.Web
npm ci --legacy-peer-deps 2>&1 | tail -5
npm run lint 2>&1 | tail -5
npx playwright install --with-deps chromium 2>&1 | tail -5
export CHROME_BIN="$(node -e "console.log(require('@playwright/test').chromium.executablePath())")"
npm test -- --no-watch --browsers=ChromeHeadlessNoSandbox 2>&1 | tee /tmp/karma.log | tail -3
grep -E "TOTAL:" /tmp/karma.log
SH

docker run --rm \
  -v "$PWD:/workspace" \
  -v /tmp/ci-lint.sh:/tmp/ci-lint.sh:ro \
  docker.gitea.com/runner-images:ubuntu-latest \
  bash /tmp/ci-lint.sh
```

**Pass condition:** `npm ci`, `npm run lint`, `npx playwright install` exit 0; every `TOTAL: "N SUCCESS"` line in `/tmp/karma.log` (no `FAILED`).

**Fallbacks (use only when the canonical recipe cannot run):**

- *devcontainer / Linux with `node:20` + Playwright + Chrome on `PATH`:* run the four npm/npx commands directly from `src/Web/ControlEasyReborn.Web`, then `export CHROME_BIN=…` and `npm test`.
- *Windows host with broken WSL, no Docker:* invoke via `& "C:\Program Files\Git\bin\bash.exe" -c "…"` (Git-for-Windows bash, not the PowerShell bash shim). Heads-up: a host-side Karma run is not bit-for-bit equivalent to the Gitea runner; always run the canonical Docker recipe before pushing.
- *Host cannot serve a headless browser at all:* run the gate inside the devcontainer and stop. Do not claim "done" with the gate unverified.

**Windows-host recipe (verified 2026-10-12, `feat/device-simulator-ui`):** Windows bind-mounts do not propagate `node_modules/.bin/` symlinks into Linux containers, and `cp -r` of an already-populated `node_modules/` against a concurrent `npm ci` races and fails. The host-script below copies the Web folder **excluding** `node_modules` into the container's native filesystem, runs `npm ci` there, and then runs the same lint + Playwright + Karma steps as the canonical recipe. Pass condition is identical: `npm run lint` exits 0 and `TOTAL: N SUCCESS` with no `FAILED`.

```bash
# C:/Users/<you>/AppData/Local/Temp/opencode/ci-lint-windows.sh
#!/bin/sh
set -eu
SRC_DIR=/workspace/src/Web/ControlEasyReborn.Web
WORK_DIR=/tmp/spa-gate
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/repo"
# Copy everything except node_modules / .angular / test-results.
copy_tree() {
  cd "$SRC_DIR"
  for entry in $(ls -A); do
    case "$entry" in
      node_modules|.angular|test-results|.git) continue;;
    esac
    cp -r "$entry" "$WORK_DIR/repo/"
  done
}
copy_tree
cd "$WORK_DIR/repo"
npm ci --legacy-peer-deps 2>&1 | tail -10
npm run lint 2>&1 | tail -30
npx playwright install --with-deps chromium 2>&1 | tail -10
export CHROME_BIN="$(node -e "console.log(require('@playwright/test').chromium.executablePath())")"
npm test -- --no-watch --browsers=ChromeHeadlessNoSandbox 2>&1 | tee /tmp/karma.log
grep -E "TOTAL:" /tmp/karma.log || echo "TOTAL NOT FOUND"
```

Run from the worktree root (PowerShell, Git-Bash mounted with `MSYS_NO_PATHCONV=1` to avoid path mangling):

```powershell
cmd /c '"C:\Program Files\Git\bin\bash.exe" -c "MSYS_NO_PATHCONV=1 docker run --rm -v \"$PWD:/workspace\" -v \"C:/Users/<you>/AppData/Local/Temp/opencode/ci-lint-windows.sh:/tmp/ci-lint.sh:ro\" docker.gitea.com/runner-images:ubuntu-latest bash /tmp/ci-lint.sh"'
```

Always wait for the container to finish before reading the result; do not poll. The full log lands at `/tmp/karma.log` inside the container.

Stop hooks in `.agents/hooks.json` and `.agent/hooks.json` (backed by `scripts/hooks/verify-ci-agent-stop.sh` / `.ps1` / `.cjs`) enforce this.

## Platform-aware command execution (Constitution Principle VIII)

Detect host OS + shell before issuing terminal commands. No platform-mismatched syntax.

- **POSIX-only snippets** (`#!/usr/bin/env bash`, `set -euo pipefail`, `[[ … ]]`, `$(…)` in single-quoted heredocs, `tr`/`awk`/`sed -i ''`, GNU-only flags) MUST NOT be invoked from a Windows host shell. Fix: run inside the devcontainer, use the cross-platform PowerShell wrappers (`scripts/worktree-up.ps1` / `scripts/worktree-down.ps1`), or translate and call out the translation.
- **PowerShell-only constructs** (`Get-ChildItem`, `Remove-Item -LiteralPath`, `New-Item -ItemType Directory`, `Test-Path -LiteralPath`, backtick escaping) MUST NOT be issued from a POSIX host.
- On platform-mismatch failure: identify the mismatch, retry through the correct shell, or escalate. Do **not** chain a second platform-specific command.
- Prefer platform-neutral composition (`docker compose …`); valid on every host.

## Hard prohibitions

- **No work on `main`.** All Git work (commit, branch, push, merge, edit, build, test) happens inside a worktree under `.worktrees/`. The main checkout is read-only except for fast-forward merges explicitly authorized by a human. Full ceremony: `AGENTS.WORKTREES.md`.
- **No host-side tool installation.** Do not install tools on the host machine (`apt`, `brew`, `choco`, `winget`, `npm install -g`, `dotnet tool install -g`, `pip`, etc.). All tooling runs inside containers. If a required tool is missing and Docker is not running, surface the missing dependency to the user and stop. Do not start Docker on the user's behalf.
- **Atomic commits.** One commit = one logical change. Each commit's tree must build cleanly (Fast Gate green), tests pass, and contain no unrelated file modifications, debug code, or commented-out blocks. Atomic commits land on the worktree branch (`feat/<slug>` / `fix/<slug>`); main is updated only by a human-authorized fast-forward. Commit messages MUST follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `perf:`, `style:`, `revert:`). Subject ≤ 72 chars, imperative mood, no trailing period. Body explains *why*, not *what*; references the spec or issue. No commitlint runner is mandated — if a project-wide linter is configured, run it; otherwise the agent self-reviews.
- **Push after every commit.** Every atomic commit MUST be pushed to `origin` immediately (see `AGENTS.WORKTREES.md` §Push after every commit). No work stays local-only across commits. On push failure: keep the commit local, surface the error + SHA to the user, do **not** mark the task done. The agent never retries a failed push, never falls back to another remote, never force-pushes.
- **No EF Core.** DBTools (LINQ over `IAsyncSqlClient`, obtained via `ITenantAwareLinqFactory`) is the only data-access library. LINQ-first; raw SQL only for stored procs (Constitution Principle III).
- **No MediatR.** Handlers registered as scoped services directly.
- **No MVC controllers.** Minimal API endpoint classes only.
- **No cross-tenant access.** All tenant-scoped reads/writes go through `ITenantAwareLinqFactory`; no query reaches the DB without it.
- **Secrets never in `App.config`.** Environment variables or Docker secrets only.
- **Synthetic test data only.** Never copy document numbers, names, contact details, or any user-supplied data into tests, snapshots, seeders, or example payloads.
- **BCrypt cost ≥ 11** for password hashing.
- **`ProblemDetails` (RFC 7807)** for all error responses. Domain exceptions: `NotFoundException`, `ValidationException`, `ConflictException`.
- **Serilog** structured logging to Console + Seq.

## Workflow ownership (non-overlapping)

- **GSD** owns `.planning/` (phase state, atomic-commit ceremony).
- **spec-kit** owns `.specs/` and `.specify/` (per-feature specs; constitutional memory).
- **BMAD** is the review / analysis / adversarial-quality layer; owns `_bmad/` and `_bmad-output/`.

No workflow may write into another workflow's directory. See Constitution Principle IX.