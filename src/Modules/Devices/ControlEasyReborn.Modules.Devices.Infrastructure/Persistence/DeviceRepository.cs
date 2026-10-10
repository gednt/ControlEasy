using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Persistence;

public sealed class DeviceRepository : IDeviceRepository
{
    private const string TableName = "Devices";
    private const string Fields =
        "Id, TenantId, DeviceType, Vendor, ConnectionParams, GatehouseId, IsActive, CreatedAtUtc, UpdatedAtUtc, CreatedByProfileId";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public DeviceRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<Device?> GetByIdAsync(Guid tenantId, Guid deviceId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "Id = @param0 AND tenant_id = @param1",
            parameters: new object[] { deviceId, tenantId },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<Device>> ListAsync(Guid tenantId, bool? isActive, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var parameters = new List<object>();
        var where = "tenant_id = @param0";
        parameters.Add(tenantId);
        if (isActive.HasValue)
        {
            where += " AND IsActive = @param" + parameters.Count;
            parameters.Add(isActive.Value ? 1 : 0);
        }

        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: where,
            parameters: parameters.ToArray(),
            ct: ct);
        return MapList(rows);
    }

    public async Task InsertAsync(Device device, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        await db.InsertAsync(
            new[]
            {
                "Id", "TenantId", "DeviceType", "Vendor", "ConnectionParams", "GatehouseId",
                "IsActive", "CreatedAtUtc", "UpdatedAtUtc", "CreatedByProfileId", "tenant_id"
            },
            TableName,
            new object?[]
            {
                device.Id,
                device.TenantId,
                device.DeviceType,
                device.Vendor,
                device.ConnectionParamsCiphertext,
                (object?)device.GatehouseId?.ToString() ?? DBNull.Value,
                device.IsActive ? 1 : 0,
                device.CreatedAtUtc,
                (object?)device.UpdatedAtUtc ?? DBNull.Value,
                device.CreatedByProfileId,
                device.TenantId
            },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    public async Task UpdateAsync(Device device, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var updated = await db.UpdateAsync(
            new[] { "DeviceType", "Vendor", "ConnectionParams", "GatehouseId", "IsActive", "UpdatedAtUtc" },
            TableName,
            new[]
            {
                device.DeviceType,
                device.Vendor,
                Convert.ToBase64String(device.ConnectionParamsCiphertext),
                device.GatehouseId?.ToString() ?? string.Empty,
                device.IsActive ? "1" : "0",
                FormatDateTime(device.UpdatedAtUtc)!
            },
            "Id = @param0 AND tenant_id = @param1",
            new object[] { device.Id, device.TenantId },
            ct: ct);

        if (!updated || !string.IsNullOrEmpty(db.Error))
            throw new InvalidOperationException($"Failed to update device {device.Id}. {db.Error}");
    }

    private static string? FormatDateTime(DateTime? value) =>
        value.HasValue ? value.Value.ToString("yyyy-MM-dd HH:mm:ss.ffffff") : null;

    private static Device? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<Device> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<Device>();
        var list = new List<Device>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static Device? MapRow(DataRow r)
    {
        var idStr = r["Id"]?.ToString();
        if (string.IsNullOrEmpty(idStr)) return null;
        var tenantIdStr = r["TenantId"]?.ToString();
        if (string.IsNullOrEmpty(tenantIdStr)) return null;

        var connParams = r["ConnectionParams"] as byte[];
        if (connParams is null || connParams.Length == 0) return null;

        var gatehouseStr = r["GatehouseId"]?.ToString();
        var createdByStr = r["CreatedByProfileId"]?.ToString();
        if (string.IsNullOrEmpty(createdByStr)) return null;

        var updatedStr = r["UpdatedAtUtc"]?.ToString();

        return new Device(
            id: Guid.Parse(idStr),
            tenantId: Guid.Parse(tenantIdStr),
            deviceType: r["DeviceType"]?.ToString() ?? string.Empty,
            vendor: r["Vendor"]?.ToString() ?? string.Empty,
            connectionParamsCiphertext: connParams,
            gatehouseId: string.IsNullOrEmpty(gatehouseStr) ? null : Guid.Parse(gatehouseStr),
            isActive: Convert.ToInt32(r["IsActive"]) == 1,
            createdByProfileId: Guid.Parse(createdByStr),
            createdAtUtc: Convert.ToDateTime(r["CreatedAtUtc"]),
            updatedAtUtc: string.IsNullOrEmpty(updatedStr) ? null : DateTime.Parse(updatedStr, null, System.Globalization.DateTimeStyles.RoundtripKind));
    }
}