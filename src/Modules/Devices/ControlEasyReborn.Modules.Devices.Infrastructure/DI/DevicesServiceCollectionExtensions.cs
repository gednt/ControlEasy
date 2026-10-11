using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Handlers;
using ControlEasyReborn.Modules.Devices.Application.Validators;
using ControlEasyReborn.Modules.Devices.Infrastructure.Persistence;
using ControlEasyReborn.Modules.Devices.Infrastructure.Services;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.DI;

public static class DevicesServiceCollectionExtensions
{
    public static IServiceCollection AddDevicesModule(this IServiceCollection services)
    {
        // Tenant context + Linq factory are shared infrastructure; modules register
        // them so each test host and prod host that calls AddDevicesModule also gets
        // the shared dependencies (Visit/AccessControl do the same).
        services.TryAddScoped<ITenantContext, HttpTenantContext>();
        services.AddSingleton<TenantAwareLinqFactory>();
        services.AddSingleton<ITenantAwareLinqFactory>(sp => sp.GetRequiredService<TenantAwareLinqFactory>());

        // Singleton simulator state — one instance per process; shared across all
        // tenant/device combinations so integration tests can inspect it.
        services.AddSingleton<DoorSimulatorState>();
        services.AddSingleton<IDoorSimulatorState>(sp => sp.GetRequiredService<DoorSimulatorState>());

        services.AddSingleton<IDeviceNonceCache, InMemoryDeviceNonceCache>();
        services.AddSingleton<IDeviceUnlockRateLimiter, InMemoryDeviceUnlockRateLimiter>();

        services.AddScoped<IDoorController, SimulatedDoorController>();
        services.AddScoped<IDeviceConnectionCryptoService, DeviceConnectionCryptoService>();
        services.AddScoped<IDeviceUnlockKeyProvider, DeviceUnlockKeyProvider>();
        services.AddScoped<IDeviceRepository, DeviceRepository>();
        services.AddScoped<IDeviceUnlockAuditRepository, DeviceUnlockAuditRepository>();
        services.AddScoped<ITenantDoorIntegrationFlagLookup, TenantDoorIntegrationFlagLookup>();
        services.AddScoped<ITenantDoorIntegrationRepository, TenantDoorIntegrationRepository>();
        services.AddScoped<IGatehouseLookup, GatehouseLookup>();

        // Phase 25 - reader-event ingestion surface (DOOR-08..11).
        services.AddScoped<IDeviceEventRepository, DeviceEventRepository>();
        services.AddSingleton<IDeviceEventQueue, InMemoryDeviceEventQueue>();
        services.AddSingleton<IDeviceHandler, SimulatedDeviceHandler>();
        services.AddScoped<IDeviceCredentialResolver, DeviceCredentialResolver>();

        services.AddScoped<UnlockDeviceHandler>();
        services.AddScoped<ToggleDoorIntegrationHandler>();
        services.AddScoped<RegisterDeviceHandler>();
        services.AddScoped<EditDeviceHandler>();
        services.AddScoped<ActivateDeactivateDeviceHandler>();
        services.AddScoped<RemoveDeviceHandler>();
        services.AddScoped<IngestDeviceEventHandler>();
        services.AddScoped<ListDeviceEventsHandler>();

        services.AddScoped<IValidator<DoorUnlockRequest>, UnlockDeviceValidator>();
        services.AddScoped<IValidator<RegisterDeviceRequest>, RegisterDeviceValidator>();
        services.AddScoped<IValidator<EditDeviceRequest>, EditDeviceValidator>();
        services.AddScoped<IValidator<DeviceEventPayload>, IngestDeviceEventValidator>();

        return services;
    }
}