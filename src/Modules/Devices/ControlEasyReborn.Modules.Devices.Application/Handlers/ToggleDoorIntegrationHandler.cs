using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Logging;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// DOOR-05: writes the per-tenant DoorIntegrationEnabled flag and its
// audit-trail columns. Does NOT require the flag itself to be enabled
// (the bootstrap case — first flip must work even when disabled).
public sealed class ToggleDoorIntegrationHandler
{
    private readonly ITenantDoorIntegrationRepository _repository;
    private readonly ILogger<ToggleDoorIntegrationHandler> _logger;

    public ToggleDoorIntegrationHandler(
        ITenantDoorIntegrationRepository repository,
        ILogger<ToggleDoorIntegrationHandler>? logger = null)
    {
        _repository = repository;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<ToggleDoorIntegrationHandler>.Instance;
    }

    public async Task<TenantDoorIntegrationDto> HandleAsync(
        Guid tenantId,
        bool enabled,
        Guid actorProfileId,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await _repository.SetAsync(tenantId, enabled, actorProfileId, now, ct);

        var state = await _repository.GetAsync(tenantId, ct)
            ?? new TenantDoorIntegrationState(tenantId, enabled, now, actorProfileId);

        using (DeviceLoggingProperties.BeginScope(tenantId, deviceId: null, actorProfileId,
                   outcome: enabled ? "tenant.door_integration.enabled" : "tenant.door_integration.disabled"))
        {
            _logger.LogInformation(
                "tenant.door_integration.{Outcome} by profile {ActorProfileId} for tenant {TenantId}.",
                enabled ? "enabled" : "disabled", actorProfileId, tenantId);
        }

        return new TenantDoorIntegrationDto(
            TenantId: state.TenantId,
            DoorIntegrationEnabled: state.IsEnabled,
            DoorIntegrationChangedAtUtc: state.ChangedAtUtc,
            DoorIntegrationChangedByProfileId: state.ChangedByProfileId);
    }
}