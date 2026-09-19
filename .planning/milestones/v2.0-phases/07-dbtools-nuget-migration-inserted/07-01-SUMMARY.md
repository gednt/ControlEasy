---
phase: 07
plan: 01
completed: 2026-06-24
requirements_completed:
  - PLAT-01
---

# Summary 07-01: DBTools NuGet Swap

**Completed:** 2026-06-24

## What Changed

- Pinned `DBTools` 1.4.3 in `src/Directory.Packages.props`
- Swapped `ControlEasyReborn.Infrastructure` from vendored `<ProjectReference>` to `<PackageReference Include="DBTools" />`
- Removed `src/lib/DBTools_SQL/` and DBTools solution entries
- Removed vendored COPY from `docker/api.Dockerfile`
- Fixed `TenantFilterInterceptor` to use `@ctx_tenant` parameter name (NuGet API alignment)
- Updated unit test fakes/assertions for `IDbProvider.UsesTopNSyntax` and `@ctx_tenant`
- Updated ADR 0002, AGENTS.md, STACK.md, CONCERNS.md

## Verification

- `dotnet build src/ControlEasyReborn.sln` — pass
- Unit tests (79) + architecture tests (5) — pass
- Docker API image builds with NuGet restore — pass
- No `lib/DBTools` references in `src/` or `docker/`
