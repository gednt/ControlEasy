namespace ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;

public enum AccessEventKind
{
    Access = 0,
    PackageDrop = 1
}

public static class AccessEventKindCodes
{
    public static readonly IReadOnlyDictionary<string, AccessEventKind> ParseTable = new Dictionary<string, AccessEventKind>(StringComparer.OrdinalIgnoreCase)
    {
        ["access"] = AccessEventKind.Access,
        ["package-drop"] = AccessEventKind.PackageDrop
    };

    public static bool TryParse(string? value, out AccessEventKind kind)
    {
        if (!string.IsNullOrWhiteSpace(value) && ParseTable.TryGetValue(value, out kind))
        {
            return true;
        }
        kind = AccessEventKind.Access;
        return false;
    }

    public static string ToWire(AccessEventKind kind) => kind switch
    {
        AccessEventKind.Access => "access",
        AccessEventKind.PackageDrop => "package-drop",
        _ => "unknown"
    };
}