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

    [Fact]
    public void ToTenantDate_off_midnight_utc_input_maps_to_previous_tenant_local_day()
    {
        // 02:00 UTC on 2026-09-19 = 23:00 America/Sao_Paulo on 2026-09-18.
        var utc = new DateTime(2026, 9, 19, 2, 0, 0, DateTimeKind.Utc);
        TenantDayBoundary.ToTenantDate(utc).Should().Be(new DateOnly(2026, 9, 18));
    }

    [Fact]
    public void ToTenantDate_post_midnight_utc_input_maps_to_same_tenant_local_day()
    {
        // 12:00 UTC on 2026-09-19 = 09:00 America/Sao_Paulo on 2026-09-19.
        var utc = new DateTime(2026, 9, 19, 12, 0, 0, DateTimeKind.Utc);
        TenantDayBoundary.ToTenantDate(utc).Should().Be(new DateOnly(2026, 9, 19));
    }

    [Fact]
    public void ToTenantDate_handles_unspecified_kind_as_utc()
    {
        // A row read from MySQL arrives as DateTimeKind.Unspecified — ToTenantDate must
        // normalize it as UTC (mirrors how the visit-count read model receives the value).
        var unspecified = new DateTime(2026, 6, 15, 14, 30, 0, DateTimeKind.Unspecified);
        TenantDayBoundary.ToTenantDate(unspecified).Should().Be(new DateOnly(2026, 6, 15));
    }
}