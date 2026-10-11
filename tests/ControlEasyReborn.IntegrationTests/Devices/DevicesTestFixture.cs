using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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

    // Phase 25 — soft-delete helper. The Device is set to IsActive=false +
    // RemovedAtUtc=now so it returns DeviceInactive from ingest.
    public async Task SoftDeleteDeviceAsync()
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "UPDATE Devices SET IsActive=0, RemovedAtUtc=UTC_TIMESTAMP(6) WHERE Id=@id AND tenant_id=@tid", conn);
        cmd.Parameters.AddWithValue("@id", DeviceId.ToString());
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        await cmd.ExecuteNonQueryAsync();
    }

    // Phase 25 — count device_events rows for this tenant.
    public async Task<int> CountDeviceEventsAsync(string? resultCode = null)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        var sql = resultCode is null
            ? "SELECT COUNT(*) FROM device_events WHERE tenant_id=@tid"
            : "SELECT COUNT(*) FROM device_events WHERE tenant_id=@tid AND ResultCode=@rc";
        await using var cmd = new MySqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        if (resultCode is not null) cmd.Parameters.AddWithValue("@rc", resultCode);
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    // Phase 25 — count AccessEvents rows for this tenant (Used to verify
    // single-write-path: device event ingestion always flows through the
    // RecordAccessScanHandler which writes one row per accepted scan).
    public async Task<int> CountAccessEventsAsync()
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM AccessEvents WHERE tenant_id=@tid", conn);
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    // Phase 25 — count refused-scan rows.
    public async Task<int> CountRefusedScanAttemptsAsync(string? failureCode = null)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        var sql = failureCode is null
            ? "SELECT COUNT(*) FROM RefusedScanAttempts WHERE tenant_id=@tid"
            : "SELECT COUNT(*) FROM RefusedScanAttempts WHERE tenant_id=@tid AND FailureCode=@fc";
        await using var cmd = new MySqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        if (failureCode is not null) cmd.Parameters.AddWithValue("@fc", failureCode);
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    // Phase 25 — count Visits rows for this tenant.
    public async Task<int> CountVisitsAsync()
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM Visits WHERE tenant_id=@tid", conn);
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    public async Task<int> CountProfileAsync(Guid profileId)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM Profiles WHERE Id=@id AND tenant_id=@tid", conn);
        cmd.Parameters.AddWithValue("@id", profileId.ToString());
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    // Phase 25 — Build a CardRead payload with optional simulator token + sequence number.
    public DeviceEventPayload BuildCardReadPayload(string? opaqueToken = null, long? sequenceNumber = null, Guid? externalEventId = null)
    {
        return new DeviceEventPayload(
            EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.CardRead,
            OccurredAtUtc: DateTime.UtcNow.AddSeconds(-1),
            SequenceNumber: sequenceNumber ?? 1,
            ExternalEventId: externalEventId ?? Guid.NewGuid(),
            OpaqueToken: opaqueToken ?? $"sim-test-resident-{Guid.NewGuid():N}",
            PayloadJson: "{}");
    }

    // Phase 26 — Build a Heartbeat payload with optional error counters.
    public DeviceEventPayload BuildHeartbeatPayload(int errorCount = 0, int eventsSinceLastSuccess = 1)
    {
        var payload = $"{{\"error_count\":{errorCount},\"events_since_last_success\":{eventsSinceLastSuccess}}}";
        return new DeviceEventPayload(
            EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.Heartbeat,
            OccurredAtUtc: DateTime.UtcNow,
            SequenceNumber: 1,
            ExternalEventId: Guid.NewGuid(),
            OpaqueToken: null,
            PayloadJson: payload);
    }

    // Phase 26 — Seed a synthetic device_heartbeats row directly via SQL.
    // The integration tests need to control the LastHeartbeatAtUtc + Status
    // columns for dashboard assertions without going through the live
    // heartbeat pipeline (which races the 5-minute freshness window).
    public async Task SeedHeartbeatRowAsync(
        Guid deviceId,
        DateTime lastHeartbeatAtUtc,
        int status,
        int errorCount = 0,
        int eventsSinceLastSuccess = 10,
        int offlineAfterSeconds = 60,
        decimal errorRateThresholdPercent = 10.00m)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            @"INSERT INTO device_heartbeats
              (Id, DeviceId, TenantId, LastHeartbeatAtUtc, Status, ErrorCount, EventsSinceLastSuccess,
               OfflineAfterSeconds, ErrorRateThresholdPercent, UpdatedAtUtc, tenant_id)
              VALUES (@id, @did, @tid, @last, @status, @ec, @ess, @ofs, @ertp, UTC_TIMESTAMP(6), @tid)
              ON DUPLICATE KEY UPDATE
                LastHeartbeatAtUtc = VALUES(LastHeartbeatAtUtc),
                Status = VALUES(Status),
                ErrorCount = VALUES(ErrorCount),
                EventsSinceLastSuccess = VALUES(EventsSinceLastSuccess),
                OfflineAfterSeconds = VALUES(OfflineAfterSeconds),
                ErrorRateThresholdPercent = VALUES(ErrorRateThresholdPercent),
                UpdatedAtUtc = VALUES(UpdatedAtUtc)",
            conn);
        cmd.Parameters.AddWithValue("@id", Guid.NewGuid().ToString());
        cmd.Parameters.AddWithValue("@did", deviceId.ToString());
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        cmd.Parameters.AddWithValue("@last", lastHeartbeatAtUtc);
        cmd.Parameters.AddWithValue("@status", status);
        cmd.Parameters.AddWithValue("@ec", errorCount);
        cmd.Parameters.AddWithValue("@ess", eventsSinceLastSuccess);
        cmd.Parameters.AddWithValue("@ofs", offlineAfterSeconds);
        cmd.Parameters.AddWithValue("@ertp", errorRateThresholdPercent);
        await cmd.ExecuteNonQueryAsync();
    }

    // Phase 26 — Seed a synthetic second Device under the same tenant so the
    // dashboard-list tests have multiple devices to enumerate.
    public async Task SeedSecondDeviceAsync(Guid? newDeviceId = null, string vendor = "Intelbras", bool isActive = true, bool isRemoved = false)
    {
        var did = newDeviceId ?? Guid.NewGuid();
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            @"INSERT INTO Devices
              (Id, TenantId, DeviceType, Vendor, ConnectionParams, GatehouseId, IsActive, CreatedAtUtc, CreatedByProfileId, RemovedAtUtc, tenant_id)
              VALUES (@id, @tid, 'reader', @vendor, @params, NULL, @active, UTC_TIMESTAMP(6), @actor, @removed, @tid)",
            conn);
        cmd.Parameters.AddWithValue("@id", did.ToString());
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        cmd.Parameters.AddWithValue("@vendor", vendor);
        cmd.Parameters.AddWithValue("@params", new byte[] { 0x05, 0x06, 0x07, 0x08 });
        cmd.Parameters.AddWithValue("@active", isActive ? 1 : 0);
        cmd.Parameters.AddWithValue("@actor", ActorProfileId.ToString());
        cmd.Parameters.AddWithValue("@removed", isRemoved ? (object)DateTime.UtcNow : DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<int> CountDeviceHeartbeatsAsync(int? status = null)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        var sql = status.HasValue
            ? "SELECT COUNT(*) FROM device_heartbeats WHERE tenant_id=@tid AND Status=@s"
            : "SELECT COUNT(*) FROM device_heartbeats WHERE tenant_id=@tid";
        await using var cmd = new MySqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        if (status.HasValue) cmd.Parameters.AddWithValue("@s", status.Value);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    public async Task<DateTime?> GetHeartbeatLastSeenAsync(Guid deviceId)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT LastHeartbeatAtUtc FROM device_heartbeats WHERE DeviceId=@did AND tenant_id=@tid",
            conn);
        cmd.Parameters.AddWithValue("@did", deviceId.ToString());
        cmd.Parameters.AddWithValue("@tid", TenantId.ToString());
        var result = await cmd.ExecuteScalarAsync();
        return result is null || result is DBNull ? null : Convert.ToDateTime(result);
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
