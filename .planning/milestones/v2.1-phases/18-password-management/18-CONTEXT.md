# Phase 18 Context: Password Management

## Purpose
Phase 18 implements secure, enumeration-safe password recovery and administrative password reset capabilities across ControlEasy Reborn. It introduces an email delivery abstraction (`IEmailSender`) with MailKit and Mailpit in dev, hardens BCrypt password hashing to work factor ≥ 11, enables self-service temporary password requests for admins (TenantAdmin, PlatformAdmin) with timing-attack immunity and rate limits, allows Platform Admins and Tenant Admins to reset credentials with immediate refresh token revocation and forced change on next login, and guarantees transactional delivery safety.

## Requirements
- **PASS-01**: Login-screen "Forgot my password" flow for admins (TenantAdmin, PlatformAdmin) — temporary password delivered via SMTP email; enumeration-safe (uniform response body + constant-cost decoy verify); rate-limited (named ASP.NET Core 8 policy partitioned on normalized email + durable per-account counter)
- **PASS-02**: Platform admin can reset any user's password from the condominium management page — generates a one-time temp password, re-arms `MustChangePassword`, revokes the user's refresh tokens, audit-logged; cross-tenant attempts get 403 (not 404)
- **PASS-03**: Tenant admin can reset their own gatekeepers' passwords — same temp-password + `MustChangePassword` + revocation semantics, scoped to own tenant
- **PASS-04**: Delivery safety — hashed temp password + delivery state (Pending/Sent/Failed) persisted in the same transaction as the hash change; idempotent resend re-delivers the same temp password; temp passwords never logged (redaction arch test); accounts never locked out in response to reset floods
- **PASS-05**: Password hashing uses BCrypt with work factor pinned explicitly ≥ 11; temp passwords generated via `RandomNumberGenerator.GetString` with an unambiguous charset (no 0/O/o, 1/l/I)
- **INFRA-01**: `IEmailSender` abstraction + MailKit SMTP adapter; Mailpit dev catch-all service in docker-compose (SMTP 1025 / UI 8025); demo mode sends nothing (`Demo.DisableOutboundEmail` no-op sender); SMTP config via environment variables

## Execution Plans
- `18-01-PLAN.md`: Infrastructure & Security Primitives — `IEmailSender` + MailKit SMTP adapter, Mailpit dev container service, demo no-op sender, BCrypt work factor ≥ 11, unambiguous temp password generator, and `PasswordResetRequests` table migration (INFRA-01, PASS-05, PASS-04 primitives).
- `18-02-PLAN.md`: Administrative Password Reset Endpoints & Token Revocation — Platform Admin and Tenant Admin reset endpoints (`POST /api/v1/security/users/{userId}/reset-password`), `MustChangePassword` re-arming, `RevokeAllForUserAsync` refresh token revocation, cross-tenant 403 checks, audit logging, redaction arch tests (PASS-02, PASS-03, PASS-04).
- `18-03-PLAN.md`: Self-Service Forgot Password & Frontend Flows — `POST /api/v1/security/auth/forgot-password`, enumeration-safe uniform response + constant-cost decoy verify, rate limiting on normalized email, login screen "Forgot my password" modal/page, and user management reset action buttons (PASS-01, PASS-04).
