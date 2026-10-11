using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Errors;

namespace ControlEasyReborn.Modules.Security.Application.Handlers;

public sealed class SetGatehouseActivationHandler
{
    private readonly IGatehouseRepository _gatehouses;

    public SetGatehouseActivationHandler(IGatehouseRepository gatehouses)
    {
        _gatehouses = gatehouses;
    }

    public async Task<GatehouseResponse> HandleAsync(Guid id, bool active, CancellationToken ct)
    {
        var gatehouse = await _gatehouses.FindAsync(id, ct);
        if (gatehouse is null)
        {
            throw new NotFoundException($"Gatehouse {id} was not found.");
        }

        if (gatehouse.Active != active)
        {
            gatehouse.SetActive(active);
            await _gatehouses.SetActiveAsync(gatehouse, ct);
        }

        return CreateGatehouseHandler.ToResponse(gatehouse);
    }
}
