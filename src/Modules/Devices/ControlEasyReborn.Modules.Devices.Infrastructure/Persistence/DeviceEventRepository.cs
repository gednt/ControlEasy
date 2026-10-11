using System.Data;
using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using MySqlConnector;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Persistence;

// Tenant-scoped, append-only persistence for device_events. Update and
// Delete methods are intentionally absent (DOOR-09): the repository
// surface exposes only InsertAsync + GetByIdempotencyKeyAsync +
// GetByIdAsync + ListAsync.
//
// Idempotency: the underlying table carries
//   UNIQUE KEY uq_device_events_idempotent (tenant_id, DeviceId, SequenceNumber, ExternalEventId)
// On a redelivery that violates the constraint the MySQL errno 1062
// propagates as MySqlException.ErrorCode -> MySqlErrorCode.DuplicateKeyEntry
// which we translate to DuplicateIdempotencyKeyException so the
// IngestDeviceEventHandler can short-circuit cleanly.
public sealed class DeviceEventRepository : IDeviceEventRepository
{
    private const string TableName = "device_events";
    private const string Fields =
        "Id, TenantId, DeviceId, EventType, PayloadJson, OccurredAtUtc, ProcessedAtUtc, SequenceNumber, ExternalEventId, ResultCode, FailureCode, VisitId, AccessEventId, RefusedScanAttemptId, CorrelationId, tenant_id";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public DeviceEventRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task InsertAsync(DeviceEvent deviceEvent, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        try
        {
            await db.InsertAsync(
                new[]
                {
                    "Id", "TenantId", "DeviceId", "EventType", "PayloadJson",
                    "OccurredAtUtc", "ProcessedAtUtc", "SequenceNumber", "ExternalEventId",
                    "ResultCode", "FailureCode", "VisitId", "AccessEventId",
                    "RefusedScanAttemptId", "CorrelationId", "tenant_id"
                },
                TableName,
                new object?[]
                {
                    deviceEvent.Id,
                    deviceEvent.TenantId,
                    deviceEvent.DeviceId,
                    DeviceEventTypeCodes.ToWire(deviceEvent.EventType),
                    deviceEvent.PayloadJson,
                    deviceEvent.OccurredAtUtc,
                    deviceEvent.ProcessedAtUtc,
                    deviceEvent.SequenceNumber,
                    (object?)deviceEvent.ExternalEventId?.ToString() ?? DBNull.Value,
                    deviceEvent.ResultCode,
                    (object?)deviceEvent.FailureCode ?? DBNull.Value,
                    (object?)deviceEvent.VisitId?.ToString() ?? DBNull.Value,
                    (object?)deviceEvent.AccessEventId?.ToString() ?? DBNull.Value,
                    (object?)deviceEvent.RefusedScanAttemptId?.ToString() ?? DBNull.Value,
                    deviceEvent.CorrelationId,
                    deviceEvent.TenantId
                },
                primaryKeyName: "Id",
                autoIncrement: false,
                ct: ct);
        }
        catch (MySqlException mex) when (mex.ErrorCode == MySqlErrorCode.DuplicateKeyEntry)
        {
            throw new DuplicateIdempotencyKeyException(
                $"device_events idempotency UNIQUE violation for tenant={deviceEvent.TenantId} device={deviceEvent.DeviceId} seq={deviceEvent.SequenceNumber} ext={deviceEvent.ExternalEventId}.");
        }
    }

    public async Task<DeviceEvent?> GetByIdempotencyKeyAsync(Guid tenantId, Guid deviceId, long sequenceNumber, Guid? externalEventId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var whereClause = externalEventId.HasValue
            ? "tenant_id = @param0 AND DeviceId = @param1 AND SequenceNumber = @param2 AND ExternalEventId = @param3"
            : "tenant_id = @param0 AND DeviceId = @param1 AND SequenceNumber = @param2 AND ExternalEventId IS NULL";
        var parameters = externalEventId.HasValue
            ? new object[] { tenantId, deviceId, sequenceNumber, externalEventId.Value.ToString() }
            : new object[] { tenantId, deviceId, sequenceNumber };

        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: whereClause,
            parameters: parameters,
            ct: ct);

        return MapFirstOrDefault(rows);
    }

    public async Task<DeviceEvent?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "tenant_id = @param0 AND Id = @param1",
            parameters: new object[] { tenantId, id.ToString() },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<DeviceEvent>> ListAsync(Guid tenantId, Guid deviceId, DateTime? sinceUtc, int limit, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var whereClause = sinceUtc.HasValue
            ? "tenant_id = @param0 AND DeviceId = @param1 AND OccurredAtUtc >= @param2"
            : "tenant_id = @param0 AND DeviceId = @param1";
        var parameters = sinceUtc.HasValue
            ? new object[] { tenantId, deviceId, sinceUtc.Value }
            : new object[] { tenantId, deviceId };

        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: whereClause,
            parameters: parameters,
            ct: ct);

        return MapList(rows)
            .OrderByDescending(e => e.OccurredAtUtc)
            .Take(Math.Max(limit, 1))
            .ToList();
    }

    private static DeviceEvent? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<DeviceEvent> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<DeviceEvent>();
        var list = new List<DeviceEvent>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static DeviceEvent? MapRow(DataRow r)
    {
        var idStr = r["Id"]?.ToString();
        if (string.IsNullOrEmpty(idStr)) return null;

        var deviceEventTypeStr = r["EventType"]?.ToString() ?? "";
        if (!DeviceEventTypeCodes.TryParse(deviceEventTypeStr, out var eventType)) return null;

        var externalEventIdStr = r["ExternalEventId"]?.ToString();
        var visitIdStr = r["VisitId"]?.ToString();
        var accessEventIdStr = r["AccessEventId"]?.ToString();
        var refusedScanIdStr = r["RefusedScanAttemptId"]?.ToString();

        return DeviceEvent.Hydrate(
            id: Guid.Parse(idStr),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            deviceId: Guid.Parse(r["DeviceId"].ToString() ?? string.Empty),
            eventType: eventType,
            payloadJson: r["PayloadJson"]?.ToString() ?? "{}",
            occurredAtUtc: Convert.ToDateTime(r["OccurredAtUtc"]),
            processedAtUtc: Convert.ToDateTime(r["ProcessedAtUtc"]),
            sequenceNumber: Convert.ToInt64(r["SequenceNumber"]),
            externalEventId: string.IsNullOrEmpty(externalEventIdStr) ? null : Guid.Parse(externalEventIdStr),
            resultCode: r["ResultCode"]?.ToString() ?? string.Empty,
            failureCode: r.Table.Columns.Contains("FailureCode") ? r["FailureCode"]?.ToString() : null,
            visitId: string.IsNullOrEmpty(visitIdStr) ? null : Guid.Parse(visitIdStr),
            accessEventId: string.IsNullOrEmpty(accessEventIdStr) ? null : Guid.Parse(accessEventIdStr),
            refusedScanAttemptId: string.IsNullOrEmpty(refusedScanIdStr) ? null : Guid.Parse(refusedScanIdStr),
            correlationId: Guid.Parse(r["CorrelationId"].ToString() ?? string.Empty));
    }
}
