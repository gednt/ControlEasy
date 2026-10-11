namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

// Tenant-scoped door-integration opt-in flag mutation request (DOOR-05).
public sealed record ToggleDoorIntegrationRequest(bool DoorIntegrationEnabled);

// Response shape for the PUT /api/v1/tenants/current/door-integration
// endpoint. Mirrors the columns written to Tenants and surfaces the
// audit-trail fields to the client.
public sealed record TenantDoorIntegrationDto(
    Guid TenantId,
    bool DoorIntegrationEnabled,
    DateTime? DoorIntegrationChangedAtUtc,
    Guid? DoorIntegrationChangedByProfileId);