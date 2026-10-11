namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

// Partial-update DTO for an existing device. ALL fields optional; a non-null
// ConnectionParams causes an atomic ciphertext rotation. GatehouseId=Guid.Empty
// is treated as null (clears the binding).
public sealed record EditDeviceRequest(
    string? Vendor,
    Guid? GatehouseId,
    System.Collections.Generic.IDictionary<string, object>? ConnectionParams);

// Activate/deactivate toggle (DOOR-06). Setting isActive=false ALSO sets
// RemovedAtUtc=now on the device (the soft-delete semantics — see Phase 24
// CONTEXT.md "Soft-delete semantics").
public sealed record SetDeviceActivationRequest(bool IsActive);