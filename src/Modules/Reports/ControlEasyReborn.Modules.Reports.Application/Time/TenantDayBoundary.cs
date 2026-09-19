namespace ControlEasyReborn.Modules.Reports.Application.Time;

/// <summary>
/// Resolves tenant-local day boundaries to UTC windows for report queries.
/// The default timezone is America/Sao_Paulo until per-tenant timezone
/// configuration exists (deferred to Phase 17 per phase CONTEXT.md — do not
/// build a settings table for this).
/// </summary>
public static class TenantDayBoundary
{
    /// <summary>
    /// IANA timezone id used while per-tenant timezone configuration is deferred.
    /// </summary>
    public const string DefaultTimeZoneId = "America/Sao_Paulo";

    private const string WindowsFallbackId = "E. South America Standard Time";
    private const int FallbackOffsetHours = -3;

    /// <summary>
    /// Returns the UTC window covering the tenant-local calendar <paramref name="date"/>:
    /// startUtc (inclusive, local midnight) and endUtc (exclusive, next local midnight).
    /// </summary>
    public static (DateTime StartUtc, DateTime EndUtc) GetDayBoundsUtc(DateOnly date)
    {
        var tz = ResolveTimeZone();
        var localMidnight = new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var nextLocalMidnight = localMidnight.AddDays(1);

        var startUtc = TimeZoneInfo.ConvertTimeToUtc(localMidnight, tz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(nextLocalMidnight, tz);
        return (startUtc, endUtc);
    }

    private static TimeZoneInfo ResolveTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(DefaultTimeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            // Fall through to the Windows-id fallback.
        }
        catch (InvalidTimeZoneException)
        {
            // Fall through to the Windows-id fallback.
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(WindowsFallbackId);
        }
        catch (TimeZoneNotFoundException)
        {
            // Fall through to the fixed-offset custom zone.
        }
        catch (InvalidTimeZoneException)
        {
            // Fall through to the fixed-offset custom zone.
        }

        return TimeZoneInfo.CreateCustomTimeZone(
            "tenant-default-utc-minus-3",
            new TimeSpan(FallbackOffsetHours, 0, 0),
            "Tenant default (UTC-3)",
            "Tenant default (UTC-3)");
    }
}