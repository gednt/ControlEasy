using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Errors;
using FluentValidation;

namespace ControlEasyReborn.Modules.Security.Application.Handlers;

public sealed class UpdateGatehouseHandler
{
    private readonly IGatehouseRepository _gatehouses;
    private readonly IValidator<UpdateGatehouseRequest> _validator;

    public UpdateGatehouseHandler(
        IGatehouseRepository gatehouses,
        IValidator<UpdateGatehouseRequest> validator)
    {
        _gatehouses = gatehouses;
        _validator = validator;
    }

    public async Task<GatehouseResponse> HandleAsync(
        Guid id,
        UpdateGatehouseRequest request,
        CancellationToken ct)
    {
        var result = await _validator.ValidateAsync(request, ct);
        if (!result.IsValid)
        {
            throw new Errors.ValidationException(result.Errors
                .GroupBy(error => error.PropertyName)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(error => error.ErrorMessage).ToArray()));
        }

        var gatehouse = await _gatehouses.FindAsync(id, ct);
        if (gatehouse is null)
        {
            throw new NotFoundException($"Gatehouse {id} was not found.");
        }

        gatehouse.UpdateDetails(request.Name, request.Location);
        await _gatehouses.UpdateAsync(gatehouse, ct);

        var current = await _gatehouses.FindAsync(id, ct)
            ?? throw new NotFoundException($"Gatehouse {id} was not found after its details were updated.");
        return CreateGatehouseHandler.ToResponse(current);
    }
}
