using System.Linq.Expressions;
using FluentValidation;

namespace ControlEasyReborn.Modules.Security.Application.Validators;

internal static class GatehouseValidationRules
{
    public static void AddGatehouseDetailsRules<T>(
        this AbstractValidator<T> validator,
        Expression<Func<T, string>> name,
        Expression<Func<T, string?>> location)
    {
        validator.RuleFor(name)
            .Must(value => !string.IsNullOrWhiteSpace(value))
            .WithMessage("Name is required.")
            .Must(value => value is null || value.Trim().Length <= 120)
            .WithMessage("Name must be 120 characters or fewer.");

        validator.RuleFor(location)
            .Must(value => value is null || value.Trim().Length <= 500)
            .WithMessage("Location must be 500 characters or fewer.");
    }
}
