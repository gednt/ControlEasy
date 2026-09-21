# Tasks — Dev Containers & Worktrees

> Companion to `.specs/devcontainers/requirements.md` and
> `.specs/devcontainers/design.md`. Each task is a single, verifiable
> unit of work.
>
> This spec is **additive**. It does not change the runtime target
> (Docker Compose is still the runtime, per Constitution v1.1.0 Principle V).
> It changes only the **dev shell** and adds the **worktree** convention.
>
> Spec IDs use **Phase 9** (developer experience) in
> `.specs/1 - modernization-roadmap/tasks.md`. Continuous tasks
> (C.1, C.7, etc.) are tracked separately and run alongside every phase.

---

## Task Dependency Graph

The work decomposes into execution **waves** for parallel work. Waves
execute strictly in order: wave *N+1* starts only after every task in
wave *N* is complete and its verification gate is green. Tasks inside
a wave have no inter-dependencies and can be picked up by separate
agents in parallel.

```json
{
  "phase": 9,
  "waves": [
    { "wave": 1, "tasks": ["9.1", "9.2", "9.5"] },
    { "wave": 2, "tasks": ["9.3", "9.4"] },
    { "wave": 3, "tasks": ["9.6", "9.7", "9.8"] }
  ]
}
```

**Wave rationale:**

- **Wave 1** — foundation in parallel: (9.1) devcontainer Dockerfile
  + `devcontainer.json`, (9.2) the worktree shell scripts, (9.5) the
  `/etc/hosts` (or OS-native) resolver shim. All three are file-only
  and have no inter-dependency.
- **Wave 2** — bring-up glue: (9.3) the worktree override generator
  (per-worktree Traefik router + port + volume), (9.4) the
  `pre-commit` hook and shellcheck/hadolint wiring. Both depend on the
  shell scripts from 9.2 but not on each other.
