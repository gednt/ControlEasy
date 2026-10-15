<!-- generated-by: gsd-doc-writer -->
# Testing Guide — ControlEasy Reborn

This guide covers the testing strategy, frameworks, execution instructions, and test creation standards for ControlEasy Reborn.

## Testing Strategy & Frameworks

The testing suite is designed to ensure strict adherence to Clean Architecture boundaries, multi-tenant data isolation, business logic correctness, and frontend UI accessibility.

### Frameworks Overview

| Layer | Framework & Tools | Project / Directory |
|---|---|---|
| **Unit Testing** | xUnit 2.9.2, FluentAssertions 8.2.0, NSubstitute 5.1.0 | `tests/ControlEasyReborn.UnitTests/` |
| **Architecture Rules** | NetArchTest.Rules 1.3.2 | `tests/ControlEasyReborn.ArchitectureTests/` |
| **Integration Testing** | xUnit + Testcontainers.MySql 4.0.0 + in-process API hosting (`Microsoft.AspNetCore.Mvc.Testing`) | `tests/ControlEasyReborn.IntegrationTests/` |
| **Frontend Unit** | Karma + Jasmine + ChromeHeadless | `src/Web/ControlEasyReborn.Web/` (`src/**/*.spec.ts`) |
| **E2E** | Playwright ^1.49.0 | `src/Web/ControlEasyReborn.Web/e2e/` |
| **Accessibility** | Playwright + `@axe-core/playwright` ^4.11.3 | `src/Web/ControlEasyReborn.Web/tests/a11y/` |
| **Visual Regression** | Playwright screenshots (`toHaveScreenshot`) | `src/Web/ControlEasyReborn.Web/tests/visual/` |

All Playwright suites (E2E, a11y, visual) are picked up by the single `playwright.config.ts` in `src/Web/ControlEasyReborn.Web/`, which matches `e2e/**/*.spec.ts` and `tests/**/*.spec.ts`.

---

## Running Tests

### 1. Backend Tests (.NET)

Run tests inside the container environment or devcontainer:

```bash
# Run unit tests across all 11 feature modules
dotnet test tests/ControlEasyReborn.UnitTests

# Run Clean Architecture boundary & rule validation
dotnet test tests/ControlEasyReborn.ArchitectureTests

# Run database integration tests using Docker Testcontainers
dotnet test tests/ControlEasyReborn.IntegrationTests
```

To run unit tests followed by integration tests:

```bash
make test
```

> Note: the `make test` target runs `ControlEasyReborn.UnitTests` then `ControlEasyReborn.IntegrationTests` (integration failures are currently tolerated, not fatal). Architecture tests must be run separately.

### 2. Frontend Unit Tests (Angular)

From `src/Web/ControlEasyReborn.Web`:
```bash
# Run Karma tests once in headless mode
npm test -- --no-watch --browsers=ChromeHeadless

# Run Karma in continuous watch mode during development
npm test
```

### 3. End-to-End, Accessibility & Visual Tests (Playwright)

Prerequisite: the dev/demo stack must be running (`make up`), since the Playwright global setup polls the login API at the configured base URL (`https://localhost:8443` by default; override with `E2E_BASE_URL`). Admin credentials come from `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` (defaults: `admin@controleasy.app` / `demo123`).

From `src/Web/ControlEasyReborn.Web`:
```bash
# Install required browser binaries
npm run e2e:install

# Run the full Playwright suite (E2E + a11y + visual)
npm run e2e
```

- `e2e/*.spec.ts` — end-to-end flows (first-boot login & platform bootstrap, module pages, residents, vehicles, visits, apartments, gatehouse, photo capture/list, devices incl. device-simulator and virtual-door UI, access control lifecycle, platform condominiums).
- `tests/a11y/*.spec.ts` — axe-core scans (login, dashboard, administration, devices-health, showcase); fails on serious/critical WCAG 2.x violations.
- `tests/visual/*.spec.ts` — screenshot regression suites (login, dashboard, showcase, vehicles, visits, administration, administration-doors-disabled, devices-health, gatehouse-offline-toast); snapshots live in `tests/visual/__snapshots__/`.

---

## Writing New Tests

### Unit Tests
- Follow the **Arrange-Act-Assert (AAA)** pattern.
- Test names use the snake_case behavior style `method_or_behavior_with_scenario_and_expected_outcome` (e.g., `HandleAsync_with_valid_request_creates_apartment`).
- Mock out-of-process and infrastructural dependencies using `NSubstitute` (e.g., `Substitute.For<IResidentRepository>()`). The tenant-aware LINQ factory is the exception: use the hand-written fake `FakeTenantAwareLinqFactory : ITenantAwareLinqFactory` wrapping a `FakeAsyncSqlClient` (see `PhotoRepositoryTests.cs`, `ResidentRepositoryTests.cs`).
- Shared test doubles live in `tests/ControlEasyReborn.UnitTests/TestDoubles/` (e.g., `FakeAsyncSqlClient`).
- Never perform database I/O in unit test assemblies.
- Test files mirror the module structure under `tests/ControlEasyReborn.UnitTests/Modules/<Feature>/`.

