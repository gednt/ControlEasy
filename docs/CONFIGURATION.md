<!-- generated-by: gsd-doc-writer -->
# Configuration Reference — ControlEasy Reborn

This guide covers all configuration options, environment variables, configuration files, and secrets management for ControlEasy Reborn.

## Environment Variables

The application can be configured via environment variables supplied in Docker Compose, Kubernetes secrets, or `.env` files.

### Database & Storage Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `MYSQL_ROOT_PASSWORD` | **Required** | `controleasy_root_dev` | Root password for MySQL container |
| `MYSQL_DATABASE` | Optional | `controleasydb` | Name of the application database (hardcoded in Compose for `db` and `db-migrate`) |
| `MYSQL_USER` | **Required** | `controleasy` | MySQL application database username |
| `MYSQL_PASSWORD` | **Required** | `controleasy_dev` | MySQL application database password |
| `Db__Provider` | Optional | `MySQL` | Database provider (`MySQL`, `SqlServer`/`MSSQL`, `PostgreSQL`/`Postgres`, `SQLite`) — validated at startup |
| `Db__Host` | Optional* | `db` | Database host name or IP address |
| `Db__Port` | Optional | `3306` | Database listening port |
| `Db__Database` | Optional* | `controleasydb` | Database schema name |
| `Db__Username` | Optional* | `controleasy` | Database user name passed to connection string |
| `Db__Password` | Optional* | `controleasy_dev` | Database password passed to connection string |
| `Storage__Provider` | Optional | `Local` | Photo storage backend (`Local` or `S3`) |
| `Storage__Local__Path` | Optional* | `/storage/photos` | Path on disk for local photo storage — **required (validated at startup) when `Storage__Provider=Local`** |
| `Storage__S3__Endpoint` | Optional* | *(empty)* | S3 API endpoint URL — **required (validated at startup) when `Storage__Provider=S3`** (e.g. `http://minio:9000`) |
| `Storage__S3__Bucket` | Optional* | *(empty)* | Target S3 bucket name — **required when `Storage__Provider=S3`** (e.g. `controleasy-photos`) |
| `Storage__S3__AccessKey` | Optional* | *(empty)* | S3 Access Key — **required when `Storage__Provider=S3`** <!-- VERIFY: production AWS/MinIO access key configuration --> |
| `Storage__S3__SecretKey` | Optional* | *(empty)* | S3 Secret Key — **required when `Storage__Provider=S3`** <!-- VERIFY: production AWS/MinIO secret key configuration --> |

\* `Db__Host`, `Db__Database`, `Db__Username`, and `Db__Password` throw `InvalidOperationException` at startup when absent (e.g. `Db:Password is not configured.`), but `appsettings.json` ships with base values (`root` / empty password) and Docker Compose maps them from `MYSQL_USER` / `MYSQL_PASSWORD`, so they rarely need to be set directly.

### Authentication & Security Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SIGNING_KEY` / `Jwt__SigningKey` | **Required** | `CHANGE-ME-IN-PRODUCTION-AT-LEAST-32-CHARS!` | Symmetric HMAC-SHA256 signing key. Missing key throws `InvalidOperationException("Jwt:SigningKey is not configured.")` when tokens are issued or validated. Example values are 32+ characters by convention; no explicit length validation exists in code (HMAC-SHA256 rejects keys shorter than 128 bits / 16 bytes at token signing/validation time) |
| `Jwt__Issuer` | Optional | `ControlEasyReborn` | JWT issuer claim (`iss`) |
| `Jwt__Audience` | Optional | `ControlEasyReborn` | JWT audience claim (`aud`) |
| `Jwt__AccessTokenTtlMinutes` | Optional | `15` | Access token time-to-live in minutes (code fallback: `15`) |
| `Jwt__RefreshTokenTtlDays` | Optional | `7` | Refresh token lifetime in days (code fallback: `7`) |
| `Bootstrap__PlatformAdminEmail` | Optional | `platform-admin@controleasy.local` | Bootstrap PlatformAdmin email; if blank, a random address (`platform-admin-{random}@controleasy.local`) is generated |
| `Bootstrap__PlatformAdminPassword` | Optional | `Bootstrap-ChangeMe1!` | Bootstrap PlatformAdmin password; if blank, a random 16-character password is generated |

