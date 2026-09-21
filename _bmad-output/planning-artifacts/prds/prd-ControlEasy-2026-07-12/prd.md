---
title: ControlEasy Reborn — Dev Containers & Worktrees PRD
status: final
created: 2026-07-12
updated: 2026-07-12
---

# ControlEasy Reborn — Dev Containers & Worktrees

> Internal PRD for the developer-experience layer of ControlEasy Reborn.
> Scope: a single, uniform devcontainer shell and a per-feature-branch worktree convention.
> The runtime target (Docker Compose) is unchanged.

## 1. Context & Objective

### 1.1 Problem

The ControlEasy Reborn codebase is a modular ASP.NET Core 8 + Angular 18 + MySQL 8 stack that runs inside a Docker Compose environment. Currently every contributor brings up the stack differently depending on the host OS and personal tooling:

- New developers read a long `development-guide.md` and manually install .NET 8, Node 20, Angular CLI, Playwright, and the MySQL client, often ending up with version drift.
- Multiple in-flight branches compete for the same Traefik port (`:8080`) and the same `mysql-data` volume, so a schema experiment in branch A breaks branch B.
- The post-task verification gate (`build api web`, `up -d --force-recreate`, `dotnet test`) is run inconsistently across the team, making "works on my machine" regressions common.

### 1.2 Objective

Provide a **canonical local development shell** (devcontainer) and a **per-feature-branch worktree convention** so that every contributor — on Windows, macOS, or Linux — starts the stack the same way, runs the same verification gate, and can hold several branches in parallel without port, hostname, or database collisions.

### 1.3 Out of scope

- Docker Compose remains the runtime target (Constitution v1.3.0, Principle V).
- The host's Docker engine remains the engine; the devcontainer only provides a uniform shell.
- CI implementation and legacy `docs/` retirement are tracked separately. (OpenSpec adoption was later removed from the project at constitution v1.7.0.)

## 2. Guiding Principles

| Principle | Implication |
|---|---|
| Runtime target first | Any verification command run inside the devcontainer must produce the same result as the same command run on the host shell. |
| Docker-out-of-Docker (DooD) | The devcontainer mounts `/var/run/docker.sock` and invokes the host's Docker engine. Docker-in-Docker is rejected because it creates a second engine that can drift. |
| Per-branch isolation | Every git worktree gets its own Compose project, Traefik hostname, published port, and MySQL volume. |
| Opt-in automation | `AUTO_START_COMPOSE=true` can bring the stack up automatically, but the default is manual bring-up so the verification gate stays explicit. |

## 3. Capabilities

### FR-1 — Canonical devcontainer shell

The repository ships a single `.devcontainer/devcontainer.json` plus `.devcontainer/Dockerfile` that every IDE (VS Code, Cursor, JetBrains, GitHub Codespaces) can open.

- FR-1.1: The image is based on `mcr.microsoft.com/devcontainers/base:debian-12`.
- FR-1.2: The image contains .NET 8 SDK, Node.js 20, Angular CLI, MySQL client, Playwright browsers, Docker CLI + Compose plugin, shellcheck, and hadolint.
- FR-1.3: The devcontainer mounts the host's Docker socket (`/var/run/docker.sock`) and sets `DEVCONTAINER=true`.
- FR-1.4: `postCreateCommand` is a no-op by default. When `AUTO_START_COMPOSE=true`, it runs `docker compose -f docker/docker-compose.yml up -d --build`.
- FR-1.5: `dotnet --version`, `node --version`, and `docker compose version` return the expected major versions inside the container.

### FR-2 — Per-feature-branch worktree convention

Every feature branch lives in its own git worktree with deterministic isolation.

- FR-2.1: `scripts/worktree-up.sh` creates the worktree, generates the per-worktree environment file and Compose override, registers the hostname, and brings the stack up.
- FR-2.2: `scripts/worktree-down.sh` tears down the worktree's Compose project (containers, networks, and volume), removes the hostname entry, and removes the worktree directory.
- FR-2.3: Both scripts source `scripts/lib/worktree.sh` for branch detection, project-name conversion, port allocation, and hostname derivation.
- FR-2.4: Both scripts are idempotent: re-running `worktree-up.sh` on an existing worktree is a no-op that prints "already up"; re-running `worktree-down.sh` on a removed worktree exits 0 with "already down".

### FR-3 — Per-worktree Compose override

The generated `docker/docker-compose.worktree.<id>.yml` is produced from a checked-in template and is `.gitignore`d.

- FR-3.1: The override references the worktree's `COMPOSE_PROJECT_NAME` everywhere (labels, networks, volumes).
- FR-3.2: The Traefik router rule uses the worktree hostname `ce-<id>.localhost`.
- FR-3.3: The MySQL volume name is `ce-<id>-mysql-data`, distinct from every other worktree and from the main checkout.
- FR-3.4: `docker compose -p ce-<id> -f docker/docker-compose.yml -f docker/docker-compose.worktree.<id>.yml config` exits 0 with a valid merged config.

### FR-4 — Cross-OS host resolver shim

The worktree hostname resolves to `127.0.0.1` on Linux, macOS, and Windows.

- FR-4.1: Linux uses `nss-myhostname` and `/etc/hosts` as the default.
- FR-4.2: macOS uses `dscacheutil` plus a loopback alias on `lo0`.
- FR-4.3: Windows uses `Add-DnsClientNrptRule` via PowerShell, with a fallback to `%USERPROFILE%/.control-easy/hosts` when admin rights are unavailable.
- FR-4.4: After `worktree-down.sh`, the hostname query returns "not found" or NXDOMAIN.

