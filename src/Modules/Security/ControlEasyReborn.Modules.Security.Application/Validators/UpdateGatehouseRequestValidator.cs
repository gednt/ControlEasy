using ControlEasyReborn.Modules.Security.Application.Contracts;
using FluentValidation;

namespace ControlEasyReborn.Modules.Security.Application.Validators;

public sealed class UpdateGatehouseRequestValidator : AbstractValidator<UpdateGatehouseRequest>
{
    public UpdateGatehouseRequestValidator()
    {
        this.AddGatehouseDetailsRules(r => r.Name, r => r.Location);
    }
}
