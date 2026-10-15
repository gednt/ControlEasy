# Demo Mode — ControlEasy Reborn

One-command stack with pre-populated sample data, fixed credentials, and UI indicators for sales demos, training, and local smoke testing.

## Quick start

From the repository root:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.demo.yml up -d --build
```

Open [https://localhost:8443](https://localhost:8443) (accept the self-signed certificate warning) and sign in with any persona below (password **`demo123`** for all).

Verify demo mode is active:

```bash
curl -sk https://localhost:8443/api/v1/demo/info
# → {"enabled":true,"seedVersion":2,"tenants":[...]}
```

## Demo condominiums

| Display name | Slug | Residents |
|---|---|---|
| `[Demo] Residencial Aurora` | `demo-aurora` | 61 thematic characters (Chaves, GTA, God of War Greek era + Atreus) |
| `[Demo] Condomínio Parque Verde` | `demo-parque-verde` | 6 secondary characters (multi-tenant picker demo) |

## Demo personas

| Email | Password | Role | Tenant(s) |
|---|---|---|---|
| `platform@controleasy.app` | `demo123` | PlatformAdmin | Platform |
| `admin@controleasy.app` | `demo123` | TenantAdmin | `[Demo] Residencial Aurora` |
| `porteiro@controleasy.app` | `demo123` | Attendant (portaria) | `[Demo] Residencial Aurora` |
| `morador@controleasy.app` | `demo123` | Morador | `[Demo] Residencial Aurora` |
| `multi@controleasy.app` | `demo123` | TenantAdmin + Attendant | Aurora **and** Parque Verde → tenant picker |

## Suggested walkthrough

1. Sign in as **`porteiro@controleasy.app`** / `demo123`.
2. Open **Residents** and search for **Kratos**, **Chaves**, or **Zeus** — Aurora has 61 themed residents.
3. Confirm cohabitation: apt **8** has Dona Florinda, Quico, and Prof. Girafales; **Sparta-1** has Kratos and Atreus.
4. Browse **Visits**, **Vehicles**, and **Service providers** for recent sample activity.
5. Sign out and sign in as **`multi@controleasy.app`** — select between the two `[Demo]` condominiums.
6. Sign in as **`platform@controleasy.app`** and open **Platform → Condominiums** to register or manage condominiums.

In-app help: when demo mode is active, use **Help → Demo guide** (`/help/demo`) for this table and reset instructions.

## Platform administration (demo)

Sign in as **`platform@controleasy.app`** / `demo123`, then open **Platform → Condominiums** (`/platform/condominiums`).

From this screen you can:

- View all condominiums on the platform (including the two demo tenants and the default tenant)
- Register a new condominium (slug + display name)
- Create the first tenant administrator during registration (email, display name, and password are required)
- Suspend or resume a condominium

For the normal (non-demo) stack, the same screen is available after PlatformAdmin first-boot login. See [Getting Started](GETTING-STARTED.md).

## Reset procedures

### Local full reset (recommended)

Destroys the database volume and re-seeds on next startup:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.demo.yml down -v
docker compose -f docker/docker-compose.yml -f docker/docker-compose.demo.yml up -d --build
```

### API reset (PlatformAdmin, demo mode only)

Restores demo tenant data without dropping the volume:

```bash
curl -k -X POST https://localhost:8443/api/v1/demo/reset \
  -H "Authorization: Bearer <platform-admin-jwt>"
```

Returns **204 No Content** on success. Returns **404** when demo mode is disabled.

### Force re-seed on startup

Bump the seed version in `docker-compose.demo.yml`:

```yaml
Demo__SeedVersion: "3"
```

Then recreate the API container.

## Normal development stack (demo off)

Default compose does **not** enable demo mode:

```bash
docker compose -f docker/docker-compose.yml up -d
```

- `GET /api/v1/demo/info` returns `{"enabled":false}`.
- Demo users are **not** seeded.
- `PlatformAdminBootstrapService` creates a random PlatformAdmin (check API logs).

See also: [Getting Started (first boot)](GETTING-STARTED.md) for the full normal-stack walkthrough.

## Security warning

The demo overlay sets a **well-known JWT signing key** (`demo-signing-key-not-for-production-use!!`). **Never** deploy `docker/docker-compose.demo.yml` to production or any environment with real data. Demo credentials are public by design.

Outbound email is disabled in demo mode (`Demo__DisableOutboundEmail=true`).
