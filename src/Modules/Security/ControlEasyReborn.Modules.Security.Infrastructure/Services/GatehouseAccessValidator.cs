using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Application.Errors;
using ControlEasyReborn.Modules.Security.Application.Abstractions;

namespace ControlEasyReborn.Modules.Security.Infrastructure.Services;

/// <summary>
/// Security-owned implementation of the access-control gatehouse boundary.
/// The repository is tenant-aware and the explicit tenant comparison is kept as
/// defense in depth before an access event can be persisted.
/// </summary>
public sealed class GatehouseAccessValidator : IGatehouseAccessValidator
{
    private readonly IGatehouseRepository _gatehouses;

    public GatehouseAccessValidator(IGatehouseRepository gatehouses)
    {
        _gatehouses = gatehouses;
    }

    public async Task EnsureValidAsync(Guid tenantId, Guid? gatehouseId, CancellationToken ct)
    {
        if (!gatehouseId.HasValue)
        {
            throw InvalidGatehouse();
        }

        var gatehouse = await _gatehouses.FindAsync(gatehouseId.Value, ct);
        if (gatehouse is null || gatehouse.TenantId != tenantId)
        {
            throw InvalidGatehouse();
        }
    }

    private static ValidationException InvalidGatehouse() => new(new Dictionary<string, string[]>
    {
        ["GatehouseId"] = new[] { "Select a registered gatehouse for this tenant." }
    });
}
