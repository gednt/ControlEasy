<!-- generated-by: gsd-doc-writer -->
# Configuration Reference — ControlEasy Reborn

This guide covers all configuration options, environment variables, configuration files, and secrets management for ControlEasy Reborn.

## Environment Variables

The application can be configured via environment variables supplied in Docker Compose, Kubernetes secrets, or `.env` files.

### Database & Storage Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `MYSQL_ROOT_PASSWORD` | **Required** | `controleasy_root_dev` | Root password for MySQL container |
| `MYSQL_DATABASE` | Optional | `controleasydb` | Name of the application database |
| `MYSQL_USER` | **Required** | `controleasy` | MySQL application database username |
| `MYSQL_PASSWORD` | **Required** | `controleasy_dev` | MySQL application database password |
| `Db__Provider` | Optional | `MySQL` | Database provider (`MySQL`, `PostgreSQL`, `SQLite`, `SqlServer`) |
| `Db__Host` | Optional | `db` | Database host name or IP address |
| `Db__Port` | Optional | `3306` | Database listening port |
| `Db__Database` | Optional | `controleasydb` | Database schema name |
| `Db__Username` | Optional | `controleasy` | Database user name passed to connection string |
| `Db__Password` | Optional | `controleasy_dev` | Database password passed to connection string |
| `Storage__Provider` | Optional | `Local` | Photo storage backend (`Local` or `S3`) |
| `Storage__Local__Path` | Optional | `/storage/photos` | Path on disk for local photo storage |
| `Storage__S3__Endpoint` | Optional | `http://minio:9000` | S3 API endpoint URL (when `Storage__Provider=S3`) |
| `Storage__S3__Bucket` | Optional | `controleasy-photos` | Target S3 bucket name |
| `Storage__S3__AccessKey` | Optional | `change-me` | S3 Access Key <!-- VERIFY: production AWS/MinIO access key configuration --> |
| `Storage__S3__SecretKey` | Optional | `change-me` | S3 Secret Key <!-- VERIFY: production AWS/MinIO secret key configuration --> |

### Authentication & Security Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SIGNING_KEY` / `Jwt__SigningKey` | **Required** | `CHANGE-ME-IN-PRODUCTION-AT-LEAST-32-CHARS!` | Symmetric HMAC-SHA256 key (minimum 32 characters) |
| `Jwt__Issuer` | Optional | `ControlEasyReborn` | JWT issuer claim (`iss`) |
| `Jwt__Audience` | Optional | `ControlEasyReborn` | JWT audience claim (`aud`) |
| `Jwt__AccessTokenTtlMinutes` | Optional | `15` | Access token time-to-live in minutes |
| `Jwt__RefreshTokenTtlDays` | Optional | `7` | Refresh token lifetime in days |
| `Bootstrap__PlatformAdminEmail` | Optional | `platform-admin@controleasy.local` | Default fallback email for bootstrap service |
| `Bootstrap__PlatformAdminPassword` | Optional | `Bootstrap-ChangeMe1!` | Default fallback password for bootstrap service |

### Reverse Proxy & Networking Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `REVERSE_PROXY_PORT` | Optional | `8080` | Host port for HTTP gateway (Traefik) |
| `REVERSE_PROXY_HTTPS_PORT` | Optional | `8443` | Host port for HTTPS gateway (Traefik) <!-- VERIFY: production TLS termination configuration --> |
| `REVERSE_PROXY_API_PORT` | Optional | `8082` | Traefik dashboard & internal API port |
| `API_PORT` | Optional | `8081` | Direct API container port (bypassing Traefik if needed) |

### Logging & Diagnostics

| Variable | Required | Default | Description |
|---|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | Optional | `Development` | ASP.NET Core environment mode (`Development`, `Staging`, `Production`) |
| `Serilog__WriteTo__1__Args__serverUrl` | Optional | `http://seq:5341` | Endpoint URL for Seq structured log aggregator |

### Timezone

| Variable | Required | Default | Description |
|---|---|---|---|
| `TIME_ZONE` | Optional | `America/Sao_Paulo` | IANA timezone used by the web date formatting and mapped to the API's `TimeZone__Id` setting for tenant-local report date boundaries. For example: `TIME_ZONE=America/Fortaleza`. |

### Feature Management & Demo Mode

| Variable | Required | Default | Description |
|---|---|---|---|
| `Demo__Enabled` | Optional | `false` | Enables demo endpoints and pre-seeded accounts |
| `Demo__SeedVersion` | Optional | `2` | Demo schema seed version |
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

Example file content:
```env
# Docker Compose environment variables
MYSQL_ROOT_PASSWORD=controleasy_root_dev
MYSQL_USER=controleasy
MYSQL_PASSWORD=controleasy_dev
JWT_SIGNING_KEY=a-very-long-and-secure-secret-key-at-least-32-chars-long!

# Photo storage
STORAGE__PROVIDER=Local
STORAGE__LOCAL__PATH=/storage/photos
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
  }
}
```

---

## Required vs Optional Settings

- **Critical Required Settings:**
  - `JWT_SIGNING_KEY`: The API will validate that this key is at least 32 characters long. Failing to provide a valid key will cause startup termination.
  - `MYSQL_PASSWORD` / `Db__Password`: Required for the API to establish database connectivity.
- **Optional Settings with Defaults:**
  - Port configurations (`REVERSE_PROXY_PORT=8080`, `API_PORT=8081`) have pre-configured fallbacks suitable for local development.
  - Storage provider defaults to `Local` with `/storage/photos` inside the container mounted to the `photos-data` Docker volume.

---

## Environment Overrides

### Development Mode
- Swagger UI enabled at `/swagger` and `/api/swagger`.
- Verbose logging to console and Seq.
- Automatic seeding of bootstrap PlatformAdmin with credentials logged at warning level.

### Demo Mode Overlay
Run with the demo compose overlay:
```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.demo.yml up -d --build
```
This automatically sets:
- `Demo__Enabled: "true"`
- `Jwt__SigningKey: "demo-signing-key-not-for-production-use!!"`
- Pre-seeded users with `demo123` passwords across two sample condominiums (`default` and `aurora`).

### Production Mode
- Set `ASPNETCORE_ENVIRONMENT=Production`.
- Swagger UI is automatically disabled.
- Ensure `JWT_SIGNING_KEY` is injected from a secure secret store (Docker secrets, HashiCorp Vault, AWS Secrets Manager).
- Configure TLS termination in Traefik or an external load balancer <!-- VERIFY: production SSL certificate path and domain routing -->.
