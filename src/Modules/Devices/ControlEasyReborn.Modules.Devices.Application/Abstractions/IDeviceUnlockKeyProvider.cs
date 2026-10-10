namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Per-tenant HMAC-SHA256 key derived via HKDF-SHA256 from the existing
// tenant master seed. Implementation reuses the BuildingBlocks key
// derivation pipeline with purpose DOOR_UNLOCK_V1.
public interface IDeviceUnlockKeyProvider
{
    Task<byte[]> GetKeyForAsync(Guid tenantId, CancellationToken ct);
}