### Architecture Tests
- Located in `tests/ControlEasyReborn.ArchitectureTests/`.
- Verify architectural invariants using `NetArchTest.Rules` plus reflection-based checks. Existing suites enforce:
  - Domain layers must not depend on Infrastructure (layer dependency rules).
  - Infrastructure must not reference EF Core or `MySql.Data`.
  - Tenant isolation: non-platform domain entities must have a non-nullable `TenantId`; cross-tenant integration tests must be named/nested accordingly (`TenantIdPropertyTests.cs`, `CrossTenantTestNamingTests.cs`, `AccessControlTenantRulesTests.cs`).
  - Security redaction: Security and Email code must never log passwords or temp passwords.
  - Schema sync: MySQL init scripts/DDL stay in sync with schema backfill expectations (`SchemaBackfillSyncTests.cs`).
  - AccessControl constitution compliance (no DBTools in Application/Api, no raw SQL, no biometric keywords, no sensitive PII logging, no MVC controllers/MediatR/Moq).
  - Tokens contract: light/dark design tokens must exist in the Angular theme.

Example rule definition (matching the existing style — sealed class, assembly filtering, snake_case test name):

```csharp
public sealed class LayerDependencyTests
{
    [Fact]
    public void Domain_projects_should_not_reference_Infrastructure()
    {
        var domainAssemblies = AppDomain.CurrentDomain.GetAssemblies()
            .Where(a => a.GetName().Name?.EndsWith(".Domain") == true
                        && a.GetName().Name?.StartsWith("ControlEasyReborn") == true)
            .ToArray();

        var result = Types.InAssemblies(domainAssemblies)
            .ShouldNot()
            .HaveDependencyOnAny(
                "ControlEasyReborn.Modules.Residents.Infrastructure",
                "ControlEasyReborn.Modules.Tenants.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue();
    }
}
```

### Integration Tests
- Located in `tests/ControlEasyReborn.IntegrationTests/`.
- Use `Testcontainers.MySql` to spin up a genuine MySQL 8 container during test execution.
- API endpoints are exercised in-process via `TestcontainersWebApplicationFactory` / `TenantAwareWebApplicationFactory` (built on `Microsoft.AspNetCore.Mvc.Testing`) against the containerized database.
- Tests execute real DBTools LINQ queries and migrations against a live database instance to catch SQL syntax, constraint, or provider issues before deployment.
- Set `CE_ITEST_MYSQL` to point at an already-running MySQL instance and bypass container spawn.

### Angular Component Tests
- Test standalone components using `TestBed.configureTestingModule()`.
- Use signals for mock inputs and outputs.
- Verify template interactions and accessibility attributes.

---

## Coverage Requirements

No coverage threshold configured.

---

## Continuous Integration (CI)

### GitHub Actions (`.github/workflows/ci.yml`)

The workflow triggers on pull requests and pushes to `main`/`master` and runs the following jobs:

| Job | Trigger | Tasks Executed |
|---|---|---|
| `lint` | PR / Push to main | `npm run lint`, `npm test -- --no-watch --browsers=ChromeHeadlessNoSandbox`; `dotnet format --verify-no-changes` runs only when the changed diff contains `.cs` files |
| `build` | PR / Push to main | `dotnet build`, Tokens contract tests (`--filter TokensContract`), `ng build --configuration production` |
| `test-fast` | PR / Push to main | Unit tests + NetArchTest architecture tests (excluding `TokensContract`) |
| `test-integration` | PR / Push to main | Integration tests with cached `mysql:8.0` Testcontainers image |
| `openapi` | PR / Push to main | In-process API boot, `swagger.json` generation, `ng-openapi-gen` drift check (`git diff --exit-code -- src/app/api`) |
| `docker` | Push to main, after tests (currently disabled via `if: false`) | Multi-stage Docker image builds and GHCR publishing |

All checks must be green before merging into `main`.

### Local CI Gate (`scripts/verify-ci-local.sh`)

The same verification can be run locally before pushing. The full gate executes six stages:

1. C# format check (`dotnet format --verify-no-changes`)
2. Release build
3. Unit + architecture tests
4. Integration tests (Testcontainers MySQL; Docker socket bound)
5. Angular production Docker build
6. OpenAPI client drift check (`ng-openapi-gen`)

Stages run inside Docker containers (`mcr.microsoft.com/dotnet/sdk:8.0`, `mcr.microsoft.com/dotnet/aspnet:8.0`, `node:20-slim`; stages 1–4 share a single SDK container) with named cache volumes (`ce-nuget-packages`, `ce-npm-cache`). Host-side requirements are minimal: the Docker CLI plus standard tools already present on dev machines (`git`, `curl`, `id`, `uname`) — no .NET SDK or Node.js install needed on the host.

```bash
# Full 6-stage gate (required before task completion)
./scripts/verify-ci-local.sh        # or: make verify-ci

# Fast gate — stages 1–3 only (format, build, unit + arch tests)
./scripts/verify-ci-local.sh --fast

# Selective skips
./scripts/verify-ci-local.sh --skip-integration --skip-docker --skip-openapi
```

On Windows, use the PowerShell equivalent `scripts/verify-ci-local.ps1`. A passing full run stamps the repo (`ci-local-passed.stamp`) so the result rolls over on commit without re-running slow Docker stages.