- **Wave 3** — verification + docs: (9.6) the verification-gate
  end-to-end test, (9.7) the AGENTS.md rewrite (this file's deliverable),
  (9.8) the `docs/development-guide.md` redirect stub and the other
  legacy `docs/` deprecation notes.

---

## Phase 9 — Dev Containers & Worktrees

*Goal: a uniform dev shell (devcontainer, DooD) and a per-worktree
convention (own compose project, own Traefik hostname, own DB volume)
so every contributor on every OS can boot the stack the same way and
hold multiple branches in parallel without colliding.*

- [X] **9.1** **Devcontainer definition.** Create
  `.devcontainer/devcontainer.json` and `.devcontainer/Dockerfile`. Base
  image `mcr.microsoft.com/devcontainers/base:debian-12`. Add layers
  for .NET 8 SDK, Node 20, MySQL client, Playwright, Docker CLI +
  Compose plugin, shellcheck, hadolint. `postCreateCommand` is a no-op
  by default (manual bring-up is the verification gate); setting
  `AUTO_START_COMPOSE=true` runs `docker compose -f docker/docker-compose.yml
  up -d --build`. `mounts` includes `source=/var/run/docker.sock,
  target=/var/run/docker.sock, type=bind` (DooD). `containerEnv` sets
  `DEVCONTAINER=true` and `COMPOSE_DOCKER_CLI_BUILD=1`,
  `DOCKER_BUILDKIT=1`. `customizations.vscode.extensions` lists the
  recommended extensions; `.idea/` settings are IDE-agnostic.
  - **Acceptance criteria:**
    - `docker compose -f docker/docker-compose.yml ps` inside the
      devcontainer lists the same services as on the host (the engine
      is shared via DooD).
    - `dotnet --version` inside the devcontainer is 8.x; `node --version`
      is v20.x; `docker compose version` is v2.x.
    - `echo $DEVCONTAINER` returns `true` inside the devcontainer.
    - `AUTO_START_COMPOSE` defaults to `false`; setting it to `true`
      and rebuilding the devcontainer brings the stack up automatically.

- [X] **9.2** **`scripts/worktree-up.sh` and `scripts/worktree-down.sh`.**
  Both shell scripts source a shared `scripts/lib/worktree.sh` (env
  detection, branch-to-project-name conversion, port allocator,
  Traefik hostname derivation). `worktree-up.sh` performs the six-step
  bring-up sequence documented in `design.md` "Worktree bring-up
  sequence". `worktree-down.sh` reverses it. Both are shellcheck-clean
  (CI step from 9.4). Both are idempotent — re-running
  `worktree-up.sh` on an existing worktree is a no-op that prints
  "already up"; re-running `worktree-down.sh` on a torn-down worktree
  exits 0. **Windows parity:** `scripts/worktree-up.ps1`,
  `scripts/worktree-down.ps1`, `scripts/lib/worktree.psm1`, and
  `scripts/lib/resolver.psm1` provide the same flow for contributors
  on plain Windows PowerShell (no Git Bash required).
  - **Acceptance criteria:**
    - `./scripts/worktree-up.sh` on a fresh worktree creates the
      `.env.worktree.<id>` file, appends exactly one `ce-<id>.localhost`
      line to the host resolver, generates
      `docker/docker-compose.worktree.<id>.yml`, and brings the stack
      up under project `ce-<id>` on port `18080 + 10*<index>`.
    - `./scripts/worktree-down.sh` removes the worktree's compose
      project (containers + networks + volumes), restores the host
      resolver from the backup, and `git worktree remove`s the worktree.
    - `shellcheck scripts/worktree-up.sh scripts/worktree-down.sh
      scripts/lib/worktree.sh` exits 0.
    - Re-running either script on a torn-down worktree exits 0 with a
      clear "already down" message.

- [X] **9.3** **Per-worktree override generator.** The
  `docker/docker-compose.worktree.<id>.yml` file is generated by
  `scripts/worktree-up.sh` from a checked-in template
  `docker/docker-compose.worktree.template.yml`. The template
  parameterises: `COMPOSE_PROJECT_NAME`, the Traefik router
  `Host()` rule, the published port, and the MySQL volume name. The
  generated file is `.gitignore`d (`docker/docker-compose.worktree.*.yml`).
  - **Acceptance criteria:**
    - The generated override file references the worktree's
      `COMPOSE_PROJECT_NAME` everywhere (labels, volumes, networks).
    - The Traefik router rule is `Host(\`ce-<id>.localhost\`) &&
      PathPrefix(\`/api\`)` (or `Path(\`/\`)` for the web router).
    - The MySQL volume name is `ce-<id>-mysql-data`, distinct from
      every other worktree's volume.
    - `docker compose -p ce-<id> -f docker/docker-compose.yml -f
      docker/docker-compose.worktree.<id>.yml config` exits 0 with
      a valid merged config.

- [X] **9.4** **Pre-commit hooks + lint wiring.** Add
  `.pre-commit-config.yaml` pinning: `shellcheck` (for `scripts/*.sh`),
  `hadolint` (for `Dockerfile`, `docker/*.Dockerfile`,
  `.devcontainer/Dockerfile`), `gitleaks` (for secrets),
  `dotnet format --verify-no-changes` (C#), `eslint` (Angular,
  via `npx`). The hooks run on `pre-commit` (fast checks) and the
  heavier checks (hadolint, gitleaks full scan) run on `pre-push`.
  Add a `.github/workflows/lint.yml` skeleton that runs the same
  hooks on every PR (this is the seed for the still-pending C.1
  CI work; when C.1 lands, this file becomes the first job).
  - **Acceptance criteria:**
    - `pre-commit run --all-files` on a clean tree exits 0.
    - Introducing a shellcheck warning in `scripts/worktree-up.sh` and
      running `pre-commit run --all-files` makes the hook fail with
      a clear message and the offending line number.
    - The `.github/workflows/lint.yml` skeleton is syntactically
      valid (`actionlint` or `yamllint` exits 0); it does not have
      to be a real CI run yet (C.1 is out of scope for this spec).

- [X] **9.5** **Host resolver shim.** A cross-OS shim that adds and
  removes the `ce-<id>.localhost` hostname. Linux: `nss-myhostname` +
  `/etc/hosts` (default; works on stock Debian/Ubuntu/Fedora).
  macOS: `sudo dscacheutil -q host -a name ce-<id>.localhost` + a
  loopback alias on `lo0` (`sudo ifconfig lo0 alias 127.0.0.1`).
  Windows: `Add-DnsClientNrptRule` (PowerShell, requires admin) for
  the per-worktree suffix; fallback to `%USERPROFILE%/.control-easy/hosts`
  with a documented `git worktree up --resolver=hosts-file` flag.
  The shim is implemented in `scripts/lib/resolver.sh` and called
  by 9.2.
  - **Acceptance criteria:**
    - On Linux + macOS + Windows, `getent hosts ce-<id>.localhost` (or
      `Resolve-DnsName ce-<id>.localhost` on Windows) returns
      `127.0.0.1` after `worktree-up.sh`.
    - After `worktree-down.sh`, the same query returns NXDOMAIN or
      "not found".
    - On a system without admin rights, `worktree-up.sh` exits with
      a clear error pointing to `--resolver=hosts-file` and a
      documented manual fallback.

- [X] **9.6** **Verification-gate end-to-end test.** A shell script
  `scripts/verify-devcontainer.sh` (run from inside the devcontainer)
  performs the full gate: pre-warm the base images with
  `docker image inspect` + `docker pull`, build the stack with
  `docker compose -p ce-$(...) -f docker/docker-compose.yml -f
  docker/docker-compose.worktree.<id>.yml build api web`, bring it
  up with `--force-recreate`, wait for `/health` to return 200, run
  `dotnet test src/ControlEasyReborn.sln` (unit + integration +
  architecture), run the demo overlay path
  (`docker compose -p ce-demo -f docker/docker-compose.yml -f
  docker/docker-compose.demo.yml ...`), and finally tear down
  (`docker compose -p ce-<id> down -v`). The script is the seed for
  the verification gate described in `AGENTS.md` "Local
  development" (rewritten in task 9.7).
  - **Acceptance criteria:**
    - In a clean devcontainer, the script exits 0 in under 5 minutes
      (assuming cached base images).
    - On a missing base image, the script pre-pulls only the missing
      image (matches `AGENTS.md` "Docker image caching").
    - On any `dotnet test` failure, the script exits non-zero with
      the failing test's name and does NOT tear down the stack (so
      the contributor can inspect).

