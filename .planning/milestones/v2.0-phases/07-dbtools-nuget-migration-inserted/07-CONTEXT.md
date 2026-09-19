# Phase 7: DBTools NuGet Migration (INSERTED) - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — smart discuss skipped)

<domain>
## Phase Boundary

Replace vendored `src/lib/DBTools_SQL/` with official NuGet package [DBTools 1.4.3](https://www.nuget.org/packages/DBTools); simplify Docker build and dependency management. No behavior changes to repositories, interceptors, or tenant isolation.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Pin DBTools 1.4.3 via CPM; keep MySqlConnector pinned; verify TenantFilterInterceptor API compatibility before deleting vendor.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ControlEasyReborn.Infrastructure` wires DBTools via `AddDbTools` and `TenantAwareLinqFactory`
- `TenantFilterInterceptor` implements `IQueryInterceptor` for tenant-scoped SQL

### Established Patterns
- CPM in `src/Directory.Packages.props`; project refs use versionless `PackageReference`
- Docker API build copies vendored lib today — must switch to NuGet restore only

### Integration Points
- `ControlEasyReborn.Infrastructure.csproj` — sole project reference to vendored DBTools
- `docker/api.Dockerfile` — COPY line for vendored path
- `src/ControlEasyReborn.sln` — lib/DBTools_SQL solution folder

</code_context>

<specifics>
## Specific Ideas

Follow `.specs/dbtools-nuget-migration/` tasks 1–7 exactly. Update ADR 0002 and AGENTS.md to reference NuGet, not vendored source.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
