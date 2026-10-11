namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Looks up the tenant that owns a given gatehouse id. The Devices module does
// NOT depend on the Security module directly — the lookup goes through this
// abstraction. Cross-tenant gatehouse ids return null (same as not-found) so
// the handler cannot leak the existence of another tenant's gatehouses.
public interface IGatehouseLookup
{
    Task<Guid?> GetGatehouseTenantAsync(Guid gatehouseId, CancellationToken ct);
}