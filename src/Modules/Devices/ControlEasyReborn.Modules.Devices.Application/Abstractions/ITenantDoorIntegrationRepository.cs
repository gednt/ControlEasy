namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Snapshot of the per-tenant door-integration flag state. Includes the
// audit-trail columns written by ToggleDoorIntegrationHandler.
public sealed record TenantDoorIntegrationState(
    Guid TenantId,
    bool IsEnabled,
    System.DateTime? ChangedAtUtc,
    System.Guid? ChangedByProfileId);

public interface ITenantDoorIntegrationRepository
{
    Task<TenantDoorIntegrationState?> GetAsync(Guid tenantId, CancellationToken ct);

    Task SetAsync(
        Guid tenantId,
        bool isEnabled,
        Guid actorProfileId,
        DateTime occurredAtUtc,
        CancellationToken ct);
}