using System.Text.Json;
using ControlEasyReborn.Api.Hosting;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Hosting;

public sealed class UtcDateTimeJsonConverterTests
{
    private static readonly JsonSerializerOptions Options = new()
    {
        Converters = { new UtcDateTimeJsonConverter() }
    };

    [Fact]
    public void Serialize_unspecified_database_timestamp_as_utc()
    {
        var databaseTimestamp = new DateTime(2026, 9, 21, 0, 36, 0, DateTimeKind.Unspecified);

        var json = JsonSerializer.Serialize(databaseTimestamp, Options);

        json.Should().Be("\"2026-09-21T00:36:00.0000000Z\"");
    }

    [Fact]
    public void Deserialize_timestamp_as_utc()
    {
        var timestamp = JsonSerializer.Deserialize<DateTime>("\"2026-09-21T00:36:00Z\"", Options);

        timestamp.Kind.Should().Be(DateTimeKind.Utc);
        timestamp.Should().Be(new DateTime(2026, 9, 21, 0, 36, 0, DateTimeKind.Utc));
    }
}
