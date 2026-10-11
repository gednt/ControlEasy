using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// Tenant-scoped, paginated list of device_events rows. Used by the
// /api/v1/devices/{deviceId}/events admin GET endpoint. Returns the
// metadata-only projection (no payload_json) — the support path that
// returns the payload is gated separately + audit-logged.
public sealed class ListDeviceEventsHandler
{
    private readonly IDeviceEventRepository _events;
    private readonly IDeviceRepository _devices;

    public ListDeviceEventsHandler(IDeviceEventRepository events, IDeviceRepository devices)
    {
        _events = events;
        _devices = devices;
    }

    public async Task<IReadOnlyList<DeviceEventListItem>?> HandleAsync(
        Guid tenantId,
        Guid deviceId,
        DateTime? sinceUtc,
        int limit,
        CancellationToken ct)
    {
        var device = await _devices.GetByIdAsync(tenantId, deviceId, ct);
        if (device is null || device.IsRemoved) return null;

        var rows = await _events.ListAsync(tenantId, deviceId, sinceUtc, Math.Clamp(limit, 1, 500), ct);

        return rows
            .OrderByDescending(e => e.OccurredAtUtc)
            .Select(e => new DeviceEventListItem(
                e.Id,
                e.DeviceId,
                DeviceEventTypeCodes.ToWire(e.EventType),
                e.OccurredAtUtc,
                e.ProcessedAtUtc,
                e.SequenceNumber,
                e.ResultCode,
                e.FailureCode,
                e.VisitId,
                e.AccessEventId,
                e.RefusedScanAttemptId))
            .ToList();
    }
}
