namespace ControlEasyReborn.SharedKernel.Email;

public sealed class SmtpOptions
{
    public const string SectionName = "Smtp";

    public string Host { get; init; } = "127.0.0.1";
    public int Port { get; init; } = 1025;
    public string SenderEmail { get; init; } = "noreply@controleasy.com";
    public string SenderName { get; init; } = "ControlEasy";
    public string? Username { get; init; }
    public string? Password { get; init; }
    public bool EnableSsl { get; init; }
}
