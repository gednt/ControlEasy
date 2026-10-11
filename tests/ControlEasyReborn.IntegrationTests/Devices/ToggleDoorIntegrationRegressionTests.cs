using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

// Regression tests for the v2.3 PUT toggle "false success" bug.
//
// Bug:
//   `PUT /api/v1/tenants/current/door-integration` returns HTTP 200 but
//   the Tenants row is NOT updated. The handler's SetAsync call goes
//   through DBTools.UpdateAsync which builds
//     `UPDATE Tenants SET DoorIntegrationEnabled='1',...,='2026-...',...='0000-...' WHERE Id = '1'`
//   instead of the intended WHERE Id = '<tenantId>'. MySQL receives the
//   inlined literal `'1'` and matches no row. The handler returns
//   successfully (because DBTools.UpdateAsync reports success when the
//   generated SQL executes without exception — not when 0 rows change).
//
// Root cause:
//   DBTools.UpdateAsync builds the SET clause from the `values` array
//   positionally and then auto-numbers @param tokens starting at @param0
//   for both SET and WHERE. With 3 SET values, the WHERE clause
//   placeholder `@param0` collides with the SET-value @param0, and the
//   WHERE-bound placeholder actually resolves to a parameter index that
//   corresponds to `values[0]` (the literal `'1'`) rather than the
//   caller's parameters[] array.
//
// Fix:
//   Use `@paramN` in the WHERE clause where N == values.Length. That
//   places the WHERE placeholder AFTER all SET-value placeholders, so
//   it binds to parameters[0] correctly.
//
// These tests verify the bug AND the fix end-to-end by reading the row
// back from MySQL directly (the existing Phase 24 integration test only
// asserted the GET response, which the bug masks because the API GET
// path reads the SAME stale row that the PUT failed to update).

[Collection("MySql Collection")]
public sealed class ToggleDoorIntegrationRegressionTests
{
    private readonly TestcontainersWebApplicationFactory _factory;
    private readonly MySqlContainerFixture _mySql;

    public ToggleDoorIntegrationRegressionTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
        _factory = new TestcontainersWebApplicationFactory(mySql);
    }

    [Fact]
    public async Task ToggleDoorIntegration_UpdatesTheActualRow_NotJustTheResponse()
    {
        // ARRANGE: insert a real tenant with a known Id + DoorIntegrationEnabled=0.
        var tenantId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        await SeedTenantAsync(tenantId, doorIntegrationEnabled: false);

        var client = _factory.CreateClient();
        var token = JwtTestHelper.GenerateToken(
            userId: userId,
            email: $"regr-toggle-{userId}@controleasy.test",
            tenantId: tenantId,
            profileId: profileId,
            roles: new[] { "TenantAdmin" },
            permissions: new[] { "devices.read", "devices.write", "tenants.toggle_door_integration", "devices.unlock", "devices.read_health" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // ACT — PUT to enable.
        var putResp = await client.PutAsJsonAsync(
            "/api/v1/tenants/current/door-integration",
            new { doorIntegrationEnabled = true });
        putResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // ASSERT — read back from MySQL DIRECTLY (not via the API).
        var row = await ReadTenantAsync(tenantId);
        row.DoorIntegrationEnabled.Should().BeTrue("PUT must update the row (existing Phase 24 test only checks the GET response, which the bug masks)");
        row.ChangedAtUtc.Should().NotBeNull("PUT must set DoorIntegrationChangedAtUtc");
        row.ChangedByProfileId.Should().Be(profileId, "PUT must set DoorIntegrationChangedByProfileId to the actor's profile");

        // ACT 2 — PUT back to false, verify it actually toggles back.
        var putBackResp = await client.PutAsJsonAsync(
            "/api/v1/tenants/current/door-integration",
            new { doorIntegrationEnabled = false });
        putBackResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var rowAfter = await ReadTenantAsync(tenantId);
        rowAfter.DoorIntegrationEnabled.Should().BeFalse("PUT(false) must round-trip after PUT(true)");
    }

    private async Task SeedTenantAsync(Guid tenantId, bool doorIntegrationEnabled)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            @"INSERT INTO Tenants (Id, Slug, DisplayName, Status, CreatedAtUtc, DoorIntegrationEnabled)
              VALUES (@id, @slug, @name, 0, UTC_TIMESTAMP(6), @enabled)", conn);
        cmd.Parameters.AddWithValue("@id", tenantId.ToString());
        cmd.Parameters.AddWithValue("@slug", $"regr-{tenantId:N}".Substring(0, 32));
        cmd.Parameters.AddWithValue("@name", "Toggle Regression Tenant");
        cmd.Parameters.AddWithValue("@enabled", doorIntegrationEnabled ? 1 : 0);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<TenantRow> ReadTenantAsync(Guid tenantId)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT DoorIntegrationEnabled, DoorIntegrationChangedAtUtc, DoorIntegrationChangedByProfileId FROM Tenants WHERE Id = @id", conn);
        cmd.Parameters.AddWithValue("@id", tenantId.ToString());
        await using var reader = await cmd.ExecuteReaderAsync();
        await reader.ReadAsync();
        var enabled = Convert.ToInt32(reader["DoorIntegrationEnabled"]) == 1;
        DateTime? changedAt = reader["DoorIntegrationChangedAtUtc"] is DBNull
            ? null
            : Convert.ToDateTime(reader["DoorIntegrationChangedAtUtc"]);
        Guid? changedBy = reader["DoorIntegrationChangedByProfileId"] is DBNull or null
            ? null
            : Guid.TryParse(reader["DoorIntegrationChangedByProfileId"].ToString(), out var g) ? g : null;
        return new TenantRow(enabled, changedAt, changedBy);
    }

    private sealed record TenantRow(bool DoorIntegrationEnabled, DateTime? ChangedAtUtc, Guid? ChangedByProfileId);
}