### FR-5 — Pre-commit hooks and lint wiring

Code quality checks are automated for the new shell scripts and Dockerfile.

- FR-5.1: `.pre-commit-config.yaml` pins shellcheck, hadolint, gitleaks, `dotnet format --verify-no-changes`, and ESLint.
- FR-5.2: Fast checks run on `pre-commit`; heavier checks (hadolint, gitleaks full scan) run on `pre-push`.
- FR-5.3: A `.github/workflows/lint.yml` skeleton is added as the seed for the future C.1 CI work.

### FR-6 — Verification-gate end-to-end test

A single script proves the devcontainer + worktree loop is healthy.

- FR-6.1: `scripts/verify-devcontainer.sh` pre-warms only missing base images, builds the stack, brings it up with `--force-recreate`, waits for `/health` to return 200, runs `dotnet test src/ControlEasyReborn.sln`, runs the demo overlay path, and tears down.
- FR-6.2: On a clean devcontainer with cached base images, the script exits 0 in under 5 minutes.
- FR-6.3: On any test failure, the script exits non-zero and leaves the stack up for inspection.

### FR-7 — Documentation updates

The canonical runtime and development docs are updated to reflect the new shell.

- FR-7.1: `AGENTS.md` is rewritten so that Option D (devcontainer) is the canonical development mode, worktree conventions are documented, and retired modes A/B/C are clearly marked as not for new work.
- FR-7.2: Legacy `docs/` files receive non-destructive one-line redirect notes pointing to their new canonical homes.

## 4. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | The devcontainer image build must be layer-cached and rebuild quickly when only the repo changes, not when base images change. |
| NFR-2 | All shell scripts added by this PRD must pass `shellcheck` with no warnings. |
| NFR-3 | All Dockerfiles added by this PRD must pass `hadolint`. |
| NFR-4 | The worktree scripts must never operate on the main checkout's Compose project unless explicitly invoked from the main checkout itself. |
| NFR-5 | Per-worktree port allocation must detect collisions and abort bring-up with a clear message. |
| NFR-6 | USB / camera passthrough is explicitly out of scope for the devcontainer; `.specs/3 - photo-capture-hardware-integration/` keeps its documented host-shell fallback. |

## 5. Success Metrics & Counter-Metrics

| Metric | Target | Counter-Metric |
|---|---|---|
| New-dev time from clone to green verification gate | ≤ 15 minutes | Time spent debugging OS-specific tooling before first `docker compose up`. |
| Branch collision incidents (same port / same volume) | 0 after adoption | Number of times a developer had to stop another branch's stack to test the current one. |
| Verification gate pass rate on first run | ≥ 90% | Pass rate when the gate is run ad-hoc without the devcontainer. |
| Worktree bring-up time with cached base images | ≤ 5 minutes | Time lost re-pulling images that are already present locally. |

## 6. Implementation Summary

The work is organized in three waves. Tasks inside a wave are independent; waves run strictly in order.

> **Note on task IDs:** The IDs below (9.1–9.8) come from the existing spec-kit `tasks.md` and are preserved as-is. Their order inside the waves is driven by dependency, not by numeric sequence (e.g., 9.5 resolver shim is a Wave 1 foundation file, while 9.3 and 9.4 are Wave 2 glue).

### Wave 1 — Foundation

- **9.1** Devcontainer definition: `.devcontainer/devcontainer.json` + `.devcontainer/Dockerfile`.
- **9.2** Worktree shell scripts: `scripts/worktree-up.sh`, `scripts/worktree-down.sh`, and shared `scripts/lib/worktree.sh`.
- **9.5** Cross-OS resolver shim: `scripts/lib/resolver.sh`.

### Wave 2 — Glue

- **9.3** Per-worktree override generator from `docker/docker-compose.worktree.template.yml`.
- **9.4** Pre-commit hooks + `.github/workflows/lint.yml` skeleton.

### Wave 3 — Verification & Docs

- **9.6** `scripts/verify-devcontainer.sh` end-to-end gate.
- **9.7** Rewrite `AGENTS.md` for devcontainer + worktree conventions.
- **9.8** Add redirect notes to legacy `docs/` files.

### Phase-level verification gate

- `scripts/verify-devcontainer.sh` exits 0 in under 5 minutes.
- `git worktree list` shows the main checkout plus at least one worktree stack on its own hostname and port, with `curl -k https://ce-<id>.localhost:18080+10N/health` returning 200.
- `docker compose -p ce-<id> down -v` removes only that worktree's containers, networks, and volume.
- `pre-commit run --all-files`, `shellcheck`, and `hadolint` all exit 0 on the new files.

## 7. Post-Task Cleanup Convention

Every agent, automated test, or contributor that creates ephemeral Docker artifacts must leave the engine in a clean state. The canonical command is `docker system prune -f`. See `addendum.md` §1 for the full runbook, including when to run it, what to preserve, and safer variants such as `docker system prune -f --volumes=false`.

## 8. Resolved Decisions

- **[ASSUMPTION → accepted]** The team uses VS Code, Cursor, JetBrains, or GitHub Codespaces as the primary devcontainer-aware IDE. If another IDE becomes dominant, the `devcontainer.json` may need small adjustments.
- **[ASSUMPTION → accepted]** The host Docker engine is already installed and running before the devcontainer is opened. Docker installation is out of scope.
- **[NOTE FOR PM → accepted]** A fallback "host shell" verification path will be documented in `AGENTS.md` as part of FR-7.1, for contributors who cannot use the devcontainer.
