using System.Data;
using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using MySqlConnector;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Persistence;

// Tenant-scoped persistence for device_heartbeats. One row per device
// (DeviceId UNIQUE). Heartbeat-derived Update/Delete methods are intentionally
// absent from the abstraction — the row is upserted by IngestHeartbeatHandler
// using INSERT ... ON DUPLICATE KEY UPDATE (atomic, idempotent per device).
// SetThresholdsAsync (per-device Configure flow) is the one sanctioned
// threshold-columns write: it never touches the heartbeat-derived columns.
public sealed class DeviceHeartbeatRepository : IDeviceHeartbeatRepository
{
    private const string TableName = "device_heartbeats";
    private const string Fields =
        "Id, DeviceId, TenantId, LastHeartbeatAtUtc, Status, ErrorCount, EventsSinceLastSuccess, OfflineAfterSeconds, ErrorRateThresholdPercent, UpdatedAtUtc, tenant_id";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public DeviceHeartbeatRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<DeviceHeartbeat?> GetAsync(Guid tenantId, Guid deviceId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "tenant_id = @param0 AND DeviceId = @param1",
            parameters: new object[] { tenantId, deviceId.ToString() },
            ct: ct);

        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<DeviceHeartbeat>> ListAsync(Guid tenantId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "tenant_id = @param0",
            parameters: new object[] { tenantId },
            ct: ct);

