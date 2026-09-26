---
phase: 19-ledger-reports-polish
plan: 04
type: summary
date: 2026-09-26
status: complete
requirements: [LEDGER-05]
commit: 2b41c6f
---

# Plan 19-04 — X-Total-Count CORS exposure (LEDGER-05) — Summary

## Outcome

Non-same-origin consumers (e.g. the SPA on `http://localhost:4200`) can read
the `X-Total-Count` response header on `GET /api/v1/reports/history`, so
ledger pagination totals work beyond the same-origin case.

## Changes

- `src/Host/ControlEasyReborn.Api/Program.cs:172` — added
  `.WithExposedHeaders("X-Total-Count")` to the existing `AngularDev` CORS
  policy. The policy's origin list, `AllowAnyHeader()`, `AllowAnyMethod()`,
  and `AllowCredentials()` are unchanged.
- `tests/ControlEasyReborn.IntegrationTests/ReportEndpointTests.cs` — new
  `History_exposes_XTotalCount_via_AccessControlExposeHeaders` integration
  test seeds a visit, sends `GET /api/v1/reports/history` with
  `Origin: http://localhost:4200`, and asserts both that `X-Total-Count` is
  present (≥ 1) AND that the `Access-Control-Expose-Headers` response header
  contains `X-Total-Count`.

## Plan-vs-implementation deviation (important)

The plan prescribed the endpoint-level extension form
`.WithExposedHeaders("X-Total-Count")` on the `/history` `MapGet` chain.
That API **does not exist** in .NET 8.0 SDK (verified by inspecting
`Microsoft.AspNetCore.Cors.xml` doc-comments — `CorsEndpointConventionBuilderExtensions`
in .NET 8 only contains `RequireCors<T>(...)` overloads). The endpoint-level
form was added in .NET 9.

The correct fix for .NET 8 is the policy-level `WithExposedHeaders` on
`CorsPolicyBuilder` (which DOES exist in 8.0), which is what was applied
instead. The end-result is identical:
- `Access-Control-Expose-Headers: X-Total-Count` is emitted on responses to
  allowed origins (`http://localhost:4200`, `https://localhost:8443`).
- The exposure is scoped to a single named header, not `*` — no widening of
  the response-header exposure surface.

This deviation was forced by the stack; the success criterion ("non-same-
origin consumers receive the header") still holds.

## Verification

- Per-turn fast gate (`scripts/verify-ci-local.ps1 -Fast`):
  - Stage 2: Release build succeeded
  - Stage 3: UnitTests 252/252, ArchitectureTests 20/20
- Integration test (Testcontainers MySQL, full gate stage 4 only): not run
  per turn per AGENTS.md cadence; will be exercised by the task-completion
  full gate.

## Files Changed

- 2 files: 1 production (Program.cs), 1 test (ReportEndpointTests.cs)
- +32 / −1 lines

## Notes

- Other endpoints (`/visit-counts-by-day`, `/residents-per-apartment`) do
  NOT carry `X-Total-Count`, so they are unaffected.
- `AllowCredentials()` is required for the SPA's JWT cookie flow and was
  already on the policy; combined with `WithExposedHeaders("X-Total-Count")`,
  the browser can now read the total on a credentialed cross-origin request.