### SMTP & Email Configuration

Bound to `SmtpOptions` (`src/BuildingBlocks/ControlEasyReborn.SharedKernel/Email/SmtpOptions.cs`). Docker Compose points the API at the Mailpit dev mail server (UI on host port `8025`).

Configure the sender via the `SMTP_*` variables in `docker/.env` (template: `docker/.env.example`); they are commented out there — uncomment and fill them to send through a real provider (dev included). When unset, Compose falls back to Mailpit defaults:

> **Important:** Compose wires only `SMTP_HOST` and `SMTP_PORT` unconditionally. For the sender/auth/TLS variables to reach the API container, you must also uncomment the matching `Smtp__SenderEmail` / `Smtp__SenderName` / `Smtp__Username` / `Smtp__Password` / `Smtp__EnableSsl` lines in `docker/docker-compose.yml` (they are intentionally commented out so unset values fall back to the code defaults). `SMTP_PORT` must be numeric.

| Compose env var | Feeds | Default when unset |
|---|---|---|
| `SMTP_HOST` | `Smtp__Host` | `mailpit` (dev sink) |
| `SMTP_PORT` | `Smtp__Port` | `1025` |
| `SMTP_SENDER_EMAIL` | `Smtp__SenderEmail` | `noreply@controleasy.com` (code fallback) |
| `SMTP_SENDER_NAME` | `Smtp__SenderName` | `ControlEasy` (code fallback) |
| `SMTP_USERNAME` | `Smtp__Username` | *(empty — no SMTP auth)* |
| `SMTP_PASSWORD` | `Smtp__Password` | *(empty — no SMTP auth)* |
| `SMTP_ENABLE_SSL` | `Smtp__EnableSsl` | `false` (plaintext; **never in production**) |

The underlying application settings (bindable via `Smtp__*` environment variables instead, if you deploy outside Compose) are:

| Variable | Required | Default | Description |
|---|---|---|---|
| `Smtp__Host` | Optional | `127.0.0.1` | SMTP server host (Compose sets `mailpit`) |
| `Smtp__Port` | Optional | `1025` | SMTP server port |
| `Smtp__SenderEmail` | Optional | `noreply@controleasy.com` | From address for outbound email |
| `Smtp__SenderName` | Optional | `ControlEasy` | From display name for outbound email |
| `Smtp__Username` | Optional | *(empty)* | SMTP authentication username |
| `Smtp__Password` | Optional | *(empty)* | SMTP authentication password |
| `Smtp__EnableSsl` | Optional | `false` | Use TLS for the SMTP connection (`SecureSocketOptions.Auto` — handles STARTTLS on 587 and implicit TLS on 465) |

Changes take effect on the next `docker compose up -d` (the `api` container is recreated). Demo mode still suppresses all external email via `Demo__DisableOutboundEmail=true` regardless of SMTP settings.

### Reverse Proxy & Networking Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `REVERSE_PROXY_PORT` | Optional | `8080` | Host port for HTTP gateway (Traefik; bound to `127.0.0.1` and redirects to HTTPS) |
| `REVERSE_PROXY_HTTPS_PORT` | Optional | `8443` | Host port for HTTPS gateway (Traefik) <!-- VERIFY: production TLS termination configuration --> |
| `REVERSE_PROXY_API_PORT` | Optional | `8082` | Traefik dashboard & internal API port |
| `API_PORT` | Optional | `8081` | Direct API container port (bypassing Traefik if needed) |

### Logging & Diagnostics

