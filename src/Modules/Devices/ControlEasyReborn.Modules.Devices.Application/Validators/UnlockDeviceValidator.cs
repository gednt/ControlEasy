using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentValidation;

namespace ControlEasyReborn.Modules.Devices.Application.Validators;

public sealed class UnlockDeviceValidator : AbstractValidator<DoorUnlockRequest>
{
    private static readonly TimeSpan MaxSkew = TimeSpan.FromMinutes(5);

    public UnlockDeviceValidator()
    {
        RuleFor(r => r.Nonce)
            .NotEmpty().WithMessage("nonce is required.")
            .Must(BeValidBase64Url128Bit).WithMessage("nonce must be a 128-bit base64url value.");

        RuleFor(r => r.Signature)
            .NotEmpty().WithMessage("signature is required.")
            .Must(BeValidBase64Url).WithMessage("signature must be base64url-encoded.");

        RuleFor(r => r.BodyHash)
            .NotEmpty().WithMessage("bodyHash is required.")
            .Must(BeValidHex64).WithMessage("bodyHash must be 64 lowercase hex characters (SHA-256).");

        RuleFor(r => r.TimestampUtc)
            .Must(BeWithinReplayWindow)
            .WithMessage($"timestampUtc must be within ±{MaxSkew.TotalSeconds:0}s of server now.");
    }

    private static bool BeValidBase64Url128Bit(string value)
    {
        if (string.IsNullOrEmpty(value)) return false;
        try
        {
            var normalized = value.Replace('-', '+').Replace('_', '/');
            switch (normalized.Length % 4) { case 2: normalized += "=="; break; case 3: normalized += "="; break; case 0: break; default: return false; }
            var bytes = Convert.FromBase64String(normalized);
            return bytes.Length == 16;
        }
        catch { return false; }
    }

    private static bool BeValidBase64Url(string value)
    {
        if (string.IsNullOrEmpty(value)) return false;
        try
        {
            var normalized = value.Replace('-', '+').Replace('_', '/');
            switch (normalized.Length % 4) { case 2: normalized += "=="; break; case 3: normalized += "="; break; case 0: break; default: return false; }
            _ = Convert.FromBase64String(normalized);
            return true;
        }
        catch { return false; }
    }

    private static bool BeValidHex64(string value)
    {
        if (string.IsNullOrEmpty(value) || value.Length != 64) return false;
        foreach (var c in value)
        {
            if (!IsHexChar(c)) return false;
        }
        return true;
    }

    private static bool IsHexChar(char c) =>
        (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');

    private static bool BeWithinReplayWindow(DateTime timestampUtc)
    {
        var diff = DateTime.UtcNow - timestampUtc.ToUniversalTime();
        if (diff < TimeSpan.Zero) diff = -diff;
        return diff <= MaxSkew;
    }
}