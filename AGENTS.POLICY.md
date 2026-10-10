<!-- Last reviewed: 2026-10-10 against constitution v1.7.0. Project-owned
     sibling file, not a workflow block — does not carry an AGENTS-SPEC
     freshness stamp (those belong only on workflow blocks per
     AGENTS-SPEC.md §Freshness stamps). -->

# Hard Policy — ControlEasy Reborn

Mandatory rules an agent must not violate, beyond what the workflows enforce.
Lives outside `AGENTS.md` so the kernel stays small; the parent file points here
under `## Policy`.

## Mandatory Local CI Verification Gate

Two-tier cadence. **No task is "done" until both tiers pass on the final
state.**

1. **Per-Turn Fast Gate — `scripts/verify-ci-local.sh --fast`.** Runs format
   check (`dotnet format --verify-no-changes`), Release build, and
   unit/architecture tests. Zero Docker downloads, ~3 seconds. Enforced
   automatically on agent stop after any turn that modified a code file.
2. **Task Completion Full Gate — `scripts/verify-ci-local.sh`.** Runs the
   full 6-stage suite: format, build, unit & architecture tests,
   Testcontainers MySQL integration tests, Angular Docker production build,
   and OpenAPI client drift check. Runs **once per task completion, at the
   end of all tasks**, not after every turn. Docker-pulling stages
   (`Testcontainers MySQL`, Angular Docker web build) MUST NOT run inside
   Docker unless this is the final gate.

### Web SPA gate (Angular `npm test` + `npm run lint`)

`scripts/verify-ci-local.sh` does not exercise the Angular test suite or
ESLint — both run only inside the Gitea `lint` job, never in the local
gate. **The fast and full gates above are necessary but not sufficient
for changes under `src/Web/ControlEasyReborn.Web/`.**

Mandatory **Web SPA gate** on every change to `src/Web/ControlEasyReborn.Web/**`,
regardless of which agent environment is in use. No commit, push, or
"done" claim is valid until this gate is green on the final state.

**Canonical recipe — run in the exact same container the Gitea runner
uses, `docker.gitea.com/runner-images:ubuntu-latest` (no host-side
node/npm/Chrome dependency).** Bit-for-bit parity with the `lint` job;
this is the only recipe that has actually proven the fix on a real
runner image. From the repo root:

```bash
cat > /tmp/ci-lint.sh <<'SH'
#!/bin/sh
set -eu
cd /workspace/src/Web/ControlEasyReborn.Web
echo "===NPM_CI==="
npm ci --legacy-peer-deps 2>&1 | tail -5
echo "===LINT==="
npm run lint 2>&1 | tail -5
echo "===PLAYWRIGHT_INSTALL==="
npx playwright install --with-deps chromium 2>&1 | tail -5
echo "===SET_CHROME_BIN==="
export CHROME_BIN="$(node -e "console.log(require('@playwright/test').chromium.executablePath())")"
echo "CHROME_BIN=$CHROME_BIN"
echo "===TEST==="
npm test -- --no-watch --browsers=ChromeHeadlessNoSandbox 2>&1 | tee /tmp/karma.log | tail -3
echo "===KPI==="
grep -E "TOTAL:" /tmp/karma.log
SH

docker run --rm \
  -v "$PWD:/workspace" \
  -v /tmp/ci-lint.sh:/tmp/ci-lint.sh:ro \
  docker.gitea.com/runner-images:ubuntu-latest \
  bash /tmp/ci-lint.sh
```

Pass condition: `TOTAL: N SUCCESS` (no `FAILED`) for every grep match
in `/tmp/karma.log`, npm lint exits 0, npm ci exits 0, playwright
install exits 0.

**Fallback recipes** (use only when the canonical recipe cannot run on
the host — e.g. no Docker, sandboxed runner):

- **devcontainer / Linux host with `node:20`, `playwright`, Chrome on
  `PATH`**: invoke the four npm/npx commands directly from
  `src/Web/ControlEasyReborn.Web`, then `export CHROME_BIN=…` and run
  `npm test`.
