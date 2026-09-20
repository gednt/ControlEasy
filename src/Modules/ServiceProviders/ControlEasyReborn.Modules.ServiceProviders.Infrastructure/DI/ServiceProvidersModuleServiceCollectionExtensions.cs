using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.ServiceProviders.Application.Abstractions;
using ControlEasyReborn.Modules.ServiceProviders.Application.Contracts;
using ControlEasyReborn.Modules.ServiceProviders.Application.Handlers;
using ControlEasyReborn.Modules.ServiceProviders.Application.Validators;
using ControlEasyReborn.Modules.ServiceProviders.Infrastructure.Persistence;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ControlEasyReborn.Modules.ServiceProviders.Infrastructure.DI;

public static class ServiceProvidersModuleServiceCollectionExtensions
{
    public static IServiceCollection AddServiceProvidersModule(this IServiceCollection services)
    {
        services.TryAddScoped<ITenantContext, HttpTenantContext>();
        services.AddSingleton<TenantAwareLinqFactory>();
        services.AddSingleton<ITenantAwareLinqFactory>(sp => sp.GetRequiredService<TenantAwareLinqFactory>());

        services.AddScoped<IServiceProviderRepository, ServiceProviderRepository>();
        services.AddScoped<CreateServiceProviderHandler>();
        services.AddScoped<GetServiceProviderHandler>();
        services.AddScoped<ListServiceProvidersHandler>();
        services.AddScoped<UpdateServiceProviderHandler>();
        services.AddScoped<DeactivateServiceProviderHandler>();
        services.AddScoped<IValidator<CreateServiceProviderRequest>, CreateServiceProviderRequestValidator>();
        services.AddScoped<IValidator<UpdateServiceProviderRequest>, UpdateServiceProviderRequestValidator>();
        return services;
    }
}
