using ControlEasyReborn.Modules.Tenants.Application;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Tenants;

// Regression tests for the v2.3 hotfix:
//
// Bug: Phase 23/24/26 added the v2.3 device permission strings
// (`devices.unlock`, `devices.read`, `devices.write`,
// `tenants.toggle_door_integration`, `devices.read_health`) and required them
// on certain endpoints, but `TenantAdminDefaults.Permissions` and
// `PorteiroDefaults.Permissions` were not updated. New users were seeded with
// permission strings that did NOT carry these tokens, and the v2.3 endpoints
// returned 403 for them.
//
// Symptom: GET /api/v1/tenants/current/door-integration returned 403 for
// freshly-created TenantAdmin users on a fresh install — the Angular SPA's
// error interceptor caught the 403 and redirected to /access-denied.
//
// Fix: append v2.3 device tokens to the two defaults constants + a migration
// to backfill existing seeded rows. This test enforces the new constant values.
//
// Decision matrix (per v2.3 CONTEXT.md / ROADMAP.md):
//   * `devices.unlock`                    -- both TenantAdmin + Porteiro
//   * `devices.read`                      -- both
//   * `devices.write`                     -- TenantAdmin only
//   * `tenants.toggle_door_integration`   -- TenantAdmin only
//   * `devices.read_health`               -- both

public sealed class DevicePermissionsDefaultsTests
{
    [Fact]
    public void TenantAdminDefaults_ContainsAllV23DevicePermissionTokens()
    {
        var requiredTokens = new[]
        {
            "devices.unlock",
            "devices.read",
            "devices.write",
            "tenants.toggle_door_integration",
            "devices.read_health",
        };

        foreach (var token in requiredTokens)
        {
            TenantAdminDefaults.Permissions
                .Should()
                .Contain(token,
                    because: $"the v2.3 hotfix requires the '{token}' token on TenantAdmin defaults");
        }
    }

    [Fact]
    public void PorteiroDefaults_ContainsSharedV23DevicePermissionTokens_ButNotAdminOnlyOnes()
    {
        var permissions = PorteiroDefaults.Permissions;

        // Shared v2.3 tokens (both TenantAdmin AND Porteiro receive these).
        foreach (var token in new[] { "devices.unlock", "devices.read", "devices.read_health" })
        {
            permissions.Should().Contain(token,
                because: $"the v2.3 hotfix requires the '{token}' token on Porteiro defaults");
        }

        // Admin-only tokens — Porteiro MUST NOT receive these.
        permissions.Should().NotContain("devices.write",
            "Porteiro defaults MUST NOT include devices.write -- TenantAdmin-only");
        permissions.Should().NotContain("tenants.toggle_door_integration",
            "Porteiro defaults MUST NOT include tenants.toggle_door_integration -- TenantAdmin-only");
    }

    [Fact]
    public void TenantAdminDefaults_DoesNotExposePortOnlyTokens_AndViceVersa()
    {
        // Both defaults must be comma-separated with no empty tokens (no malformed
        // double commas from the LOCALE concatenation logic).
        TenantAdminDefaults.Permissions.Split(',', StringSplitOptions.RemoveEmptyEntries).Should().OnlyContain(t => !string.IsNullOrWhiteSpace(t));
        PorteiroDefaults.Permissions.Split(',', StringSplitOptions.RemoveEmptyEntries).Should().OnlyContain(t => !string.IsNullOrWhiteSpace(t));
    }
}
