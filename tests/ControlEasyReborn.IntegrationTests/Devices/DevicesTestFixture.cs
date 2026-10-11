using System.Security.Cryptography;
using System.Text;
using ControlEasyReborn.Infrastructure.KeyDerivation;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

[CollectionDefinition("Devices Collection")]
public sealed class DevicesCollectionDefinition : ICollectionFixture<MySqlContainerFixture>;

[Collection("Devices Collection")]
public sealed class DevicesTestFixture : IAsyncLifetime
{
    private readonly MySqlContainerFixture _mySql;

    public MySqlContainerFixture MySql => _mySql;
    public TestcontainersWebApplicationFactory Factory { get; private set; } = null!;
    public Guid TenantId { get; private set; }
    public Guid DeviceId { get; private set; }
    public Guid ActorProfileId { get; private set; }
    public string ActorEmail { get; private set; } = "devices-tests@controleasy.local";
    public string TenantSecret => "CE-INT-TEST-DEVICE-HMAC-SECRET-V1-DETERMINISTIC-32B";

    public DevicesTestFixture(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
    }

    public Task InitializeAsync()
    {
        Factory = new TestcontainersWebApplicationFactory(_mySql);
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        Factory?.Dispose();
        return Task.CompletedTask;
    }

    public async Task SeedAsync()
    {
        TenantId = Guid.NewGuid();
        DeviceId = Guid.NewGuid();
        ActorProfileId = Guid.NewGuid();

        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();

        // Seed Tenants row with DoorIntegrationEnabled=1
        await using (var cmd = new MySqlCommand(
            @"INSERT INTO Tenants (Id, Slug, DisplayName, Status, CreatedAtUtc, DoorIntegrationEnabled)
              VALUES (@id, @slug, @name, 0, UTC_TIMESTAMP(6), 1)
              ON DUPLICATE KEY UPDATE DoorIntegrationEnabled = 1", conn))
        {
            cmd.Parameters.AddWithValue("@id", TenantId.ToString());
            cmd.Parameters.AddWithValue("@slug", $"devices-{TenantId:N}".Substring(0, 32));
            cmd.Parameters.AddWithValue("@name", "Devices Test Condo");
            await cmd.ExecuteNonQueryAsync();
        }

        // Seed a Devices row with a known ciphertext blob (encrypted under
        // tenant-derived key; only the existence of the row matters for the
        // unlock tests — we never need to decrypt it).
        await using (var cmd = new MySqlCommand(
            @"INSERT INTO Devices
                (Id, TenantId, DeviceType, Vendor, ConnectionParams, GatehouseId, IsActive, CreatedAtUtc, CreatedByProfileId, tenant_id)
              VALUES (@id, @tid, 'controller', 'simulated', @params, NULL, 1, UTC_TIMESTAMP(6), @actor, @tid)", conn))
        {
            cmd.Parameters.AddWithValue("@id", DeviceId.ToString());
            cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
            cmd.Parameters.AddWithValue("@params", new byte[] { 0x01, 0x02, 0x03, 0x04 });
            cmd.Parameters.AddWithValue("@actor", ActorProfileId.ToString());
            await cmd.ExecuteNonQueryAsync();
        }
    }

    public async Task SetDoorIntegrationEnabledAsync(bool enabled)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "UPDATE Tenants SET DoorIntegrationEnabled = @flag WHERE Id = @tid", conn);
        cmd.Parameters.AddWithValue("@flag", enabled ? 1 : 0);
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<int> CountDeviceUnlockAuditRowsAsync()
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM DeviceUnlockAudit WHERE tenant_id = @tid", conn);
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    public async Task<int> CountAuditRowsByOutcomeAsync(string outcome)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM DeviceUnlockAudit WHERE tenant_id = @tid AND ResponseOutcome = @outcome", conn);
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        cmd.Parameters.AddWithValue("@outcome", outcome);
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    public Task ResetSimulatorAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var state = scope.ServiceProvider.GetRequiredService<IDoorSimulatorState>();
        state.Reset(TenantId, DeviceId);
        return Task.CompletedTask;
    }

    // Per-tenant HMAC key. Computed deterministically via the same HKDF path
    // the handler uses — we re-derive from the master seed + tenant id.
    public byte[] GetTenantHmacKey()
    {
        var masterKey = Encoding.UTF8.GetBytes(GetMasterSeedForTest());
        var salt = TenantId.ToByteArray();
        var info = Encoding.UTF8.GetBytes("DOOR_UNLOCK_V1");
        var derived = new byte[32];
        HKDF.DeriveKey(HashAlgorithmName.SHA256, masterKey, derived, salt, info);
        return derived;
    }

    private string GetMasterSeedForTest()
    {
        var env = System.Environment.GetEnvironmentVariable("CE_MASTER_KEY_V1");
        return string.IsNullOrWhiteSpace(env)
            ? "CE-DEV-MASTER-KEY-V1-CHANGE-IN-PROD-32B-MIN!!"
            : env;
    }

    public DoorUnlockRequest BuildSignedRequest(string? nonceBase64Url = null, DateTime? timestamp = null)
    {
        return BuildSignedRequestForDevice(DeviceId, nonceBase64Url, timestamp);
    }

    public DoorUnlockRequest BuildSignedRequestForDevice(
        Guid targetDeviceId,
        string? nonceBase64Url = null,
        DateTime? timestamp = null)
    {
        var nonceBytes = RandomNumberGenerator.GetBytes(16);
        var nonce = nonceBase64Url ?? ToBase64Url(nonceBytes);

        var ts = (timestamp ?? DateTime.UtcNow).ToUniversalTime();
        var timestampIso = ts.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

        var bodyHash = new string('0', 64);

        var canonical = $"POST\n{targetDeviceId:D}\n{timestampIso}\n{nonce}\n{bodyHash}";
        var key = GetTenantHmacKey();
        using var hmac = new HMACSHA256(key);
        var sig = hmac.ComputeHash(Encoding.UTF8.GetBytes(canonical));
        var sigBase64 = ToBase64Url(sig);

        return new DoorUnlockRequest(
            Nonce: nonce,
            TimestampUtc: ts,
            Signature: sigBase64,
            BodyHash: bodyHash);
    }

    public DoorUnlockRequest BuildRequestWithWrongSignature()
    {
        var req = BuildSignedRequest();
        // Flip a byte in the signature to make it invalid.
        var bytes = FromBase64Url(req.Signature);
        bytes[0] ^= 0xFF;
        return req with { Signature = ToBase64Url(bytes) };
    }

    public DoorUnlockRequest BuildRequestWithExpiredTimestamp()
    {
        return BuildSignedRequest(timestamp: DateTime.UtcNow.AddSeconds(-90));
    }

    private static string ToBase64Url(byte[] bytes)
    {
        var b64 = Convert.ToBase64String(bytes);
        return b64.TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static byte[] FromBase64Url(string value)
    {
        var normalized = value.Replace('-', '+').Replace('_', '/');
        switch (normalized.Length % 4)
        {
            case 2: normalized += "=="; break;
            case 3: normalized += "="; break;
        }
        return Convert.FromBase64String(normalized);
    }
}