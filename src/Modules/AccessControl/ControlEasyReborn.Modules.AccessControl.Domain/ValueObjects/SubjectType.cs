namespace ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;

public enum SubjectType
{
    Resident = 0,
    Vehicle = 1,
    Visitor = 2
}

public static class SubjectTypeCodes
{
    public static readonly IReadOnlyDictionary<string, SubjectType> ParseTable = new Dictionary<string, SubjectType>(StringComparer.OrdinalIgnoreCase)
    {
        ["resident"] = SubjectType.Resident,
        ["vehicle"] = SubjectType.Vehicle,
        ["visitor"] = SubjectType.Visitor
    };

    public static bool TryParse(string? value, out SubjectType subjectType)
    {
        if (!string.IsNullOrWhiteSpace(value) && ParseTable.TryGetValue(value, out subjectType))
        {
            return true;
        }
        subjectType = SubjectType.Resident;
        return false;
    }

    public static string ToWire(SubjectType subjectType) => subjectType switch
    {
        SubjectType.Resident => "resident",
        SubjectType.Vehicle => "vehicle",
        SubjectType.Visitor => "visitor",
        _ => "unknown"
    };
}
