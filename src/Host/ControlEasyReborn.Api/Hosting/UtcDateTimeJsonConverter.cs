using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ControlEasyReborn.Api.Hosting;

/// <summary>
/// MySQL DATETIME has no timezone metadata. Application timestamps are stored
/// in UTC, so values read back as Unspecified must be serialized as UTC rather
/// than being presented to clients as local wall-clock values.
/// </summary>
public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetDateTime();
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utcValue = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

        writer.WriteStringValue(utcValue.ToString("O", CultureInfo.InvariantCulture));
    }
}
