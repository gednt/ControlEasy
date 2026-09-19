using ControlEasyReborn.Modules.Reports.Application.Time;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Reports;

public sealed class TenantDayBoundaryTests
{
    [Fact]
    public void GetDayBoundsUtc_standard_time_date_maps_local_midnight_to_utc_minus_three()
    {
        // 2026-09-19 is standard time in Sao Paulo (DST starts in October since 2019 rule change).
        // Local midnight 2026-09-19T00:00 (-03:00) => 2026-09-19T03:00:00Z.
        var (startUtc, endUtc) = TenantDayBoundary.GetDayBoundsUtc(new DateOnly(2026, 9, 19));

        startUtc.Should().Be(new DateTime(2026, 9, 19, 3, 0, 0, DateTimeKind.Utc));
        endUtc.Should().Be(new DateTime(2026, 9, 20, 3, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void GetDayBoundsUtc_end_is_always_after_start_and_exactly_24h_for_non_dst_boundary_dates()
    {
        var (startUtc, endUtc) = TenantDayBoundary.GetDayBoundsUtc(new DateOnly(2026, 6, 15));

        (endUtc - startUtc).Should().BePositive();
        (endUtc - startUtc).Should().Be(TimeSpan.FromHours(24));
        startUtc.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void GetDayBoundsUtc_windows_covers_mid_2026_date_with_utc_timestamps()
    {
        var (startUtc, endUtc) = TenantDayBoundary.GetDayBoundsUtc(new DateOnly(2026, 9, 19));

        // Both bounds are UTC timestamps ( Sao Paulo = UTC-3 in September 2026, no DST ).
        startUtc.Should().BeBefore(endUtc);
        (endUtc - startUtc).Should().BeLessThanOrEqualTo(TimeSpan.FromHours(25));
        (endUtc - startUtc).Should().BeGreaterThanOrEqualTo(TimeSpan.FromHours(23));
    }
}