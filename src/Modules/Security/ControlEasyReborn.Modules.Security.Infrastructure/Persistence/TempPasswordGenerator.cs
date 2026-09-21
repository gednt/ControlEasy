using System.Security.Cryptography;
using ControlEasyReborn.Modules.Security.Application.Abstractions;

namespace ControlEasyReborn.Modules.Security.Infrastructure.Persistence;

public sealed class TempPasswordGenerator : ITempPasswordGenerator
{
    // Unambiguous character set excluding 0, O, o, 1, l, I per PASS-05
    public const string Digits = "23456789";
    public const string Uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    public const string Lowercase = "abcdefghijkmnpqrstuvwxyz";
    public const string Symbols = "!@#$%*";
    public const string UnambiguousCharset = Digits + Uppercase + Lowercase + Symbols;

    public string Generate(int length = 12)
    {
        if (length < 8)
        {
            length = 12;
        }

        while (true)
        {
            var candidate = RandomNumberGenerator.GetString(UnambiguousCharset, length);

            // Ensure character class diversity
            var hasDigit = candidate.IndexOfAny(Digits.ToCharArray()) >= 0;
            var hasUpper = candidate.IndexOfAny(Uppercase.ToCharArray()) >= 0;
            var hasLower = candidate.IndexOfAny(Lowercase.ToCharArray()) >= 0;
            var hasSymbol = candidate.IndexOfAny(Symbols.ToCharArray()) >= 0;

            if (hasDigit && hasUpper && hasLower && hasSymbol)
            {
                return candidate;
            }
        }
    }
}
