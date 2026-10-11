using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[CollectionDefinition("AccessControl Collection")]
public sealed class AccessControlCollectionDefinition : ICollectionFixture<AccessControlFixture>, ICollectionFixture<MySqlContainerFixture>;

[Collection("AccessControl Collection")]
public sealed class AccessControlFixture : IAsyncLifetime
{
    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => Task.CompletedTask;

    public static async Task<Guid> SeedGatehouseAsync(
        string connectionString,
        Guid tenantId,
        CancellationToken ct = default)
    {
        var id = Guid.NewGuid();
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new MySqlCommand(
            "INSERT INTO Gatehouses (Id, TenantId, Name, tenant_id) " +
            "VALUES (@id, @tid, 'Integration test gatehouse', @tid)", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        await cmd.ExecuteNonQueryAsync(ct);
        return id;
    }

    public static async Task<Guid> SeedActiveApartmentAsync(string connectionString, Guid tenantId, string block, string unit, CancellationToken ct = default)
    {
        var id = Guid.NewGuid();
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new MySqlCommand(
            "INSERT INTO Apartments (Id, TenantId, Block, Unit, Active, CreatedAtUtc, tenant_id) " +
            "VALUES (@id, @tid, @block, @unit, 1, UTC_TIMESTAMP(6), @tid)", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@block", block);
        cmd.Parameters.AddWithValue("@unit", unit);
        await cmd.ExecuteNonQueryAsync(ct);
        return id;
    }

    public static async Task<Guid> SeedActiveResidentAsync(
        string connectionString,
        Guid tenantId,
        string name,
        string cpf,
        Guid? apartmentId,
        CancellationToken ct = default)
    {
        var id = Guid.NewGuid();
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new MySqlCommand(
            "INSERT INTO Residents (Id, TenantId, Name, Cpf, Email, Phone, ApartmentId, Active, CreatedAtUtc, tenant_id) " +
            "VALUES (@id, @tid, @name, @cpf, NULL, NULL, @apt, 1, UTC_TIMESTAMP(6), @tid)", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@name", name);
        cmd.Parameters.AddWithValue("@cpf", cpf);
        cmd.Parameters.AddWithValue("@apt", (object?)apartmentId?.ToString() ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
        return id;
    }

    public static async Task<Guid> SeedActiveVehicleAsync(
        string connectionString,
        Guid tenantId,
        string plate,
        Guid? apartmentId,
        Guid? ownerResidentId,
        CancellationToken ct = default)
    {
        var id = Guid.NewGuid();
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new MySqlCommand(
            "INSERT INTO Vehicles (Id, TenantId, Plate, Brand, Model, Color, ApartmentId, OwnerResidentId, OwnerName, VehicleType, Active, CreatedAtUtc, tenant_id) " +
            "VALUES (@id, @tid, @plate, NULL, NULL, NULL, @apt, @owner, NULL, 0, 1, UTC_TIMESTAMP(6), @tid)", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@plate", plate);
        cmd.Parameters.AddWithValue("@apt", (object?)apartmentId?.ToString() ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@owner", (object?)ownerResidentId?.ToString() ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
        return id;
    }

    public static async Task<Guid> SeedActiveCredentialAsync(
        string connectionString,
        Guid tenantId,
        SubjectType subjectType,
        Guid subjectId,
        byte[] verifier,
        int keyVersion,
        Guid issuedByProfileId,
        CancellationToken ct = default)
    {
        var id = Guid.NewGuid();
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = new MySqlCommand(
            "INSERT INTO AccessCredentials " +
            "(Id, TenantId, SubjectType, SubjectId, Method, SecretVerifier, KeyVersion, Status, ValidFromUtc, ExpiresAtUtc, ReplacedByCredentialId, IssuedByProfileId, CreatedAtUtc, tenant_id) " +
            "VALUES (@id, @tid, @subjT, @subjI, 0, @verifier, @kv, 0, UTC_TIMESTAMP(6), NULL, NULL, @actor, UTC_TIMESTAMP(6), @tid)", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@subjT", (int)subjectType);
        cmd.Parameters.AddWithValue("@subjI", subjectId.ToString());
        cmd.Parameters.AddWithValue("@verifier", verifier);
        cmd.Parameters.AddWithValue("@kv", keyVersion);
        cmd.Parameters.AddWithValue("@actor", issuedByProfileId.ToString());
        await cmd.ExecuteNonQueryAsync(ct);
        return id;
    }

    public static async Task<int> CleanupAccessControlAsync(string connectionString, Guid tenantId, CancellationToken ct = default)
    {
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync(ct);

        await using (var cmd = new MySqlCommand(
            "DELETE FROM AccessLookupAudits WHERE tenant_id = @tid", conn))
        {
            cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await using (var cmd = new MySqlCommand(
            "DELETE FROM RefusedScanAttempts WHERE tenant_id = @tid", conn))
        {
            cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await using (var cmd = new MySqlCommand(
            "DELETE FROM AccessEvents WHERE tenant_id = @tid", conn))
        {
            cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await using (var cmd = new MySqlCommand(
            "DELETE FROM CredentialLifecycleActions WHERE tenant_id = @tid", conn))
        {
            cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await using (var cmd = new MySqlCommand(
            "DELETE FROM AccessCredentials WHERE tenant_id = @tid", conn))
        {
            cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
            return await cmd.ExecuteNonQueryAsync(ct);
        }
    }
}
