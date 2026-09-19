using ControlEasyReborn.SharedKernel.Email;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Infrastructure.Email;

public sealed class NoOpEmailSender : IEmailSender
{
    private readonly ILogger<NoOpEmailSender> _logger;

    public NoOpEmailSender(ILogger<NoOpEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendEmailAsync(string toEmail, string toName, string subject, string bodyHtml, CancellationToken ct = default)
    {
        _logger.LogInformation("NoOpEmailSender: Outbound email disabled (Demo or Testing). Simulated sending '{Subject}' to {Recipient}", subject, toEmail);
        return Task.CompletedTask;
    }
}
