---
phase: 18
plan: 01
subsystem: Security / Infrastructure / Email
tags: [security, bcrypt, password-hasher, temp-password, email, mailkit, mailpit, migrations]
requires:
  - Phase 17 Gatehouse Panel & Reports Page
provides:
  - BCrypt work factor explicitly pinned to 11 in PasswordHasher
  - TempPasswordGenerator with unambiguous charset excluding 0/O/o and 1/l/I
  - IEmailSender abstraction in SharedKernel.Email
  - MailKitEmailSender and NoOpEmailSender in Infrastructure.Email
  - AddEmailInfrastructure DI registration with DemoOptions.DisableOutboundEmail support
  - Mailpit dev catch-all service in docker-compose.yml (SMTP 1025, Web UI 8025)
  - PasswordResetRequests MySQL migration and init DDL (0013 and 16)
affects:
  - 18-02 (Admin password reset endpoints and token revocation)
  - 18-03 (Forgot password self-service flow and frontend modals)
tech-stack:
  added:
    - MailKit 4.16.0
    - MimeKit 4.16.0
  patterns:
    - Central package version management via Directory.Packages.props
    - Clean Architecture abstraction (SharedKernel) and infrastructure implementation
    - Cryptographically secure RNG using RandomNumberGenerator.GetString
key-files:
  created:
    - src/BuildingBlocks/ControlEasyReborn.SharedKernel/Email/IEmailSender.cs
    - src/BuildingBlocks/ControlEasyReborn.SharedKernel/Email/SmtpOptions.cs
    - src/BuildingBlocks/ControlEasyReborn.Infrastructure/Email/MailKitEmailSender.cs
    - src/BuildingBlocks/ControlEasyReborn.Infrastructure/Email/NoOpEmailSender.cs
    - src/BuildingBlocks/ControlEasyReborn.Infrastructure/Email/EmailServiceCollectionExtensions.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Abstractions/ITempPasswordGenerator.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/TempPasswordGenerator.cs
    - docker/mysql/init/16-password-reset-requests.sql
    - docker/mysql/migrations/0013-password-reset-requests.sql
    - tests/ControlEasyReborn.UnitTests/Modules/Security/PasswordHasherTests.cs
    - tests/ControlEasyReborn.UnitTests/Modules/Security/TempPasswordGeneratorTests.cs
    - tests/ControlEasyReborn.UnitTests/Email/EmailSenderTests.cs
  modified:
    - src/Directory.Packages.props
    - src/BuildingBlocks/ControlEasyReborn.Infrastructure/ControlEasyReborn.Infrastructure.csproj
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/PasswordHasher.cs
    - src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/DI/SecurityModuleServiceCollectionExtensions.cs
    - src/Host/ControlEasyReborn.Api/Program.cs
    - docker/docker-compose.yml
    - docker/mysql/init/03-tenant-backfill.sql
decisions:
  - "Pinned PasswordHasher.WorkFactor = 11 to satisfy PASS-05 explicitly"
  - "Exposed ITempPasswordGenerator using RandomNumberGenerator.GetString with 12+ chars, ensuring digits, uppercase, lowercase, and symbols while strictly avoiding ambiguous glyphs (0, O, o, 1, l, I)"
  - "Used MailKit 4.16.0 and MimeKit 4.16.0 to avoid known NU1902 vulnerability advisories"
  - "Configured Mailpit service in Docker Compose for zero-credential dev email inspection at port 8025"
  - "Added PasswordResetRequests schema with tenant_id and durable state tracking for reset flows"
metrics:
  duration: ~20 min
  completed: 2026-09-19
status: complete
actuals:
  tasks: 5
  commits: 1
---

# Plan 18-01 Summary: Infrastructure & Security Primitives

Established the foundational infrastructure and cryptographic security primitives required for password management: hardened BCrypt hashing with pinned work factor ≥ 11, an unambiguous temporary password generator, email sender abstractions with MailKit adapter and Mailpit docker support, and database schema for password reset requests.

## Implementation Details

1. **BCrypt Work Factor Hardening (`PasswordHasher.cs`)**:
   - Explicitly defined `public const int WorkFactor = 11;` in `PasswordHasher`.
   - Updated hash generation to invoke `BCrypt.Net.BCrypt.HashPassword(password, workFactor: WorkFactor)`.
   - Added unit test `PasswordHasherTests` verifying work factor prefix (`$2[abxy]$11$`) and verify behavior.

2. **Unambiguous Temporary Password Generator (`TempPasswordGenerator.cs`)**:
   - Implemented `ITempPasswordGenerator` utilizing `RandomNumberGenerator.GetString` over unambiguous character classes.
   - Strictly excluded ambiguous characters (`0`, `O`, `o`, `1`, `l`, `I`) per `PASS-05`.
   - Enforces minimum 12-character length and guarantees inclusion of uppercase, lowercase, digit, and symbol characters.
   - Added unit test `TempPasswordGeneratorTests` covering character diversity, lack of ambiguous glyphs, and uniqueness.

3. **Email Abstraction & Infrastructure (`IEmailSender.cs`, `MailKitEmailSender.cs`, `NoOpEmailSender.cs`)**:
   - Created `IEmailSender` interface and `SmtpOptions` in `ControlEasyReborn.SharedKernel.Email`.
   - Implemented `MailKitEmailSender` in `ControlEasyReborn.Infrastructure.Email` with support for optional authentication and SSL settings.
   - Implemented `NoOpEmailSender` for demo mode (`Demo:DisableOutboundEmail = true`) and unit testing.
   - Registered infrastructure via `AddEmailInfrastructure` in `Program.cs`.
   - Added unit tests in `EmailSenderTests`.

4. **Docker Compose & Mailpit (`docker-compose.yml`)**:
   - Added `mailpit` service (`axllent/mailpit:latest`) with SMTP port 1025 and Web UI port 8025.
   - Configured `api` environment variables (`Smtp__Host`, `Smtp__Port`, `Smtp__SenderEmail`, `Smtp__SenderName`).

5. **Durable Storage Schema (`PasswordResetRequests`)**:
   - Created init script `16-password-reset-requests.sql` and migration `0013-password-reset-requests.sql`.
   - Fields: `Id`, `TenantId`, `UserId`, `NormalizedEmail`, `HashedTempPassword`, `DeliveryState`, `FailureReason`, `RequestedByUserId`, `CreatedAtUtc`, `DeliveredAtUtc`, `ExpiresAtUtc`, `tenant_id`.
   - Added marker line to `03-tenant-backfill.sql` satisfying the architecture backfill sync test.

6. **Verification**:
   - Fast CI verification gate (`scripts/verify-ci-local.ps1 -Fast`) passed with all 243 unit tests and 19 architecture tests passing.
