<!-- generated-by: gsd-doc-writer -->
# Development Guide — ControlEasy Reborn

This guide outlines local development workflows, build tools, code style standards, Git worktree policies, and pull request procedures for ControlEasy Reborn.

## Local Setup

ControlEasy Reborn enforces a **Docker-first development policy**. All compilation, container execution, and integration testing happen within Docker containers or Devcontainers to guarantee environment parity.

### Prerequisites
- **Docker Engine 24+** & **Docker Compose v2**
- **Git 2.30+**

### Setting Up Your Environment
1. Clone the repository:
   ```bash
   git clone https://github.com/reisfelipe18/ControlEasy.git
   cd ControlEasy
   ```
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
(`docker/.env.worktree.<slug>`) are generated automatically by `scripts/worktree-up.ps1 / .sh`.

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

Replace `<https-port>` and `<http-port>` with your worktree's allocated ports:

| URL | Service |
|---|---|
| `https://localhost:<https-port>/` | Angular SPA (main entry) |
| `http://localhost:<http-port>/` | HTTP → redirects to HTTPS |
| `https://localhost:<https-port>/api/v1/health` | API health probe (returns `Healthy`) |
| `https://localhost:<https-port>/api/v1/security/bootstrap` | Bootstrap credentials (first run only) |
| `https://localhost:<https-port>/db` | Adminer — database GUI |
| `http://localhost:8025` | Mailpit — outbound email inspector |

> The TLS certificate is self-signed. Accept the browser security warning
> (**Advanced → Proceed**) on first visit.

### Port allocation table

| Worktree index | HTTP port | HTTPS port |
|---|---|---|
| 0 | 18080 | 18081 |
| 1 | 18090 | 18091 |
| 2 | 18100 | 18101 |
| 3 | 18110 | 18111 |
| 4 | 18120 | 18121 |

The assigned ports for your worktree are recorded in `docker/.env.worktree.<slug>`
(`TRAEFIK_PORT` and `TRAEFIK_HTTPS_PORT`).

### First-run login

On a fresh database the platform-admin account is seeded automatically.
Retrieve the temporary credentials from the bootstrap endpoint:

```powershell
Invoke-RestMethod -Uri "https://localhost:<https-port>/api/v1/security/bootstrap" -SkipCertificateCheck
```

Default values (change immediately after first login):

| Field | Default |
|---|---|
| Email | `platform-admin@controleasy.local` |
| Password | `Bootstrap-ChangeMe1!` |

### Tear down

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
| `dotnet clean src/ControlEasyReborn.sln` | Cleans build artifacts and bin/obj folders |
| `dotnet test tests/ControlEasyReborn.UnitTests` | Runs unit tests across all feature modules |
| `dotnet test tests/ControlEasyReborn.IntegrationTests` | Runs integration tests with Testcontainers.MySql |
| `dotnet test tests/ControlEasyReborn.ArchitectureTests` | Runs NetArchTest architectural boundary validation |

### Frontend (Angular 18)
Executed from directory `src/Web/ControlEasyReborn.Web`:

| Command | Description |
|---|---|
| `npm start` | Starts the Angular development server (`ng serve`) |
| `npm run build` | Compiles the production Angular application bundle (runs `openapi-gen` first) |
| `npm run watch` | Builds and watches for frontend changes |
| `npm run openapi-gen` | Generates TypeScript API client models and services from backend OpenAPI spec |
| `npm run openapi-check` | Verifies generated API clients are completely up to date with Git status |
| `npm test` | Runs Angular Karma unit tests with Jasmine in ChromeHeadless |
| `npm run e2e` | Runs Playwright end-to-end tests |
| `npm run lint` | Runs ESLint analysis across all TypeScript and HTML template files |
| `npm run format` | Formats code with Prettier (single quotes, 120 columns) |

### Docker & Convenience Targets (Makefile)

| Command | Description |
|---|---|
| `make up` | Starts full Docker Compose stack with build (`docker compose up -d --build`) |
| `make down` | Shuts down containers and tears down volumes (`docker compose down -v`) |
| `make test` | Executes all test projects in sequence |
| `make build` | Rebuilds all container images |

---

## Code Standards & Style

### C# / Backend Standards
- **Language & Framework:** C# 12 on .NET 8.
- **Namespaces:** File-scoped namespaces (`namespace ControlEasyReborn.Modules.Visits.Domain;`).
- **Class Design:** Classes are `sealed` by default unless explicitly designed for inheritance.
- **Compiler Flags:** Nullable reference types enabled (`<Nullable>enable</Nullable>`) and warnings treated as errors (`<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`).
- **Data Access:** Exclusively [DBTools](https://www.nuget.org/packages/DBTools) (`Linq<TModel>` and `IAsyncSqlClient`). **No EF Core** (ADR 0002).
- **Service Registration:** No MediatR. Register use-case handlers as scoped services in each module's `DI` extension class.
- **Route Definitions:** Minimal API endpoints using `app.MapGroup("/api/v1/<resource>")` with kebab-case, plural nouns.

### TypeScript / Angular Standards
- **Components:** Standalone components only (`standalone: true`).
- **Change Detection:** `ChangeDetectionStrategy.OnPush` on all components.
- **Reactive State:** Angular Signals API (`signal`, `computed`, `effect`).
- **Selectors:** Prefixed with `ce-` using kebab-case (e.g., `ce-resident-list`).
- **Formatting:** Prettier enforced with single quotes and 120-column print width.
- **Types:** All API models generated via `ng-openapi-gen`; no manually maintained domain DTOs duplicated on the frontend.

---

## Git Worktree Policy (Mandatory)

The repository enforces strict separation between development work and the default `main` branch:

1. **Main Branch is Pristine:**
   The main checkout is strictly read-only for active feature development. No files are edited and no commits are made directly on `main`.
2. **All Work Occurs in a Worktree:**
   Before creating or modifying code, create a dedicated Git worktree under `.worktrees/`:
   ```bash
   git worktree add ".worktrees/feat-<slug>" -b "feat/<slug>"
   ```
3. **Naming Convention:**
   - Branches: `feat/<slug>` or `fix/<slug>` (lowercase, hyphen-separated).
   - Worktree path: `.worktrees/<branch-hyphens>` (e.g., `.worktrees/feat-tenant-admin-ui`).
4. **Cleanup After Merge:**
   Once a feature branch is merged into `main`, remove the worktree:
   ```bash
   git worktree remove .worktrees/feat-<slug>
   ```

---

## Pull Request Guidelines

Before opening a pull request:
1. Ensure all .NET tests pass (`make test` or individual `dotnet test` suites).
2. Ensure Angular linter and OpenAPI checks pass:
   ```bash
   npm run lint
   npm run openapi-check
   ```
3. Verify that new code strictly adheres to Clean Architecture module boundaries (enforced by `ControlEasyReborn.ArchitectureTests`).
4. Commit messages must follow Conventional Commits (e.g., `feat(visits): add visitor fast check-in endpoint`).
5. Open PRs against the `main` branch with a clear description of the business value and verification steps.
