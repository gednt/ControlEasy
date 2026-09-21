using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Visits.Application.Abstractions;
using ControlEasyReborn.Modules.Visits.Application.Contracts;
using ControlEasyReborn.Modules.Visits.Application.Handlers;
using ControlEasyReborn.Modules.Visits.Application.Validators;
using ControlEasyReborn.Modules.Visits.Infrastructure.Persistence;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ControlEasyReborn.Modules.Visits.Infrastructure.DI;

public static class VisitsModuleServiceCollectionExtensions
{
    public static IServiceCollection AddVisitsModule(this IServiceCollection services)
    {
        services.TryAddScoped<ITenantContext, HttpTenantContext>();
        services.AddSingleton<TenantAwareLinqFactory>();
        services.AddSingleton<ITenantAwareLinqFactory>(sp => sp.GetRequiredService<TenantAwareLinqFactory>());

        services.AddScoped<IVisitRepository, VisitRepository>();
        services.AddScoped<IVisitDirectory, VisitDirectoryRepository>();
        services.AddScoped<VisitorArrivalHandler>();
        services.AddScoped<CreateVisitHandler>();
        services.AddScoped<GetVisitHandler>();
        services.AddScoped<ListVisitsHandler>();
        services.AddScoped<CheckInVisitHandler>();
        services.AddScoped<CheckOutVisitHandler>();
        services.AddScoped<IValidator<CreateVisitRequest>, CreateVisitRequestValidator>();
        return services;
    }
}