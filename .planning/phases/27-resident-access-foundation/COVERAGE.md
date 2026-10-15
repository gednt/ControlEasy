# Phase 27 — API Coverage

**Status:** No external API integration.

**Reason:** Phase 27 is entirely in-repo authorization-surface work. All load-bearing primitives already exist in the codebase — `IAsyncSqlClient`/`ITenantAwareLinqFactory` (DBTools 1.4.3), `JwtTokenService` (HMAC-SHA256, pinned via `Microsoft.AspNetCore.Authentication.JwtBearer` 8.0.10), `IPasswordHasher` (BCrypt.Net-Next 4.0.3, work factor 11), `ITempPasswordGenerator`, `IRefreshTokenRepository.RevokeAllForUserAsync`, Testcontainers.MySql, NetArchTest.Rules 1.3.2. Zero new NuGet or npm packages; zero third-party/external HTTP or SDK integrations (see 27-RESEARCH.md `## Package Legitimacy Audit` — empty table, and `## Standard Stack` note: "No new NuGet or npm packages are required").

The api-coverage detector's single signal ("integration endpoint") is a false positive from prose in the ROADMAP Phase 27 success criteria ("negative integration suite (resident JWTs refused on every existing staff endpoint class...)" — "integration" here is the GSD test-type, not an external API integration verb).