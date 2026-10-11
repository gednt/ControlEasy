namespace ControlEasyReborn.Modules.AccessControl.Application.Abstractions;

/// <summary>
/// Confirms that the operational gatehouse supplied with an access action belongs
/// to the current tenant. Implemented by the Security module, which owns
/// gatehouse persistence.
/// </summary>
public interface IGatehouseAccessValidator
{
    Task EnsureValidAsync(Guid tenantId, Guid? gatehouseId, CancellationToken ct);
}
