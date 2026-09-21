# Requirements — Dev Containers & Worktrees

> Spec folder: `.specs/devcontainers/`
> Goal: Provide a **single, uniform local development shell** (devcontainer)
> and a **per-feature-branch worktree convention** so that every contributor
> — on every OS — boots the same way, runs the same verification gate, and
> can hold multiple in-flight branches in parallel without colliding on
> ports, hostnames, or databases.
>
> This spec is **additive** to the existing modernized stack. It does not
> change the runtime target (Docker Compose is still the runtime, per
> Constitution v1.3.0 Principle V "Dev shell" sub-bullet). It changes only
> the **dev shell**.

## User Stories

### Reproducible shell

- **UC-D1:** As a *new contributor on Windows / macOS / Linux*, I want a
  single command (or a single "Reopen in Container" click in my IDE) that
  brings up a development shell with the right .NET 8 SDK, Node 20, the
  Angular CLI, Playwright browsers, the MySQL client, and the repo's
  pre-commit hooks, so I never have to read a 200-line `development-guide.md`
  to figure out which Node version is pinned.
- **UC-D2:** As a *devcontainer user*, I want the dev shell to invoke the
  **same** Docker Compose stack the host would invoke (Docker-out-of-Docker),
  so the verification gate ("rebuild and restart the stack, then test")
  produces the same artifacts in devcontainer mode as on the host. I do
  NOT want a separate, nested Docker engine that drifts from the host.

### Parallel branches

- **UC-D3:** As a *contributor with two feature branches in flight*, I
  want each branch to live in its own git worktree with its **own**
  Compose project (own images, own DB volumes, own Traefik hostname, own
  published port), so a `dotnet ef migrations add` in branch A cannot
  break branch B's database, and a hot-reload in branch A cannot block
  a `docker compose logs` in branch B.
- **UC-D4:** As a *code reviewer*, I want to be able to spin up a
  reviewer's worktree from a pull request's branch URL in one command
  (or in a GitHub Codespace, which reuses the same devcontainer
  definition), so I can verify the PR's verification gate end-to-end
  without re-cloning.

### Photographic / hardware integration (fallback)

- **UC-D5:** As a *developer working on
  `.specs/3 - photo-capture-hardware-integration/`*, I want a clear
  documented fallback to the **host shell** for the specific subset of
  tasks that need USB / camera passthrough (which devcontainers do not
  support portably), so the devcontainer does not block that one spec.

---

## Capabilities (FR-1..FR-7)

> Cross-referenced from the BMAD PRD
> (`_bmad-output/planning-artifacts/prds/prd-ControlEasy-2026-07-12/prd.md`,
> reviewed 2026-07-12). Editorial and structural review corrections
> (see `.specs/devcontainers/review-prose.md` and `review-structure.md`
> adjacent to the PRD) are applied here.

### FR-1 — Canonical devcontainer shell

The repository ships a single `.devcontainer/devcontainer.json` plus
`.devcontainer/Dockerfile` that every IDE (VS Code, Cursor, JetBrains,
GitHub Codespaces) can open.

- **FR-1.1:** The image is based on
  `mcr.microsoft.com/devcontainers/base:debian-12`.
- **FR-1.2:** The image contains .NET 8 SDK, Node.js 20, Angular CLI,
  MySQL client, Playwright browsers, Docker CLI + Compose plugin,
  shellcheck, hadolint.
- **FR-1.3:** The devcontainer mounts the host's Docker socket
  (`/var/run/docker.sock`) and sets `DEVCONTAINER=true`.
- **FR-1.4:** `postCreateCommand` is a no-op by default. When
  `AUTO_START_COMPOSE=true`, it runs
  `docker compose -f docker/docker-compose.yml up -d --build`.
- **FR-1.5:** `dotnet --version`, `node --version`, and
  `docker compose version` return the expected major versions inside
  the container.

### FR-2 — Per-feature-branch worktree convention

Every feature branch lives in its own git worktree with deterministic
isolation.

- **FR-2.1:** `scripts/worktree-up.sh` (and the Windows PowerShell
  wrapper `scripts/worktree-up.ps1`) creates the worktree, generates
  the per-worktree environment file and Compose override, registers
  the hostname, and brings the stack up.
- **FR-2.2:** `scripts/worktree-down.sh` (and `scripts/worktree-down.ps1`)
  tears down the worktree's Compose project (containers, networks, and
  volumes), removes the hostname entry, and removes the worktree
  directory.
- **FR-2.3:** Both scripts source `scripts/lib/worktree.sh`
  (`scripts/lib/worktree.psm1` on Windows) for branch detection,
  project-name conversion, port allocation, and hostname derivation.
- **FR-2.4:** Both scripts are idempotent: re-running `worktree-up.sh`
  on an existing worktree is a no-op that prints "already up";
  re-running `worktree-down.sh` on a removed worktree exits 0 with
  "already down".
- **FR-2.5:** The bash scripts are canonical (Linux / macOS / devcontainer
  / Git Bash on Windows); the `.ps1` wrappers are first-class on plain
  Windows PowerShell. Both produce the same Compose project, hostname,
  port, and volume for the same branch.

### FR-3 — Per-worktree Compose override

The generated `docker/docker-compose.worktree.<id>.yml` is produced
from a checked-in template and is `.gitignore`d.

- **FR-3.1:** The override references the worktree's
  `COMPOSE_PROJECT_NAME` everywhere (labels, networks, volumes).
- **FR-3.2:** The Traefik router rule uses the worktree hostname
  `ce-<id>.localhost`.
- **FR-3.3:** The MySQL volume name is `ce-<id>-mysql-data`, distinct
  from every other worktree and from the main checkout.