        return MapList(rows);
    }

    // Atomic upsert: INSERT ... ON DUPLICATE KEY UPDATE on the (DeviceId)
    // UNIQUE key. The Linq abstraction does not have a first-class upsert,
    // so we go raw ADO with parameterized SQL (injection-safe).
    public async Task UpsertAsync(DeviceHeartbeat heartbeat, CancellationToken ct)
    {
        await using var conn = new MySqlConnection(_factory.Create(_ctx).ConnectionString);
        await conn.OpenAsync(ct);

        // The Id is required by the table PK but the upsert is keyed on DeviceId.
        // On first ingestion, we use the entity's Id; on subsequent upserts, the
        // existing row's Id is preserved (the ON DUPLICATE branch doesn't touch Id).
        const string sql = @"
INSERT INTO device_heartbeats
  (Id, DeviceId, TenantId, LastHeartbeatAtUtc, Status, ErrorCount, EventsSinceLastSuccess, OfflineAfterSeconds, ErrorRateThresholdPercent, UpdatedAtUtc, tenant_id)
VALUES
  (@id, @deviceId, @tenantId, @lastHeartbeat, @status, @errorCount, @eventsSinceLastSuccess, @offlineAfterSeconds, @errorRateThreshold, @updatedAt, @tenantId)
ON DUPLICATE KEY UPDATE
  LastHeartbeatAtUtc = VALUES(LastHeartbeatAtUtc),
  Status = VALUES(Status),
  ErrorCount = VALUES(ErrorCount),
  EventsSinceLastSuccess = VALUES(EventsSinceLastSuccess),
  UpdatedAtUtc = VALUES(UpdatedAtUtc);";

        await using var cmd = new MySqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@id", heartbeat.Id.ToString());
        cmd.Parameters.AddWithValue("@deviceId", heartbeat.DeviceId.ToString());
        cmd.Parameters.AddWithValue("@tenantId", heartbeat.TenantId.ToString());
        cmd.Parameters.AddWithValue("@lastHeartbeat", heartbeat.LastHeartbeatAtUtc);
        cmd.Parameters.AddWithValue("@status", (int)heartbeat.Status);
        cmd.Parameters.AddWithValue("@errorCount", heartbeat.ErrorCount);
        cmd.Parameters.AddWithValue("@eventsSinceLastSuccess", heartbeat.EventsSinceLastSuccess);
        cmd.Parameters.AddWithValue("@offlineAfterSeconds", heartbeat.OfflineAfterSeconds);
        cmd.Parameters.AddWithValue("@errorRateThreshold", heartbeat.ErrorRateThresholdPercent);
        cmd.Parameters.AddWithValue("@updatedAt", heartbeat.UpdatedAtUtc);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    // Per-device Configure flow — the first production write path for the
    // threshold columns. Existing row: tenant-scoped UPDATE of ONLY the
    // threshold columns + UpdatedAtUtc (LastHeartbeatAtUtc / Status / counters
    // stay untouched so re-configuring a live device cannot corrupt the
    // rolling data). Absent row: sentinel INSERT so the health dashboard
    // surfaces the configured thresholds with a "never" heartbeat display.
    // Real ingest keeps the configured thresholds via UpsertAsync's ON
    // DUPLICATE branch, which deliberately excludes these columns
    // (carry-forward). The entity's threshold invariants must already have
    // been enforced by UpdateDeviceThresholdsValidator.
    public async Task SetThresholdsAsync(
        Guid tenantId,
        Guid deviceId,
        int offlineAfterSeconds,
        decimal errorRateThresholdPercent,
        CancellationToken ct)
    {
        await using var conn = new MySqlConnection(_factory.Create(_ctx).ConnectionString);
        await conn.OpenAsync(ct);
        var updatedAt = DateTime.UtcNow;

        const string updateSql = @"
UPDATE device_heartbeats
SET OfflineAfterSeconds = @offlineAfterSeconds,
    ErrorRateThresholdPercent = @errorRateThreshold,
    UpdatedAtUtc = @updatedAt
WHERE DeviceId = @deviceId AND tenant_id = @tenantId;";

        await using (var update = new MySqlCommand(updateSql, conn))
        {
            update.Parameters.AddWithValue("@offlineAfterSeconds", offlineAfterSeconds);
            update.Parameters.AddWithValue("@errorRateThreshold", errorRateThresholdPercent);
            update.Parameters.AddWithValue("@updatedAt", updatedAt);
            update.Parameters.AddWithValue("@deviceId", deviceId.ToString());
            update.Parameters.AddWithValue("@tenantId", tenantId.ToString());
            if (await update.ExecuteNonQueryAsync(ct) > 0)
            {
                return;
            }
        }

        // Absent row: sentinel INSERT so health shows the configured values
        // with last heartbeat "never" (truthful Offline display).
        const string insertSql = @"
INSERT INTO device_heartbeats
  (Id, DeviceId, TenantId, LastHeartbeatAtUtc, Status, ErrorCount, EventsSinceLastSuccess, OfflineAfterSeconds, ErrorRateThresholdPercent, UpdatedAtUtc, tenant_id)
VALUES
  (@id, @deviceId, @tenantId, @lastHeartbeat, @status, 0, 0, @offlineAfterSeconds, @errorRateThreshold, @updatedAt, @tenantId);";

        await using var insert = new MySqlCommand(insertSql, conn);
        insert.Parameters.AddWithValue("@id", Guid.NewGuid().ToString());
        insert.Parameters.AddWithValue("@deviceId", deviceId.ToString());
        insert.Parameters.AddWithValue("@tenantId", tenantId.ToString());
        insert.Parameters.AddWithValue("@lastHeartbeat", DeviceHeartbeat.SentinelLastHeartbeatAtUtc);
        insert.Parameters.AddWithValue("@status", (int)DeviceStatus.Offline);
        insert.Parameters.AddWithValue("@offlineAfterSeconds", offlineAfterSeconds);
        insert.Parameters.AddWithValue("@errorRateThreshold", errorRateThresholdPercent);
        insert.Parameters.AddWithValue("@updatedAt", updatedAt);
        await insert.ExecuteNonQueryAsync(ct);
    }

    private static DeviceHeartbeat? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<DeviceHeartbeat> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<DeviceHeartbeat>();
        var list = new List<DeviceHeartbeat>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static DeviceHeartbeat? MapRow(DataRow r)
    {
        var idStr = r["Id"]?.ToString();
        var deviceIdStr = r["DeviceId"]?.ToString();
        var tenantIdStr = r["TenantId"]?.ToString();
        if (string.IsNullOrEmpty(idStr) || string.IsNullOrEmpty(deviceIdStr) || string.IsNullOrEmpty(tenantIdStr))
        {
            return null;
        }

        return DeviceHeartbeat.Hydrate(
            id: Guid.Parse(idStr),
            deviceId: Guid.Parse(deviceIdStr),
            tenantId: Guid.Parse(tenantIdStr),
            lastHeartbeatAtUtc: Convert.ToDateTime(r["LastHeartbeatAtUtc"]),
            status: (DeviceStatus)Convert.ToInt32(r["Status"]),
            errorCount: Convert.ToInt32(r["ErrorCount"]),
            eventsSinceLastSuccess: Convert.ToInt32(r["EventsSinceLastSuccess"]),
            offlineAfterSeconds: Convert.ToInt32(r["OfflineAfterSeconds"]),
            errorRateThresholdPercent: Convert.ToDecimal(r["ErrorRateThresholdPercent"]),
            updatedAtUtc: Convert.ToDateTime(r["UpdatedAtUtc"]));
    }
}