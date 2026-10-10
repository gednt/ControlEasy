using Serilog.Context;

namespace ControlEasyReborn.Modules.Devices.Application.Logging;

public static class DeviceLoggingProperties
{
    public const string TenantIdProperty = "Devices.TenantId";
    public const string DeviceIdProperty = "Devices.DeviceId";
    public const string ActorProfileIdProperty = "Devices.ActorProfileId";
    public const string CorrelationIdProperty = "Devices.CorrelationId";
    public const string OutcomeProperty = "Devices.Outcome";

    // Properties that MUST NEVER be pushed to log context.
    private static readonly string[] ForbiddenProperties =
    {
        "signature", "Signature", "SignatureBase64Url",
        "nonce", "Nonce", "NonceBase64Url",
        "connectionParams", "ConnectionParams", "ConnectionParamsCiphertext",
        "Plaintext", "plaintext"
    };

    public static IDisposable BeginScope(
        Guid? tenantId = null,
        Guid? deviceId = null,
        Guid? actorProfileId = null,
        Guid? correlationId = null,
        string? outcome = null)
    {
        var properties = new List<IDisposable>(capacity: 5);

        if (tenantId.HasValue)
            properties.Add(LogContext.PushProperty(TenantIdProperty, tenantId.Value));
        if (deviceId.HasValue)
            properties.Add(LogContext.PushProperty(DeviceIdProperty, deviceId.Value));
        if (actorProfileId.HasValue)
            properties.Add(LogContext.PushProperty(ActorProfileIdProperty, actorProfileId.Value));
        if (correlationId.HasValue)
            properties.Add(LogContext.PushProperty(CorrelationIdProperty, correlationId.Value));
        if (!string.IsNullOrWhiteSpace(outcome))
            properties.Add(LogContext.PushProperty(OutcomeProperty, outcome));

        return new CompositeDisposable(properties);
    }

    private sealed class CompositeDisposable : IDisposable
    {
        private readonly List<IDisposable> _disposables;
        private bool _disposed;

        public CompositeDisposable(List<IDisposable> disposables) => _disposables = disposables;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            for (var i = _disposables.Count - 1; i >= 0; i--)
            {
                try { _disposables[i].Dispose(); }
                catch { /* swallow to avoid masking inner exception */ }
            }
            _disposables.Clear();
        }
    }
}