- [X] **9.7** **`AGENTS.md` rewrite.** Replace the legacy
  `AGENTS.md` (which still encodes the "post-task verification
  (Docker) — host shell" model and the no-CI-acknowledged
  `docker compose` workflow) with the new model:
  - **Workflow tooling section** — GSD owns the roadmap, spec-kit
    owns per-feature specs (as recorded at task time; OpenSpec was
    later removed at constitution v1.7.0).
  - **Local development section** — Option D (devcontainer) is
    canonical; the historical Options A/B/C are kept as
    "Retired modes" with a one-line "not for new work" note.
  - **Worktrees section** — the convention table, the
    `scripts/worktree-up.sh` / `scripts/worktree-down.sh` flow, and
    the per-worktree verification gate.
  - **Spec Structure section** — keep the `.specs/<feature>/`
    triple-of-artifacts description, but replace the "agents"
    in the file list (Review, Analysis, DocPlan, DocChange,
    Orchestration) with a sentence pointing to the GSD and
    spec-kit skill homes.
  - **Post-task verification** — keep the same Docker Compose
    command sequence, but add the devcontainer as the canonical
    shell and the per-worktree variant of the command.

  - **Acceptance criteria:**
    - The new `AGENTS.md` references the constitution v1.1.0
      principle VI ("Workflow Tooling") by name.
    - The new "Local development" section lists Option D first;
      the "Retired modes" subsection lists Options A/B/C with a
      clear "not for new work" notice.
    - The "Worktrees" section includes the per-worktree
      `COMPOSE_PROJECT_NAME`, Traefik hostname, port range, and
      DB volume conventions.
    - `git grep -n "post-task verification (Docker)" AGENTS.md`
      returns zero matches (the old heading is gone, replaced by
      "Post-task verification" without the parenthetical "Docker",
      reflecting the principle that Docker is the *runtime*, not
      the *shell*).

