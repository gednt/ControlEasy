using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Errors;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using FluentValidation;

namespace ControlEasyReborn.Modules.Security.Application.Handlers;

public sealed class CreateGatehouseHandler
{
    private readonly IGatehouseRepository _gatehouses;
    private readonly IValidator<CreateGatehouseRequest> _validator;

    public CreateGatehouseHandler(IGatehouseRepository gatehouses, IValidator<CreateGatehouseRequest> validator)
    {
        _gatehouses = gatehouses;
        _validator = validator;
    }

    public async Task<GatehouseResponse> HandleAsync(CreateGatehouseRequest request, Guid tenantId, CancellationToken ct)
    {
        var result = await _validator.ValidateAsync(request, ct);
        if (!result.IsValid)
        {
            throw new Errors.ValidationException(result.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        var gatehouse = new Gatehouse(
            id: Guid.NewGuid(),
            tenantId: tenantId,
            name: request.Name,
            location: request.Location);

        await _gatehouses.AddAsync(gatehouse, ct);
        return ToResponse(gatehouse);
    }

    internal static GatehouseResponse ToResponse(Gatehouse g) =>
        new(g.Id, g.TenantId, g.Name, g.Location, g.Active);
}
