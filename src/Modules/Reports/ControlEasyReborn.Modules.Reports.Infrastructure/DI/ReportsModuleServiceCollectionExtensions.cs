using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Reports.Application.Abstractions;
using ControlEasyReborn.Modules.Reports.Application.Handlers;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ControlEasyReborn.Modules.Reports.Infrastructure.DI;

public static class ReportsModuleServiceCollectionExtensions
{
    public static IServiceCollection AddReportsModule(this IServiceCollection services)
    {
        services.TryAddScoped<ITenantContext, HttpTenantContext>();
        services.AddSingleton<TenantAwareLinqFactory>();
        services.AddSingleton<ITenantAwareLinqFactory>(sp => sp.GetRequiredService<TenantAwareLinqFactory>());

        services.AddScoped<IReportReadRepository, Persistence.ReportReadRepository>();
        services.AddScoped<GetVisitCountsByDayHandler>();
        services.AddScoped<GetResidentsPerApartmentHandler>();
        services.AddScoped<GetDashboardStatsHandler>();
        services.AddScoped<GetHistoryHandler>();

        return services;
    }
}
