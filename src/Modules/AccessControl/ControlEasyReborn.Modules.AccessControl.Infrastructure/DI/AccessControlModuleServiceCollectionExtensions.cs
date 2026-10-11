using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Application.Handlers;
using ControlEasyReborn.Modules.AccessControl.Application.Mappings;
using ControlEasyReborn.Modules.AccessControl.Application.Validators;
using ControlEasyReborn.Modules.AccessControl.Infrastructure.Persistence;
using ControlEasyReborn.Modules.AccessControl.Infrastructure.Services;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using FluentValidation;
using Mapster;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ControlEasyReborn.Modules.AccessControl.Infrastructure.DI;

public static class AccessControlModuleServiceCollectionExtensions
{
    public static IServiceCollection AddAccessControlModule(this IServiceCollection services)
    {
        services.TryAddScoped<ITenantContext, HttpTenantContext>();
        services.AddSingleton<TenantAwareLinqFactory>();
        services.AddSingleton<ITenantAwareLinqFactory>(sp => sp.GetRequiredService<TenantAwareLinqFactory>());

        services.AddSingleton<IOpaqueTokenIssuer, OpaqueTokenIssuer>();
        services.AddSingleton<AccessControlHmacKeyProvider>();
        services.AddSingleton<IAccessControlClock, SystemAccessControlClock>();
        services.AddScoped<IAccessControlCryptoService, AccessControlCryptoService>();

        services.AddScoped<IAccessCredentialRepository, AccessCredentialRepository>();
        services.AddScoped<IAccessEventRepository, AccessEventRepository>();
        services.AddScoped<IRefusedScanAttemptRepository, RefusedScanAttemptRepository>();
        services.AddScoped<IAccessLookupAuditRepository, AccessLookupAuditRepository>();
        services.AddScoped<ICredentialLifecycleActionRepository, CredentialLifecycleActionRepository>();

        services.AddScoped<AccessEventDestinationResolver>();
        services.AddScoped<RecordAccessScanHandler>();
        services.AddScoped<RecordRefusedScanHandler>();
        services.AddScoped<LookupSubjectHandler>();
        services.AddScoped<RecordManualAccessHandler>();
        services.AddScoped<IssueCredentialHandler>();
        services.AddScoped<ReplaceCredentialHandler>();
        services.AddScoped<RevokeCredentialHandler>();

        services.AddScoped<IValidator<Application.Commands.RecordAccessScanCommand>, RecordAccessScanCommandValidator>();
        services.AddScoped<IValidator<Application.Commands.LookupSubjectCommand>, LookupSubjectCommandValidator>();
        services.AddScoped<IValidator<Application.Commands.RecordManualAccessCommand>, RecordManualAccessCommandValidator>();
        services.AddScoped<IValidator<Application.Commands.IssueCredentialCommand>, IssueCredentialCommandValidator>();
        services.AddScoped<IValidator<Application.Commands.ReplaceCredentialCommand>, ReplaceCredentialCommandValidator>();
        services.AddScoped<IValidator<Application.Commands.RevokeCredentialCommand>, RevokeCredentialCommandValidator>();

        var mapsterConfig = new TypeAdapterConfig();
        AccessCredentialMappings.Register(mapsterConfig);
        services.AddSingleton(mapsterConfig);

        return services;
    }
}
