using ControlEasyReborn.SharedKernel.Email;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace ControlEasyReborn.Infrastructure.Email;

public sealed class MailKitEmailSender : IEmailSender
{
    private readonly SmtpOptions _options;
    private readonly ILogger<MailKitEmailSender> _logger;

    public MailKitEmailSender(IOptions<SmtpOptions> options, ILogger<MailKitEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string toName, string subject, string bodyHtml, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.SenderName, _options.SenderEmail));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = subject;

        var builder = new BodyBuilder
        {
            HtmlBody = bodyHtml
        };
        message.Body = builder.ToMessageBody();

        using var client = new SmtpClient();
        try
        {
            var secureSocketOptions = _options.EnableSsl ? SecureSocketOptions.Auto : SecureSocketOptions.None;
            await client.ConnectAsync(_options.Host, _options.Port, secureSocketOptions, ct);

            if (!string.IsNullOrWhiteSpace(_options.Username) && !string.IsNullOrWhiteSpace(_options.Password))
            {
                await client.AuthenticateAsync(_options.Username, _options.Password, ct);
            }

            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            _logger.LogInformation("Sent email '{Subject}' to {Recipient}", subject, toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email '{Subject}' to {Recipient}", subject, toEmail);
            throw;
        }
    }
}
