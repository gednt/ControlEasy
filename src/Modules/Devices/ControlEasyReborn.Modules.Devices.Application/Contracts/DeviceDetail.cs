namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

// Connection params are encrypted at rest and never returned in plaintext.
// The server sends a redaction marker with the ciphertext's last-4-byte
// fingerprint so the admin can recognize the connection without seeing it.
public sealed record RedactedConnectionParams(bool Redacted, string Last4);

// Full device detail (DOOR-06 list/get). ConnectionParams is ALWAYS redacted.
public sealed record DeviceDetail(
    Guid Id,
    Guid TenantId,
    string DeviceType,
    string Vendor,
    RedactedConnectionParams ConnectionParams,
    Guid? GatehouseId,
    string? GatehouseName,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    DateTime? RemovedAtUtc,
    Guid CreatedByProfileId);

// Lightweight list item (no gatehouse name lookup, no redaction-detail expansion).
public sealed record DeviceListItem(
    Guid Id,
    string DeviceType,
    string Vendor,
    Guid? GatehouseId,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);