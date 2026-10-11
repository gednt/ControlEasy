namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

// Convenience aliases so consumers can name the contracts by intent rather
// than by file. The DeviceDetail and DeviceListItem records themselves live
// in DeviceDetail.cs.
public sealed record DeviceListItemDto(
    Guid Id,
    string DeviceType,
    string Vendor,
    Guid? GatehouseId,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);