- [X] **9.8** **Redirect stubs for the legacy `docs/` files.** Per
  Constitution v1.1.0 § "Documentation Systems and Source of Truth —
  Retirement schedule", the legacy `docs/` generation pipeline is
  on a milestone-boundary retirement. For now, add a one-line
  redirect note at the top of each legacy file pointing to its
  canonical home. The files are:
  - `docs/index.md` → new `AGENTS.md` "Index" + `.planning/`
  - `docs/project-overview.md` → new `AGENTS.md` "Project overview"
    + `.planning/PROJECT.md`
  - `docs/architecture.md` → new `AGENTS.md` "Architecture" +
    `.planning/codebase/ARCHITECTURE.md`
  - `docs/component-inventory.md` → new `AGENTS.md` "Modules" +
    `.planning/codebase/STRUCTURE.md`
  - `docs/development-guide.md` → new `AGENTS.md` "Local development"
  - `docs/deployment-guide.md` → new `AGENTS.md` "Deployment"
  - `docs/api-contracts.md` → new `AGENTS.md` "API surface"
  - `docs/data-models.md` → new `AGENTS.md` "Data model"
  - `docs/integration-architecture.md` → new `AGENTS.md`
    "Integration architecture" + `.planning/codebase/INTEGRATIONS.md`
  - `docs/source-tree-analysis.md` → `.planning/codebase/STRUCTURE.md`
  - `docs/project-scan-report.json` → archived with a one-line note
    "Historical snapshot of `bmad-document-project --mode deep` on
    2026-07-12. See `.planning/PROJECT.md` and the new `AGENTS.md`
    for current truth."
  - `docs/architecture/decisions/0001-…0004-…` — kept for
    historical reference but a one-line note added at the top of
    each pointing to the constitution (which now references them
    in § "Documentation Systems and Source of Truth").

  - **Acceptance criteria:**
    - Every legacy file has a one-line redirect note at the top.
    - The redirect notes are non-destructive (the file content
      is otherwise unchanged).
    - The redirect notes link to a canonical home that exists
      (i.e., they do not link to a TODO that has not been
      written yet).

- **Verification gate (Phase 9):**
  - In a clean Linux devcontainer, `scripts/verify-devcontainer.sh`
    exits 0 in under 5 minutes.
  - `git worktree list` shows the main checkout and at least one
    per-worktree stack running on its own Traefik hostname and port;
    `curl -k https://ce-<id>.localhost:<port>/health` returns 200,
    where `<port>` follows the worktree port allocation convention
    (`18080 + worktree-index × 10`).
  - `docker compose -p ce-<id> down -v` removes ONLY the
    worktree's containers, networks, and volumes (verified by
    `docker volume ls` before and after).
  - `pre-commit run --all-files` on the new files exits 0.
  - `shellcheck` and `hadolint` on the new scripts and
    Dockerfiles exit 0.
  - The new `AGENTS.md` is the only `AGENTS.md` in the repo
    (the legacy scratch draft at
    `.agents/skills/.../drafts/AGENTS-devcontainers-worktrees.md`
    is deleted in a follow-up commit, not in this one).

---

## Continuous tasks (spec-related, devcontainer-relevant)

- [ ] **C.12** **Devcontainer / worktree health check in CI.** When
  the still-pending C.1 (GitHub Actions) lands, the first CI job
  is to build `.devcontainer/Dockerfile`, then run
  `scripts/verify-devcontainer.sh` inside it, then run the same
  script in a second job that uses a worktree. This is the
  "works in the dev shell" / "works in the worktree" parity check.

- [X] **C.13** **OpenSpec promotion trigger (out of scope until
  user opt-in).** RESOLVED 2026-09-21: OpenSpec was removed from
  the project at constitution v1.7.0 instead of being adopted; the
  `openspec/` directory was deleted and the `TODO(CONSTITUTION_VI_
  OPENSPEC_ADOPTION_DATE)` trigger is moot. No migration occurred;
  the spec-kit `.specs/<feature>/` folders remain the sole
  per-feature source of truth.