- **FR-3.4:** `docker compose -p ce-<id> -f docker/docker-compose.yml
  -f docker/docker-compose.worktree.<id>.yml config` exits 0 with a
  valid merged config.

### FR-4 — Cross-OS host resolver shim

The worktree hostname resolves to `127.0.0.1` on Linux, macOS, and
Windows.

- **FR-4.1:** Linux uses `nss-myhostname` and `/etc/hosts` as the
  default.
- **FR-4.2:** macOS uses `dscacheutil` plus a loopback alias on `lo0`.
- **FR-4.3:** Windows uses `Add-DnsClientNrptRule` via PowerShell, with
  a fallback to `%USERPROFILE%/.control-easy/hosts` when admin rights
  are unavailable.
- **FR-4.4:** After `worktree-down.sh`, the hostname query returns
  NXDOMAIN or "not found".

### FR-5 — Pre-commit hooks and lint wiring

Code quality checks are automated for the new shell scripts and
Dockerfile.

- **FR-5.1:** `.pre-commit-config.yaml` pins shellcheck, hadolint,
  gitleaks, `dotnet format --verify-no-changes`, and ESLint.
- **FR-5.2:** Fast checks run on `pre-commit`; heavier checks (hadolint,
  gitleaks full scan) run on `pre-push`.
- **FR-5.3:** A `.github/workflows/lint.yml` skeleton is added as the
  seed for the future CI-01 GitHub Actions work.

### FR-6 — Verification-gate end-to-end test

A single script proves the devcontainer + worktree loop is healthy.

- **FR-6.1:** `scripts/verify-devcontainer.sh` pre-warms only missing
  base images, builds the stack, brings it up with `--force-recreate`,
  waits for `/health` to return 200, runs
  `dotnet test src/ControlEasyReborn.sln`, runs the demo overlay path,
  and tears down.
- **FR-6.2:** In a clean devcontainer with cached base images, the
  script exits 0 in under 5 minutes.
- **FR-6.3:** On any test failure, the script exits non-zero and leaves
  the stack up for inspection.

### FR-7 — Documentation updates

The canonical runtime and development docs are updated to reflect the
new shell.

- **FR-7.1:** `AGENTS.md` is rewritten so that Option D (devcontainer)
  is the canonical development mode, worktree conventions are
  documented, and retired modes A/B/C are clearly marked as retired.
- **FR-7.2:** Legacy `docs/` files receive non-destructive one-line
  redirect notes pointing to their new canonical homes.

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| **NFR-1** | The devcontainer image build must be layer-cached and rebuild quickly when only the repo changes, not when base images change. |
| **NFR-2** | All shell scripts added by this PRD must pass `shellcheck` with no warnings. |
| **NFR-3** | All Dockerfiles added by this PRD must pass `hadolint`. |
| **NFR-4** | The worktree scripts must never operate on the main checkout's Compose project unless explicitly invoked from the main checkout itself. |
| **NFR-5** | Per-worktree port allocation must detect collisions and abort bring-up with a clear message. |
| **NFR-6** | USB / camera passthrough is explicitly out of scope for the devcontainer; `.specs/3 - photo-capture-hardware-integration/` keeps its documented host-shell fallback. |

## Success Metrics

| Metric | Target | Counter-Metric |
|---|---|---|
| New-dev time from clone to green verification gate | ≤ 15 minutes | Time spent debugging OS-specific tooling before first `docker compose up`. |
| Branch collision incidents (same port / same volume) | 0 after adoption | Number of times a developer had to stop another branch's stack to test the current one. |
| Verification gate pass rate on first run | ≥ 90% | Pass rate when the gate is run ad-hoc without the devcontainer. |
| Worktree bring-up time with cached base images | ≤ 5 minutes | Time lost re-pulling images that are already present locally. |

## Out of Scope (for this spec)

- Replacing the Docker Compose runtime. (Constitution v1.3.0 Principle V
  forbids it; the devcontainer is a shell, not a runtime.)
- Adopting OpenSpec change-tracking. ~~(`openspec/` is opt-in per
  Constitution v1.3.0 Principle VI; the trigger for adoption is
  recorded as `TODO(CONSTITUTION_VI_OPENSPEC_ADOPTION_DATE)`.)~~
  RESOLVED 2026-09-21: OpenSpec was removed from the project at
  constitution v1.7.0; no adoption decision is pending.
- Continuous integration on a hosted runner. (`.planning/PROJECT.md`
  continuous task **CI-01** — GitHub Actions — is still "Active" and
  is out of scope for this spec; the devcontainer is local-only. Task
  9.4.3 adds a `lint.yml` *skeleton* as a seed but does not stand up
  CI.)
- Replacing `.planning/`, `.specs/`, or `.specify/` with
  a single tool. (Constitution v1.7.0 Principle VI fixes the split.)
- Retiring the legacy `docs/` generation pipeline. Task 9.8 adds
  one-line redirect notes; full deletion is gated for the next
  `/gsd-complete-milestone` boundary per the Constitution's
  "Documentation Systems and Source of Truth" retirement schedule.
- Renaming `docker-compose.yml` / `docker-compose.demo.yml` to
  `compose.yaml` / `compose.demo.yaml`. (Cosmetic; the Compose v2
  CLI accepts both, the existing names are stable, and the rename
  would invalidate dozens of references in this spec and elsewhere.)
- Docker-in-Docker (DinD). Rejected per the design decision matrix
  in `design.md` § "Decision: DooD vs DinD".
- A "no Docker in the devcontainer" mode. Rejected as the default
  per the same design decision; remains an opt-in
  `scripts/worktree-verify-from-host.sh` for CI parity (future work,
  not in this spec).
