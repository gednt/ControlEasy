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
