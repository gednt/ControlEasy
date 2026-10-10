using FluentAssertions;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

// Proves the BEFORE UPDATE / BEFORE DELETE triggers on DeviceUnlockAudit
// reject all mutation attempts. Control case: insert succeeds.
[Collection("Devices Collection")]
public sealed class DeviceUnlockAuditTriggerTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;
    private Guid _insertedAuditId = Guid.Empty;

    public DeviceUnlockAuditTriggerTests(MySqlContainerFixture mySql) => _fx = new DevicesTestFixture(mySql);

    public async Task InitializeAsync()
    {
        await _fx.InitializeAsync();
        await _fx.SeedAsync();
        _insertedAuditId = Guid.NewGuid();
        await InsertAuditRowAsync(_insertedAuditId, outcome: "Success");
    }

    public Task DisposeAsync() => _fx.DisposeAsync();

    private async Task InsertAuditRowAsync(Guid id, string outcome)
    {
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            @"INSERT INTO DeviceUnlockAudit
                (Id, TenantId, DeviceId, ActorProfileId, CommandHash, OccurredAtUtc, ResponseOutcome, CommandNonce, CorrelationId, tenant_id)
              VALUES (@id, @tid, @did, @actor, @hash, UTC_TIMESTAMP(6), @outcome, @nonce, @cid, @tid)", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@tid", _fx.TenantId.ToString());
        cmd.Parameters.AddWithValue("@did", _fx.DeviceId.ToString());
        cmd.Parameters.AddWithValue("@actor", _fx.ActorProfileId.ToString());
        cmd.Parameters.AddWithValue("@hash", new string('a', 64));
        cmd.Parameters.AddWithValue("@outcome", outcome);
        cmd.Parameters.AddWithValue("@nonce", Guid.NewGuid().ToString());
        cmd.Parameters.AddWithValue("@cid", Guid.NewGuid().ToString());
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task AuditInsert_Succeeds()
    {
        var beforeCount = await CountAuditRowsAsync();
        var newId = Guid.NewGuid();
        await InsertAuditRowAsync(newId, "Success");
        var afterCount = await CountAuditRowsAsync();
        (afterCount - beforeCount).Should().Be(1);
    }

    [Fact]
    public async Task AuditUpdate_IsRejected_WithSignal45000()
    {
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();

        await using var cmd = new MySqlCommand(
            "UPDATE DeviceUnlockAudit SET ResponseOutcome = 'Tampered' WHERE Id = @id", conn);
        cmd.Parameters.AddWithValue("@id", _insertedAuditId.ToString());

        var act = async () => await cmd.ExecuteNonQueryAsync();
        var exception = await act.Should().ThrowAsync<MySqlException>();
        exception.Which.Number.Should().Be(1644);
        exception.Which.Message.Should().Contain("append-only");
    }

    [Fact]
    public async Task AuditDelete_IsRejected_WithSignal45000()
    {
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();

        await using var cmd = new MySqlCommand(
            "DELETE FROM DeviceUnlockAudit WHERE Id = @id", conn);
        cmd.Parameters.AddWithValue("@id", _insertedAuditId.ToString());

        var act = async () => await cmd.ExecuteNonQueryAsync();
        var exception = await act.Should().ThrowAsync<MySqlException>();
        exception.Which.Number.Should().Be(1644);
        exception.Which.Message.Should().Contain("append-only");
    }

    private async Task<int> CountAuditRowsAsync()
    {
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM DeviceUnlockAudit WHERE tenant_id = @tid", conn);
        cmd.Parameters.AddWithValue("@tid", _fx.TenantId.ToString());
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }
}