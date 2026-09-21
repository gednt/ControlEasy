<!-- generated-by: gsd-doc-writer -->
# Getting Started — ControlEasy Reborn

This guide provides step-by-step instructions for booting up, configuring, and verifying the **ControlEasy Reborn** Docker Compose stack.

## Prerequisites

Before starting, ensure your system has the following installed:

| Requirement | Minimum Version | Notes |
|---|---|---|
| **Docker Engine** | 24.0+ | Container runtime |
| **Docker Compose** | v2.20+ | Multi-container orchestration (`docker compose`) |
| **Git** | 2.30+ | Version control |
| **Free Ports** | — | `8080` (HTTP), `8443` (HTTPS), `8081` (API direct), `8082` (Traefik dashboard), `1025` + `8025` (Mailpit SMTP + web UI) |

## Quick Installation & First Boot

### 1. Clone the Repository
```bash
git clone http://192.168.15.5:3030/reisfelipe18/ControlEasy.git
cd ControlEasy
```
<!-- VERIFY: clone URL is the current Git origin — a LAN-hosted Git server (http://192.168.15.5:3030/reisfelipe18/ControlEasy, per `git remote -v`); not reachable outside this network. Update if a public remote is published. -->

### 2. Configure Environment (Optional)
By default, the stack uses development defaults. You can copy the example environment file:
```bash
cp docker/.env.example docker/.env
```
For variable descriptions and secret options, see the [Configuration Reference](CONFIGURATION.md).

### 3. Launch the Stack
Start all services using Docker Compose:
```bash
docker compose -f docker/docker-compose.yml up -d --build
```
Or use the Makefile shortcut:
```bash
make up
```

Docker Compose spins up eight services (seven long-running plus one one-shot job):
- `reverse-proxy`: Traefik v3.1 gateway (HTTP `8080`, HTTPS `8443`)
- `api`: ASP.NET Core 8 Web API (directly exposed on port `8081`)
- `web`: Angular 18 SPA served via Nginx
- `db`: MySQL 8.0 database
- `db-migrate`: one-shot container that applies SQL migrations after `db` is healthy
- `adminer`: lightweight database web interface (path `/db`)
- `mailpit`: SMTP catch-all for outbound email in development (SMTP `1025`, web UI `8025`)
- `seq`: centralized structured logging instance

---

## What Happens on First Boot

When starting with an empty database volume (`mysql-data`):

1. **MySQL Database Initialization:**
   The `db` container runs scripts from `docker/mysql/init/` in lexical order. The numbered scripts build the schema in stages:
   - `00-schema.sql`: Core users and accounts
   - `02-tenants-seed.sql`: Tenants table + default tenant (`Condominio Padrao`)
   - `02a-residents-schema.sql` / `02b-apartments-schema.sql`: Residents and apartments/units
   - `03-tenant-backfill.sql`: Backfills multi-tenant key constraints
   - `04-tenant-views.sql`: Tenant-scoped views
   - `05-security-schema.sql`: Gatehouses, shifts, attendant profiles
   - `06-visits-schema.sql`: Visits and visitor records
   - `07-vehicles-schema.sql`: Vehicles and license plates
   - `08-service-providers-schema.sql`: Service providers and contractors
   - `09-administration-schema.sql`: System administration configuration
   - `09a-photos-schema.sql` / `09b-consent-schema.sql`: Photos and the consent policy audit ledger
   - `10-demo-metadata.sql` / `11-demo-seed.sql`: Demo seed idempotency table and a minimal static seed for CI
   - `12-access-control-schema.sql`: AccessControl module tables (credentials, events)
   - `13-backfill-tenant-admin-permissions.sql` / `14-visits-unification.sql` / `15-access-events-visit-link.sql`: Permission backfills and the unified visits/access ledger
   - `16-password-reset-requests.sql`: Durable password reset requests

2. **Schema Migrations:**
   Once `db` is healthy, the one-shot `db-migrate` container applies the SQL files in `docker/mysql/migrations/` (access control, tenant-admin permission backfill, visits unification, access-event/visit link, password reset requests, photo entity bindings, system audit backfill). The `api` container starts only after `db-migrate` completes successfully.

3. **PlatformAdmin Bootstrap:**
   Once migrations finish, the `api` container executes `PlatformAdminBootstrapService` (skipped when demo mode is enabled). If no platform administrator exists, it generates random credentials and logs them at warning level:

   ```bash
   docker compose -f docker/docker-compose.yml logs api | grep "CHANGE IMMEDIATELY"
   ```

   **Example output:**
   ```text
   [WRN] // CHANGE IMMEDIATELY — PlatformAdmin seeded. Email: platform-admin-a1b2c3d4@controleasy.local, Password: ...
   ```

   Tip: in Development mode you can also retrieve pending bootstrap credentials anonymously via `GET /api/v1/security/bootstrap` on the API.

---

## Access URLs

HTTP on port **8080** redirects to HTTPS on **8443** (self-signed local certificate); all routed traffic goes through the Traefik reverse proxy:

| Service | Access URL | Credentials / Purpose |
|---|---|---|
| **Web Application** | [http://localhost:8080](http://localhost:8080) | Main Angular portal (redirects to HTTPS) |
| **REST API / Swagger UI** | [http://localhost:8081/swagger](http://localhost:8081/swagger) | Interactive OpenAPI documentation (dev mode only, direct API port) |
| **Adminer (MySQL UI)** | [http://localhost:8080/db](http://localhost:8080/db) | Server: `db`, User: `controleasy`, Pass: `controleasy_dev`, DB: `controleasydb` |
| **Mailpit (email inbox)** | [http://localhost:8025](http://localhost:8025) | Outbound email sent by the API is captured here (dev mode) |
| **Traefik Dashboard** | [http://localhost:8082](http://localhost:8082) | Reverse proxy status and routing rules |

> The `/swagger` path is served by the API directly on port `8081` — through Traefik (8080/8443), only `/api/*` reaches the API; every other path is served by the Angular SPA.

---

## First Sign-In Workflow

1. Open [http://localhost:8080](http://localhost:8080) in your browser.
2. Enter the generated bootstrap email and password from the API logs.
3. Because the account is seeded with `MustChangePassword = true`, you will immediately be prompted to change your password.
4. Enter the temporary password as your current password, choose a secure new password (min 8 characters), and confirm.
5. Upon saving, you are redirected to the platform dashboard.

> In demo mode the bootstrap step is skipped — sign in directly with one of the fixed personas below.

---

## Evaluating with Demo Mode

If you prefer exploring the system with rich sample data — two themed condominiums (`[Demo] Residencial Aurora` and `[Demo] Condomínio Parque Verde`) pre-populated with residents, visitors, vehicles, visits, and attendant profiles — run the stack with the demo overlay:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.demo.yml up -d --build
```

**Fixed Demo Credentials** (password `demo123` for all):

| Persona | Email | Notes |
|---|---|---|
| **Portaria / Attendant** | `porteiro@controleasy.app` | Gatehouse attendant at Aurora |
| **Tenant Administrator** | `admin@controleasy.app` | Condominium admin at Aurora |
| **Resident (Morador)** | `morador@controleasy.app` | Resident at Aurora |
| **Dual-role user** | `multi@controleasy.app` | TenantAdmin + Attendant across Aurora and Parque Verde → tenant picker |
| **Platform Administrator** | `platform@controleasy.app` | Manages all condominiums (Platform → Condominiums) |

Notes:
- PlatformAdmin bootstrap is skipped in demo mode.
- Outbound email is disabled (`Demo__DisableOutboundEmail=true`).
- A full reset re-seeds from scratch: `down -v` followed by `up -d --build` with both compose files.
- `POST /api/v1/demo/reset` (PlatformAdmin auth) forces a re-seed without a rebuild.

For full demo walkthroughs and sample personas, see [Demo Mode](demo-mode.md).

---

## Troubleshooting & Common Setup Issues

### 1. Port Conflict on Bound Host Ports
The stack binds `8080`, `8443`, `8081` (API), `8082` (Traefik dashboard), `1025` and `8025` (Mailpit). If any of these are already taken on your machine:
- Open `docker/.env` (or create one from `docker/.env.example`).
- Adjust the relevant variable (e.g. `REVERSE_PROXY_PORT=8090`, `API_PORT=8085`) and restart the stack:
  ```bash
  docker compose -f docker/docker-compose.yml up -d
  ```

### 2. Database Volume Reset (Fresh Start)
To completely wipe existing data and rerun all schema and bootstrap scripts:
```bash
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up -d --build
```
Retrieve the new bootstrap credentials from the logs after restart.

### 3. Database Container Fails to Become Healthy
Inspect the MySQL container logs:
```bash
docker compose -f docker/docker-compose.yml logs db
```
Ensure you have sufficient disk space and that no local MySQL service on port 3306 conflicts with Docker networking.

---

## Next Steps

- Explore the system architecture: [Architecture Overview](ARCHITECTURE.md)
- Learn how to build and test locally: [Development Guide](DEVELOPMENT.md)
- Configure test suites and CI: [Testing Guide](TESTING.md)
- Review available REST endpoints: [API Documentation](API.md)