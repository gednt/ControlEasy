using ControlEasyReborn.Infrastructure.Email;
using ControlEasyReborn.SharedKernel.Demo;
using ControlEasyReborn.SharedKernel.Email;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Email;

public sealed class EmailSenderTests
{
    [Fact]
    public async Task NoOpEmailSender_SendEmailAsync_ShouldCompleteWithoutThrowing()
    {
        var sut = new NoOpEmailSender(NullLogger<NoOpEmailSender>.Instance);
        var act = () => sut.SendEmailAsync("user@example.com", "Test User", "Subject", "<p>Body</p>");
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public void AddEmailInfrastructure_WhenDisableOutboundEmailIsTrue_ShouldRegisterNoOpSender()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        var inMemorySettings = new Dictionary<string, string?>
        {
            { $"{DemoOptions.SectionName}:DisableOutboundEmail", "true" },
            { $"{SmtpOptions.SectionName}:Host", "localhost" }
        };
        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        services.AddEmailInfrastructure(configuration);
        var provider = services.BuildServiceProvider();

        var sender = provider.GetService<IEmailSender>();
        sender.Should().NotBeNull();
        sender.Should().BeOfType<NoOpEmailSender>();
    }

    [Fact]
    public void AddEmailInfrastructure_WhenDisableOutboundEmailIsFalse_ShouldRegisterMailKitSender()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        var inMemorySettings = new Dictionary<string, string?>
        {
            { $"{DemoOptions.SectionName}:DisableOutboundEmail", "false" },
            { $"{SmtpOptions.SectionName}:Host", "mailpit" },
            { $"{SmtpOptions.SectionName}:Port", "1025" }
        };
        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        services.AddEmailInfrastructure(configuration);
        var provider = services.BuildServiceProvider();

        var sender = provider.GetService<IEmailSender>();
        sender.Should().NotBeNull();
        sender.Should().BeOfType<MailKitEmailSender>();
    }
}
