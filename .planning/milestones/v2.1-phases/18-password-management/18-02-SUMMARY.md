---
phase: 18
plan: 02
subsystem: Security / Administration / Passwords
tags: [security, password-reset, admin-reset, token-revocation, multi-tenancy, integration-tests]
requires:
  - Plan 18-01 (PasswordHasher WorkFactor 11, TempPasswordGenerator, PasswordResetRequests schema)
provides:
  - POST /api/v1/security/users/{userId}/reset-password endpoint
  - ResetUserPasswordHandler with platform admin & tenant admin authorization checks
  - Cross-tenant 403 Forbidden enforcement (never 404)
  - Automatic refresh token revocation for reset users
  - SecurityRedactionTests ensuring passwords and temp passwords are never logged
  - PasswordResetTests integration test suite with Testcontainers MySQL
affects:
  - 18-03 (Forgot password self-service flow and frontend modals)
tech-stack:
  added: []
  patterns:
    - Minimal API endpoint pattern mapped to scoped mediator handler
    - Multi-tenant permission validation (PlatformAdmin cross-tenant, TenantAdmin scoped to porteiros)
    - Architecture test for sensitive data redaction in structured logging
key-files:
  created:
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Domain/Entities/PasswordResetRequest.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Abstractions/IPasswordResetRequestRepository.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/PasswordResetRequestRepository.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/ResetUserPasswordHandler.cs
    - tests/ControlEasyReborn.ArchitectureTests/SecurityRedactionTests.cs
    - tests/ControlEasyReborn.UnitTests/Modules/Security/ResetUserPasswordHandlerTests.cs
    - tests/ControlEasyReborn.IntegrationTests/Security/PasswordResetTests.cs
  modified:
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Domain/Entities/User.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Errors/DomainExceptions.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Contracts/SecurityDtos.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/ControlEasyReborn.Modules.Security.Application.csproj
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/RefreshTokenRepository.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/DI/SecurityModuleServiceCollectionExtensions.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Api/Endpoints/SecurityEndpoints.cs
    - src/Host/ControlEasyReborn.Api/Program.cs
decisions:
  - "Added ForbiddenException to Security DomainExceptions and mapped to HTTP 403 in GlobalExceptionHandler"
  - "Enforced PASS-02 requirement: cross-tenant reset attempts return 403 Forbidden (not 404)"
  - "Enforced PASS-03 requirement: TenantAdmin can only reset porteiros/gatekeepers within their own tenant"
  - "Hardened RefreshTokenRepository.RevokeAllForUserAsync to use safe quote-interpolated parameters matching DBTools expectations"
  - "Created NetArchTest redaction test guaranteeing no handler or infrastructure logs passwords or temp passwords"
metrics:
  duration: ~25 min
  completed: 2026-09-19
status: complete
actuals:
  tasks: 5
  commits: 1
---

# Plan 18-02 Summary: Administrative Password Reset Endpoints & Token Revocation

Implemented administrative password reset capabilities for Platform Admins and Tenant Admins:
- `POST /api/v1/security/users/{userId}/reset-password`
- Platform Admin can reset any user across tenants; audit-logged.
- Tenant Admin can reset their own gatekeepers/attendants only (scoped to their own tenant); cross-tenant attempts receive 403 Forbidden.
- Atomically issues an unambiguous temporary password, re-arms `MustChangePassword = true`, persists `PasswordResetRequest`, and revokes all active refresh tokens for the user.
- Verified absence of cleartext password logging via architecture redaction test.

## Implementation Details

1. **Domain & Application Entities**:
   - Added `ResetPassword(string passwordHash)` to `User` entity, setting `MustChangePassword = true`.
   - Created `PasswordResetRequest` entity and `IPasswordResetRequestRepository` abstraction.
   - Created `ResetUserPasswordResponse` record in `SecurityDtos.cs`.
   - Added `ForbiddenException` mapped to HTTP 403 in `GlobalExceptionHandler`.

2. **Reset User Password Handler (`ResetUserPasswordHandler.cs`)**:
   - Checks caller context:
     - `PlatformAdmin`: authorized for all users across tenants.
     - `TenantAdmin`: target user must exist, must match caller's `TenantId` (otherwise returns 403 Forbidden), and must have `Porteiro` role (otherwise returns 403 Forbidden).
     - Others: 403 Forbidden.
   - Generates unambiguous 12-char temp password via `ITempPasswordGenerator`.
   - Hashes with `IPasswordHasher` (work factor 11).
   - Updates user password and `MustChangePassword = true`.
   - Inserts `PasswordResetRequest` row (`DeliveryState = Sent`).
   - Calls `RevokeAllForUserAsync(userId)`.
   - Logs audit event without sensitive parameters.

3. **Repository & Endpoint Registration**:
   - Created `PasswordResetRequestRepository` with DBTools.
   - Fixed `RefreshTokenRepository.RevokeAllForUserAsync` and `RevokeAsync`.
   - Registered endpoint in `SecurityEndpoints.cs` and DI extensions.

4. **Architecture & Unit Testing**:
   - `SecurityRedactionTests.cs`: Scans Security and Email codebase ensuring no logger statements log passwords or temp passwords.
   - `ResetUserPasswordHandlerTests.cs`: 6 unit tests covering all authorization permutations (forbidden caller, not found, cross-tenant 403, non-porteiro 403, tenant admin success, platform admin success).

5. **Integration Testing (`PasswordResetTests.cs`)**:
   - Tested full end-to-end flow with Testcontainers MySQL:
     - Platform Admin resets Tenant Admin user across tenants -> 200 OK, temp password login works, refresh token revoked.
     - Tenant Admin resets own Porteiro -> 200 OK, temp password login works.
     - Tenant Admin attempts cross-tenant reset -> 403 Forbidden.
     - Tenant Admin attempts non-porteiro reset -> 403 Forbidden.
     - Anonymous caller -> 401 Unauthorized.