- **Windows host with broken WSL, no Docker**: use
  `& "C:\Program Files\Git\bin\bash.exe" -c "…"` with
  `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'`, then run the four
  commands. PowerShell's `bash.exe` shim is the WSL launcher and will
  fail; Git-for-Windows's `bash.exe` is a real bash. Heads-up: the
  host-side Karma run is *not* bit-for-bit equivalent to the Gitea
  runner — `IntersectionObserver` intersection behavior can diverge
  between Linux and Windows Chromium, so a passing host run does not
  prove a passing CI run. Always run the canonical Docker recipe
  before pushing.

- **If the host cannot serve a headless browser at all** (e.g.
  sandboxed runner, no network for Playwright download, no Docker):
  the agent MUST say so explicitly, run the gate inside the
  devcontainer, and stop. Do not claim "done" with the gate
  unverified.

Rationale: the original CI failure on `lint` job task 546 (5 Karma test
failures) shipped because no agent run had exercised the Angular suite
locally before push. Closing this gap is the single highest-leverage
change to the agent workflow for this repo.

Claiming completion, checking off tasks, or pushing code without the full
local CI suite passing on the final state is a strict constitutional
violation. Stop hooks in `.agents/hooks.json`, `.agent/hooks.json`,
`.claude/settings.json`, `.codex/hooks.json`, `.cursor/hooks.json`, and
`.opencode/plugins/verify-ci.ts` enforce this.

## Platform-aware command execution (Constitution Principle VIII)

Detect the host OS and shell before issuing any terminal command. Do not
run platform-mismatched syntax.

- **POSIX-only snippets** (`#!/usr/bin/env bash`, `set -euo pipefail`,
  `[[ ... ]]`, `$(...)` chains inside single-quoted heredocs, `tr`/`awk`/
  `sed -i ''`, GNU-only flags) MUST NOT be invoked from a Windows host
  shell. Fix: run inside the devcontainer, use the cross-platform
  PowerShell wrappers (`scripts/worktree-up.ps1` / `scripts/worktree-down.ps1`),
  or translate the snippet and call out the translation in the reply.
- **PowerShell-only constructs** (`Get-ChildItem`, `Remove-Item -LiteralPath`,
  `New-Item -ItemType Directory`, `Test-Path -LiteralPath`, backtick
  escaping) MUST NOT be issued from a POSIX host.
- When a command fails because of a platform mismatch, identify the
  mismatch, retry through the correct shell, or escalate. Do **not** chain
  a second platform-specific command after the first fails.
- Prefer platform-neutral composition (`docker compose …`); it is valid on
  every host because Compose runs inside the container engine, not the
  host shell.

## Hard prohibitions (do not violate)

- **No EF Core.** DBTools (`Linq<TModel>`, `IAsyncSqlClient`) is the only
  data-access library. LINQ-first; raw SQL only for stored procs (ADR 0002).
- **No MediatR.** Handlers are registered as scoped services directly.
- **No MVC controllers.** Minimal API endpoint classes only.
- **All tenant-scoped reads/writes via `ITenantAwareLinqFactory`.** No
  cross-tenant data access.
- **Secrets never in `App.config`.** Use environment variables or Docker
  secrets.
- **Synthetic test data only.** Never copy document numbers, names, contact
  details, or any other data supplied by users into tests, snapshots,
  seeders, or example payloads; use clearly synthetic mock values instead.
- **BCrypt cost ≥ 11** for password hashing.
- **`ProblemDetails` (RFC 7807)** for all error responses. Domain
  exceptions: `NotFoundException`, `ValidationException`, `ConflictException`.
- **Serilog** structured logging to Console (JSON) + Seq.

## Workflow ownership (non-overlapping)

- **GSD** owns `.planning/` (phase state, atomic-commit ceremony).
- **spec-kit** owns `.specs/` and `.specify/` (per-feature specs;
  constitutional memory).
- **BMAD** is the review / analysis / adversarial-quality layer; owns
  `_bmad/` and `_bmad-output/`.

No workflow may write into another workflow's directory. See Constitution
Principle IX.
