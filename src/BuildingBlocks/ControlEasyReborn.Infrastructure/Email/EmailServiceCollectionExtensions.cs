using ControlEasyReborn.Infrastructure.Email;
using ControlEasyReborn.SharedKernel.Demo;
using ControlEasyReborn.SharedKernel.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ControlEasyReborn.Infrastructure.Email;

public static class EmailServiceCollectionExtensions
{
    public static IServiceCollection AddEmailInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.SectionName));
        var demoOptions = configuration.GetSection(DemoOptions.SectionName).Get<DemoOptions>();
        if (demoOptions?.DisableOutboundEmail == true)
        {
            services.AddScoped<IEmailSender, NoOpEmailSender>();
        }
        else
        {
            services.AddScoped<IEmailSender, MailKitEmailSender>();
        }

        return services;
    }
}
