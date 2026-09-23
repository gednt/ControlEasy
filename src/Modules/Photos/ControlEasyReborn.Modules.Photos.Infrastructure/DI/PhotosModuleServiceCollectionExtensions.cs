using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Photos.Application.Contracts;
using ControlEasyReborn.Modules.Photos.Application.Handlers;
using ControlEasyReborn.Modules.Photos.Application.Validators;
using ControlEasyReborn.Modules.Photos.Infrastructure.Persistence;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ControlEasyReborn.Modules.Photos.Infrastructure.DI;

public static class PhotosModuleServiceCollectionExtensions
{
    public static IServiceCollection AddPhotosModule(this IServiceCollection services)
    {
        services.TryAddScoped<ITenantContext, HttpTenantContext>();
        services.AddSingleton<TenantAwareLinqFactory>();
        services.AddSingleton<ITenantAwareLinqFactory>(sp => sp.GetRequiredService<TenantAwareLinqFactory>());

        services.AddScoped<IPhotoRepository, PhotoRepository>();
        services.AddScoped<IConsentAuditLogRepository, ConsentAuditLogRepository>();
        services.AddScoped<ITenantConsentPolicyRepository, TenantConsentPolicyRepository>();
        services.AddScoped<IConsentPolicyEvaluator, ConsentPolicyEvaluator>();
        services.AddScoped<UploadPhotoHandler>();
        services.AddScoped<ListPhotosHandler>();
        services.AddScoped<GetPhotoHandler>();
        services.AddScoped<SoftDeletePhotoHandler>();
        services.AddScoped<ListEntryLogsHandler>();
        services.AddScoped<ExportEntryLogCsvHandler>();
        services.AddScoped<UpdateConsentPolicyHandler>();
        services.AddScoped<IValidator<UploadPhotoMetadata>, UploadPhotoMetadataValidator>();
        services.AddScoped<IValidator<UpdateConsentPolicyRequest>, UpdateConsentPolicyRequestValidator>();
        return services;
    }
}
