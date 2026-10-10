using ControlEasyReborn.Modules.Devices.Domain.Entities;

namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Append-only. No Update/Delete methods exist on this abstraction by design —
// the devices.DeviceUnlockAudit table enforces the same rule via BEFORE UPDATE /
// BEFORE DELETE triggers at the MySQL layer. Mirrors the ConsentAuditLog pattern.
public interface IDeviceUnlockAuditRepository
{
    Task InsertAsync(DeviceUnlockAudit audit, CancellationToken ct);
}