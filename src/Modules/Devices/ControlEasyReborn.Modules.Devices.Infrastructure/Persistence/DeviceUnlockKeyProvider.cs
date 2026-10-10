using ControlEasyReborn.Infrastructure.KeyDerivation;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Persistence;

public sealed class DeviceUnlockKeyProvider : IDeviceUnlockKeyProvider
{
    private readonly IPerTenantKeyDeriver _deriver;

    public DeviceUnlockKeyProvider(IPerTenantKeyDeriver deriver)
    {
        _deriver = deriver;
    }

    public Task<byte[]> GetKeyForAsync(Guid tenantId, CancellationToken ct)
    {
        var key = _deriver.DeriveKey(tenantId, KeyDerivationPurpose.DoorUnlockV1);
        return Task.FromResult(key);
    }
}