| Variable | Required | Default | Description |
|---|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | Optional | `Development` | ASP.NET Core environment mode (`Development`, `Staging`, `Production`); hardcoded to `Development` in Compose |
| `Serilog__WriteTo__1__Args__serverUrl` | Optional | `http://seq:5341` | Endpoint URL for Seq structured log aggregator |

### Timezone

| Variable | Required | Default | Description |
|---|---|---|---|
| `TIME_ZONE` | Optional | `America/Sao_Paulo` | IANA timezone used by the web date formatting and mapped by Compose to the API's `TimeZone__Id` (tenant-local report date boundaries, see `TenantDayBoundary`) and the container `TZ`. For example: `TIME_ZONE=America/Fortaleza`. |

### Feature Management & Demo Mode

| Variable | Required | Default | Description |
|---|---|---|---|
| `Demo__Enabled` | Optional | `false` | Enables demo endpoints and pre-seeded accounts |
| `Demo__SeedVersion` | Optional | `2` (set in `appsettings.json`) | Demo schema seed version; the code fallback in `DemoOptions` is `1` if unset |
| `Demo__DisableOutboundEmail` | Optional | `false` | Suppresses external email dispatches in demo mode |
| `FeatureManagement__Residents__UseWeb` | Optional | `false` | Enable web workflow for Residents |
| `FeatureManagement__Visits__UseWeb` | Optional | `false` | Enable web workflow for Visits |
| `FeatureManagement__Vehicles__UseWeb` | Optional | `false` | Enable web workflow for Vehicles |
| `FeatureManagement__ServiceProviders__UseWeb` | Optional | `false` | Enable web workflow for Service Providers |
| `FeatureManagement__Administration__UseWeb` | Optional | `false` | Enable web workflow for Administration |

---

## Configuration Files

### 1. `docker/.env`
For local containerized execution, copy `docker/.env.example` to `docker/.env`:

```bash
cp docker/.env.example docker/.env
```

Example file content (matches `docker/.env.example`):
```env
# Docker Compose environment variables
# Copy to .env and update for your environment

MYSQL_ROOT_PASSWORD=controleasy_root_dev
MYSQL_USER=controleasy
MYSQL_PASSWORD=controleasy_dev
JWT_SIGNING_KEY=CHANGE-ME-IN-PRODUCTION-AT-LEAST-32-CHARS!

# Photo storage (Local filesystem by default; set to S3 + MinIO vars for S3-compatible storage)
STORAGE__PROVIDER=Local
STORAGE__LOCAL__PATH=/storage/photos
# STORAGE__S3__ENDPOINT=http://minio:9000
# STORAGE__S3__BUCKET=controleasy-photos
# STORAGE__S3__ACCESSKEY=change-me
# STORAGE__S3__SECRETKEY=change-me
```

### 2. `src/Host/ControlEasyReborn.Api/appsettings.json`
Located at `src/Host/ControlEasyReborn.Api/appsettings.json`. Used for base configuration defaults:

```json
{
  "Db": {
    "Provider": "MySQL",
    "Host": "localhost",
    "Port": "3306",
    "Database": "controleasydb",
    "Username": "root",
    "Password": ""
  },
  "Storage": {
    "Provider": "Local",
    "Local": {
      "Path": "./storage/photos"
    }
  },
  "Jwt": {
    "SigningKey": "CHANGE-ME-IN-PRODUCTION-AT-LEAST-32-CHARS!",
    "Issuer": "ControlEasyReborn",
    "Audience": "ControlEasyReborn",
    "AccessTokenTtlMinutes": 15,
    "RefreshTokenTtlDays": 7
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information"
    },
    "WriteTo": [
      { "Name": "Console" },
      { "Name": "Seq", "Args": { "serverUrl": "http://localhost:5341" } }
    ]
  },
  "FeatureManagement": {
    "Residents.UseWeb": false,
    "Visits.UseWeb": false,
    "Vehicles.UseWeb": false,
    "ServiceProviders.UseWeb": false,
    "Administration.UseWeb": false
  },
  "Demo": {
    "Enabled": false,
    "SeedVersion": 2,
    "DisableOutboundEmail": false
  },
  "Bootstrap": {
    "PlatformAdminEmail": "platform-admin@controleasy.local",
    "PlatformAdminPassword": "Bootstrap-ChangeMe1!"
  }
}
```

