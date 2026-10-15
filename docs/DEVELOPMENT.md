<!-- generated-by: gsd-doc-writer -->
# Development Guide — ControlEasy Reborn

This guide outlines local development workflows, build tools, code style standards, Git worktree policies, and pull request procedures for ControlEasy Reborn.

## Local Setup

ControlEasy Reborn enforces a **Docker-first development policy**. All compilation, container execution, and integration testing happen within Docker containers or Devcontainers to guarantee environment parity. The canonical development shell is the devcontainer defined under `.devcontainer/`.

### Prerequisites
- **Docker Engine 24+** & **Docker Compose v2**
- **Git 2.30+**

### Setting Up Your Environment
1. Clone the repository:
   ```bash
   git clone https://github.com/gednt/ControlEasy.git
   cd ControlEasy
   ```
   <!-- VERIFY: clone URL is the `origin-git` remote (https://github.com/gednt/ControlEasy.git, per `git remote -v`). The default `origin` remote points to the LAN Git server at http://192.168.15.5:3030/reisfelipe18/ControlEasy and is only reachable inside that network. -->
2. Initialize local configuration:
   ```bash
   cp docker/.env.example docker/.env
   ```
3. Start the application stack:
   ```bash
   docker compose -f docker/docker-compose.yml up -d --build
   ```

---

## Per-Worktree Stack Bring-Up

Each active feature branch has its own isolated Compose stack with dedicated ports and a MySQL volume.
The worktree override file (`docker/docker-compose.worktree.<slug>.yml`) and matching env file
(`docker/.env.worktree.<slug>`) are generated automatically by `scripts/worktree-up.ps1 / .sh`
(which also registers the `ce-<slug>.localhost` hostname via `scripts/lib/resolver.sh`).

### Bring up the stack (Windows PowerShell — host shell)

Run from the worktree root (`.worktrees/<slug>`). Replace `<slug>` with your branch slug
(e.g. `feat-my-feature`) and `<http-port>` / `<https-port>` with the ports assigned to your
worktree (see the port allocation table below):

```powershell
docker compose `
  -p ce-<slug> `
  -f docker/docker-compose.yml `
  -f docker/docker-compose.worktree.<slug>.yml `
  --env-file docker/.env.worktree.<slug> `
  up -d --build
```

> **Important:** always pass `--env-file docker/.env.worktree.<slug>`. The env file lives inside
> `docker/`, not at the repo root, so Docker Compose will not discover it automatically.
> Omitting it causes the JWT signing key and port variables to fall back to defaults, which can
> break cross-worktree isolation.
>
> **SMTP note:** the generated worktree env file only sets worktree-isolation variables, and
> `--env-file` replaces Compose's default `docker/.env` lookup — so `SMTP_*` values in
> `docker/.env` are **not** visible to worktree stacks (they always use the Mailpit defaults).
> To send through a real provider from a worktree stack, append the `SMTP_*` variables to
> `docker/.env.worktree.<slug>` (and uncomment the matching `Smtp__*` lines in
> `docker/docker-compose.yml`, see [CONFIGURATION.md](CONFIGURATION.md)).

Or simply run the helper script from inside the worktree:

```bash
scripts/worktree-up.sh            # bash (devcontainer / macOS / Git Bash)
./scripts/worktree-up.ps1         # Windows PowerShell
```

The script is idempotent — re-running on an already-up worktree prints "already up" and exits 0.

### Bring up the stack (devcontainer / bash)

```bash
docker compose \
  -p ce-<slug> \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.worktree.<slug>.yml \
  --env-file docker/.env.worktree.<slug> \
  up -d --build
```

### Check health

```powershell
docker compose `
  -p ce-<slug> `
  -f docker/docker-compose.yml `
  -f docker/docker-compose.worktree.<slug>.yml `
  ps
```

All services must reach `STATUS = Up` (db additionally shows `(healthy)`) before the app is usable.

### Service URLs

Worktree stacks are routed by Traefik under the branch hostname `ce-<slug>.localhost`
(registered to `127.0.0.1` by the bring-up script). Replace `<slug>`, `<https-port>`, and
`<http-port>` with your worktree's values:

| URL | Service |
|---|---|
| `https://ce-<slug>.localhost:<https-port>/` | Angular SPA (main entry) |
| `http://ce-<slug>.localhost:<http-port>/` | HTTP → redirects to HTTPS |
| `https://ce-<slug>.localhost:<https-port>/api/v1/health` | API health probe (returns `Healthy`) |
| `https://ce-<slug>.localhost:<https-port>/api/v1/security/bootstrap` | Bootstrap credentials (first run only) |
| `http://localhost:8081/swagger` | Swagger UI / OpenAPI spec — direct API port on the main stack only (not routed via Traefik; worktree overrides publish no API port, so Swagger is unreachable from worktree stacks) |
| `https://ce-<slug>.localhost:<https-port>/db` | Adminer — database GUI |
| `http://localhost:8025` | Mailpit — outbound email inspector |

> The Traefik file-provider routing also accepts `Host(localhost)` and `*.<hostname-pattern>.localhost`,
> so `https://localhost:<https-port>/` works as an alternative to the branch hostname.

> The TLS certificate is self-signed. Accept the browser security warning
> (**Advanced → Proceed**) on first visit.

### Port allocation table

Ports are allocated as `18080 + (worktree-index × 10)`, where the worktree index is the worktree's
1-based position in `git worktree list` (the main checkout is index 0 and uses the standard
`8080`/`8443` ports). HTTPS always uses the HTTP port + 1:

| Worktree (creation order) | HTTP port | HTTPS port |
|---|---|---|
| 1st | 18090 | 18091 |
| 2nd | 18100 | 18101 |
| 3rd | 18110 | 18111 |
| 4th | 18120 | 18121 |
| 5th | 18130 | 18131 |

The assigned ports for your worktree are recorded in `docker/.env.worktree.<slug>`
(`TRAEFIK_PORT` and `TRAEFIK_HTTPS_PORT`).

### First-run login

On a fresh database the platform-admin account is seeded automatically.
Retrieve the temporary credentials from the bootstrap endpoint:

```powershell
Invoke-RestMethod -Uri "https://ce-<slug>.localhost:<https-port>/api/v1/security/bootstrap" -SkipCertificateCheck
```

Default values (change immediately after first login):

| Field | Default |
|---|---|
| Email | `platform-admin@controleasy.local` |
| Password | `Bootstrap-ChangeMe1!` |

### Tear down

The canonical teardown is the helper script (it also removes the `ce-<slug>.localhost` hostname
registration and, by default, the worktree directory):

```bash
scripts/worktree-down.sh --branch <branch>
./scripts/worktree-down.ps1 --branch <branch>    # Windows PowerShell
```

To only tear down the containers/volumes (keeping the worktree), pass `--keep-worktree`, or run
Compose manually:

```powershell
docker compose `
  -p ce-<slug> `
  -f docker/docker-compose.yml `
  -f docker/docker-compose.worktree.<slug>.yml `
  down -v
```

The `-v` flag removes the worktree's MySQL volume (`ce-<slug>-mysql-data`).
Omit it to keep data between restarts.

---

## Build & Development Commands

### Backend (.NET 8)
Commands should be executed within container environments (or with .NET 8 SDK inside the devcontainer):

| Command | Description |
|---|---|
| `dotnet build src/ControlEasyReborn.sln` | Builds the entire .NET solution (API, BuildingBlocks, Modules) |
| `dotnet format src/ControlEasyReborn.sln --verify-no-changes` | Verifies C# formatting without modifying files (CI gate) |
| `dotnet clean src/ControlEasyReborn.sln` | Cleans build artifacts and bin/obj folders |
| `dotnet test tests/ControlEasyReborn.UnitTests` | Runs unit tests across all feature modules |
| `dotnet test tests/ControlEasyReborn.IntegrationTests` | Runs integration tests with Testcontainers.MySql |
| `dotnet test tests/ControlEasyReborn.ArchitectureTests` | Runs NetArchTest architectural boundary validation |

### Frontend (Angular 18)
Executed from directory `src/Web/ControlEasyReborn.Web`:

| Command | Description |
|---|---|
| `npm start` | Starts the Angular development server (`ng serve`) |
| `npm run build` | Compiles the production Angular application bundle (`prebuild` hook runs `openapi-gen` first) |
| `npm run watch` | Builds and watches for frontend changes (development configuration) |
| `npm run openapi-gen` | Generates TypeScript API client models and services from backend OpenAPI spec |
| `npm run openapi-check` | Regenerates API clients, then fails if `src/app/api` has uncommitted diffs (`git diff --exit-code`) |
| `npm test` | Runs Angular Karma unit tests with Jasmine (CI uses `-- --no-watch --browsers=ChromeHeadlessNoSandbox`) |
| `npm run e2e` | Runs Playwright end-to-end tests |
| `npm run e2e:install` | Installs the Playwright Chromium browser (one-time setup before `e2e`) |
| `npm run lint` | Runs ESLint across TypeScript sources (`src/**/*.ts`) |
| `npm run format` | Formats code with Prettier (single quotes, 120 columns; ts/html/css/json) |

### Docker & Convenience Targets (Makefile)

| Command | Description |
|---|---|
| `make up` | Starts the full Docker Compose stack in detached mode (`docker compose -f docker/docker-compose.yml up -d`) |
| `make down` | Shuts down containers and tears down volumes (`docker compose down -v`) |
| `make logs` | Follows aggregated Compose logs (`docker compose logs -f`) |
| `make test` | Runs unit tests, then integration tests with Testcontainers.MySql |
| `make build` | Builds the .NET solution (`dotnet build src/ControlEasyReborn.sln`) — not Docker images |
| `make restore` | Restores NuGet packages for the solution |
| `make migrate` | Prints a note — schema migrations run automatically via `docker/mysql/init/` scripts on first boot |
| `make clean` | Cleans .NET build artifacts and removes bin/obj folders |
| `make verify-ci` | Runs the full local CI verification gate (`scripts/verify-ci-local.sh`) |

---

## Local CI Verification Gate

The repository mandates running the CI pipeline locally before any work is considered complete.
The gate scripts (`scripts/verify-ci-local.sh` and `scripts/verify-ci-local.ps1`) execute **all
dotnet/npx commands inside Docker containers** (`mcr.microsoft.com/dotnet/sdk:8.0`,
`mcr.microsoft.com/dotnet/aspnet:8.0`, `node:20-slim`) — the only host-side requirements are the
`docker` CLI, `git`, `curl`, `id`, and `uname`.

- **Full gate** (task completion): `./scripts/verify-ci-local.sh` (or `make verify-ci`) runs all six stages:
  1. Format check (`dotnet format --verify-no-changes`)
  2. Release build
  3. Fast tests (UnitTests + ArchitectureTests)
  4. Integration tests (Testcontainers MySQL)
  5. Angular Docker production build
  6. OpenAPI client drift check (swagger generation + `ng-openapi-gen`)
- **Fast gate** (per-turn): `./scripts/verify-ci-local.sh --fast` — format check, Release build, and
  unit/architecture tests (stages 1–3), executed inside an SDK container via `docker run`. Zero
  *additional* Docker image downloads after the first run (the `mcr.microsoft.com/dotnet/sdk:8.0`
  image is cached thereafter).
- Partial skips are available via `--skip-integration`, `--skip-docker`, and `--skip-openapi`.

A passing full gate stamps `ci-local-passed.stamp` in the Git directory so already-verified states
do not re-run the slow Docker stages unnecessarily.

---

## Code Standards & Style

### C# / Backend Standards
- **Language & Framework:** C# 12 on .NET 8.
- **Namespaces:** File-scoped namespaces (`namespace ControlEasyReborn.Modules.Visits.Domain;`).
- **Class Design:** Classes are `sealed` by default unless explicitly designed for inheritance.
- **Compiler Flags:** Nullable reference types enabled (`<Nullable>enable</Nullable>`) and warnings treated as errors (`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`).
- **Data Access:** Exclusively [DBTools](https://www.nuget.org/packages/DBTools) (`Linq<TModel>` and `IAsyncSqlClient`). **No EF Core**. <!-- VERIFY: doc previously cited "ADR 0002" (docs/architecture/decisions/0002-dbtools-sql-as-only-data-access.md), but no ADR 0002 file exists anywhere in the repo. The prohibition itself is verified: no EntityFramework PackageReference in any csproj; DBTools is the sole data access layer. -->
- **Service Registration:** No MediatR. Register use-case handlers as scoped services in each module's `DI` extension class.
- **Route Definitions:** Minimal API endpoints using `app.MapGroup("/api/v1/<resource>")` with kebab-case, plural nouns.

### TypeScript / Angular Standards
- **Components:** Standalone components only (`standalone: true`).
- **Change Detection:** `ChangeDetectionStrategy.OnPush` on all components.
- **Reactive State:** Angular Signals API (`signal`, `computed`, `effect`).
- **Selectors:** Prefixed with `ce-` using kebab-case (e.g., `ce-resident-list`).
- **Formatting:** Prettier enforced with single quotes and 120-column print width (`.prettierrc`).
- **Types:** All API models generated via `ng-openapi-gen`; no manually maintained domain DTOs duplicated on the frontend.

---

## Git Worktree Policy (Mandatory)

The repository enforces strict separation between development work and the default `main` branch:

1. **Main Branch is Pristine:**
   The main checkout is strictly read-only for active feature development. No files are edited and no commits are made directly on `main`; changes reach `main` only through a reviewed and approved pull request (merged by a human).
2. **All Work Occurs in a Worktree:**
   Before creating or modifying code, create a dedicated Git worktree under `.worktrees/`. The canonical command is:
   ```bash
   git worktree add ".worktrees/$(echo "$BRANCH" | tr / -)" -b "$BRANCH"
   ```
   Example: branch `feat/dashboard-live-stats` → worktree path `.worktrees/feat-dashboard-live-stats`.
3. **Naming Convention:**
   - Branches: `feat/<slug>` or `fix/<slug>`, optionally prefixed with a spec id (e.g. `feat/<spec-id>-<slug>`); lowercase, hyphen-separated.
   - Worktree path: `.worktrees/<branch-with-slashes-as-hyphens>` (e.g., branch `feat/tenant-admin-ui` → `.worktrees/feat-tenant-admin-ui`).
   - Compose project: `ce-<branch-with-slashes-as-hyphens>`; Traefik host: `ce-<branch-with-slashes-as-hyphens>.localhost`; MySQL volume: `ce-<...>-mysql-data`.
4. **Cleanup After Merge:**
   Once a feature branch is merged into `main`, remove only the worktree you created:
   ```bash
   git worktree remove .worktrees/feat-dashboard-live-stats
   ```

---

## Pull Request Guidelines

Before opening a pull request:
1. Run the full local CI verification gate and ensure it passes:
   ```bash
   make verify-ci
   # or: ./scripts/verify-ci-local.sh
   ```
2. Ensure all .NET tests pass (`make test` or individual `dotnet test` suites).
3. Ensure Angular linter and OpenAPI checks pass:
   ```bash
   npm run lint
   npm run openapi-check
   ```
4. Verify that new code strictly adheres to Clean Architecture module boundaries (enforced by `ControlEasyReborn.ArchitectureTests`).
5. Commit messages must follow Conventional Commits (e.g., `feat(visits): add visitor fast check-in endpoint`).
6. Open PRs against the `main` branch with a clear description of the business value and verification steps.