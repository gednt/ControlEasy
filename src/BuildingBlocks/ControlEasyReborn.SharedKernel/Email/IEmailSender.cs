namespace ControlEasyReborn.SharedKernel.Email;

public interface IEmailSender
{
    Task SendEmailAsync(string toEmail, string toName, string subject, string bodyHtml, CancellationToken ct = default);
}