---

## Required vs Optional Settings

- **Critical Required Settings:**
  - `JWT_SIGNING_KEY` / `Jwt__SigningKey`: If absent, the API throws `InvalidOperationException("Jwt:SigningKey is not configured.")` when access tokens are issued (JWT bearer validation) or generated (`JwtTokenService`). There is no explicit 32-character validation in code — the 32+ character values in examples and the CI dummy key are a convention; HMAC-SHA256 requires keys of at least 128 bits (16 bytes) per `Microsoft.IdentityModel.Tokens`, and shorter keys fail when tokens are signed or validated.
  - `MYSQL_PASSWORD` / `Db__Password`: Required for the API to establish database connectivity. Along with `Db__Host`, `Db__Database`, and `Db__Username`, a missing value throws `InvalidOperationException` at startup (e.g. `Db:Password is not configured.`).
  - `Storage__Local__Path` when `Storage__Provider=Local`, or `Storage__S3__Endpoint`, `Storage__S3__Bucket`, `Storage__S3__AccessKey`, `Storage__S3__SecretKey` when `Storage__Provider=S3`: validated at startup and throw `InvalidOperationException` if not configured (e.g. `Storage:Local:Path is not configured.`).
- **Optional Settings with Defaults:**
  - Port configurations (`REVERSE_PROXY_PORT=8080`, `API_PORT=8081`) have pre-configured fallbacks suitable for local development.
  - Storage provider defaults to `Local` with `/storage/photos` inside the container mounted to the `photos-data` Docker volume.

---

## Environment Overrides

### Development Mode
- Swagger UI enabled at `/swagger` (OpenAPI JSON at `/swagger/v1/swagger.json`); Swagger middleware is only registered when `ASPNETCORE_ENVIRONMENT=Development`.
- Verbose logging to console and Seq.
- Automatic seeding of bootstrap PlatformAdmin with credentials logged at warning level (`// CHANGE IMMEDIATELY — PlatformAdmin seeded`). Skipped when `Demo__Enabled=true`.

### Demo Mode Overlay
Run with the demo compose overlay:
```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.demo.yml up -d --build
```
This automatically sets:
- `Demo__Enabled: "true"`
- `Demo__SeedVersion: "2"`
- `Demo__DisableOutboundEmail: "true"`
- `Jwt__SigningKey: "demo-signing-key-not-for-production-use!!"`
- All five `FeatureManagement__*__UseWeb` flags to `"true"` (Residents, Visits, Vehicles, ServiceProviders, Administration)

It also seeds demo data: users with `demo123` passwords across two sample condominiums — `demo-aurora` ([Demo] Residencial Aurora) and `demo-parque-verde` ([Demo] Condomínio Parque Verde) — plus the platform tenant. PlatformAdmin bootstrap is skipped in demo mode. A full reset re-seeds from scratch (`docker compose -f docker/docker-compose.yml -f docker/docker-compose.demo.yml down -v` then `up -d --build`), and `POST /api/v1/demo/reset` (PlatformAdmin auth) forces a re-seed without a rebuild.

### Production Mode
- Set `ASPNETCORE_ENVIRONMENT=Production`.
- Swagger UI is automatically disabled.
- Ensure `JWT_SIGNING_KEY` is injected from a secure secret store (Docker secrets, HashiCorp Vault, AWS Secrets Manager).
- Configure TLS termination in Traefik or an external load balancer <!-- VERIFY: production SSL certificate path and domain routing -->.