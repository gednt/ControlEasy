using ControlEasyReborn.Modules.Security.Application.Contracts;
using FluentValidation;

namespace ControlEasyReborn.Modules.Security.Application.Validators;

public sealed class CreateGatehouseRequestValidator : AbstractValidator<CreateGatehouseRequest>
{
    public CreateGatehouseRequestValidator()
    {
        this.AddGatehouseDetailsRules(r => r.Name, r => r.Location);
    }
}
