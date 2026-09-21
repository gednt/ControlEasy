---
phase: 18
plan: 03
subsystem: Security / Auth / Passwords / Frontend
tags: [security, forgot-password, rate-limiting, timing-attacks, enumeration-safe, angular, ui-reset]
requires:
  - Plan 18-01 (PasswordHasher WorkFactor 11, TempPasswordGenerator, PasswordResetRequests schema)
  - Plan 18-02 (Admin reset endpoints, PasswordResetRequest entity, RefreshToken revocation)
provides:
  - POST /api/v1/security/auth/forgot-password endpoint with enumeration-safe response
  - Constant-time decoy BCrypt verification on email miss/inactive/non-admin accounts
  - ASP.NET Core 8 partitioned rate limiter on normalized email ('forgot-password' policy)
  - Durable account counter check suppressing email floods without locking out accounts
  - Idempotent resend of valid temporary passwords via IMemoryCache (15-minute window)
  - Login page 'Forgot password?' accessible modal dialog and submission flow
  - Condominiums page admin & porteiro table reset password action buttons with temporary password copy modal
  - Comprehensive unit and integration test coverage across backend and frontend
affects:
  - Phase 18 complete
tech-stack:
  added:
    - Microsoft.Extensions.Caching.Abstractions (8.0.0)
  patterns:
    - Constant-time decoy password verification against user enumeration
    - Partitioned rate limiting using ASP.NET Core 8 AddRateLimiter
    - In-memory short-lived caching for idempotent credential resend without MySQL plaintext storage
    - Accessible Angular modal dialogs with standalone components and reactive signals
key-files:
  created:
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/ForgotPasswordHandler.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Validators/ForgotPasswordRequestValidator.cs
    - src/Web/ControlEasyReborn.Web/src/app/features/auth/login.page.spec.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/platform/condominiums.page.spec.ts
    - tests/ControlEasyReborn.UnitTests/Modules/Security/ForgotPasswordHandlerTests.cs
  modified:
    - src/Directory.Packages.props
    - src/Host/ControlEasyReborn.Api/Program.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Api/Endpoints/SecurityEndpoints.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Contracts/SecurityDtos.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/ControlEasyReborn.Modules.Security.Application.csproj
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/DI/SecurityModuleServiceCollectionExtensions.cs
    - src/Web/ControlEasyReborn.Web/src/app/core/services/auth.service.ts
    - src/Web/ControlEasyReborn.Web/src/app/core/services/security-api.service.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/auth/login.page.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/platform/condominiums.page.ts
    - tests/ControlEasyReborn.IntegrationTests/Security/PasswordResetTests.cs
decisions:
  - "Used static DecoyHash with work factor 11 to guarantee constant-time execution on unknown/non-admin/inactive users"
  - "Configured ASP.NET Core 8 rate limiter with 'forgot-password' policy partitioned on normalized email from buffered body"
  - "Implemented durable recent request counter check to suppress reset floods without locking out accounts"
  - "Stored active temporary passwords in IMemoryCache (15-min TTL) to satisfy idempotent resend without storing cleartext in MySQL"
  - "Created accessible modal dialogs for login forgot password and condominiums admin/porteiro temporary password display"
metrics:
  duration: ~30 min
  completed: 2026-09-19
status: complete
actuals:
  tasks: 5
  commits: 1
---

# Plan 18-03 Summary: Self-Service Forgot Password & Frontend Reset Flows

Implemented self-service forgot password recovery for administrators and frontend password management workflows:
- `POST /api/v1/security/auth/forgot-password` endpoint.
- Restricted to admin roles (`TenantAdmin`, `PlatformAdmin`).
- Protected against timing and enumeration attacks via constant-time decoy BCrypt hashing and uniform HTTP 200 responses (`"If an account matches that email, instructions have been sent."`).
- Protected against abuse via ASP.NET Core 8 partitioned rate limiting (`forgot-password` policy) and durable account counters.
- Idempotent temporary password resend via short-lived memory cache without storing cleartext in MySQL.
- Full frontend UI on login page and condominiums management page.

## Implementation Details

1. **ForgotPassword Handler (`ForgotPasswordHandler.cs`)**:
   - Validates input email using `ForgotPasswordRequestValidator`.
   - Checks if user exists, is active, and possesses an admin role (`TenantAdmin` or `PlatformAdmin`).
   - If user does not exist or is ineligible: executes constant-cost `PasswordHasher.Verify(DecoyPassword, DecoyHash)` to match execution timing of valid accounts, then returns the uniform response.
   - If eligible admin:
     - Checks durable reset request counter (`CountRecentRequestsAsync`) over the last 15 minutes. If threshold exceeded, logs warning and returns uniform response without sending new emails and without locking the account.
     - Checks `IMemoryCache` for an existing unexpired temporary password. Reuses it if present; otherwise generates an unambiguous 12-char temporary password via `ITempPasswordGenerator`.
     - Hashes password with BCrypt work factor 11, updates user entity, sets `MustChangePassword = true`, revokes all active refresh tokens, and records `PasswordResetRequest`.
     - Dispatches email via `IEmailSender`. In case of delivery failure, marks `PasswordResetRequest.DeliveryState = Failed` without failing the request.

2. **Rate Limiting & Endpoint (`Program.cs` & `SecurityEndpoints.cs`)**:
   - Configured `AddRateLimiter` with policy `"forgot-password"` partitioned on normalized email, limiting requests to 3 attempts per 15 minutes.
   - Mapped `POST /api/v1/security/auth/forgot-password` with `.AllowAnonymous().RequireRateLimiting("forgot-password")`.

3. **Frontend Flows**:
   - `login.page.ts`: Added "Forgot password?" link, accessible dialog modal with email input, loading state, error display, and uniform success message.
   - `condominiums.page.ts`: Added "Reset pw" action buttons in both Administrator and Porteiro tables. Displays confirmation prompt followed by a modal dialog with the temporary password and "Copy to clipboard" button.
   - Service layers (`auth.service.ts`, `security-api.service.ts`) wired to invoke the respective endpoints.

4. **Testing & Verification**:
   - `ForgotPasswordHandlerTests.cs`: 8 unit tests covering validation failures, unknown users, non-admin users, inactive users, success, idempotent reuse, flood suppression, and SMTP failures.
   - `PasswordResetTests.cs`: 3 integration tests running against Testcontainers MySQL validating admin reset email persistence, uniform response for unknown users, and 429 rate limit enforcement.
   - `login.page.spec.ts` & `condominiums.page.spec.ts`: Angular component specs for dialog interactions, clipboard actions, and service calls.
   - Full verification gate (`scripts/verify-ci-local.ps1`) PASSED (unit tests, integration tests, Angular production build, OpenAPI drift check).
