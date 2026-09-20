using ControlEasyReborn.Modules.ServiceProviders.Application.Abstractions;
using ControlEasyReborn.Modules.ServiceProviders.Application.Contracts;
using ControlEasyReborn.Modules.ServiceProviders.Application.Errors;

namespace ControlEasyReborn.Modules.ServiceProviders.Application.Handlers;

public sealed class DeactivateServiceProviderHandler
{
    private readonly IServiceProviderRepository _providers;

    public DeactivateServiceProviderHandler(IServiceProviderRepository providers)
    {
        _providers = providers;
    }

    public async Task<ServiceProviderResponse> HandleAsync(Guid id, CancellationToken ct)
    {
        var provider = await _providers.FindAsync(id, ct);
        if (provider is null)
        {
            throw new NotFoundException("ServiceProvider " + id + " was not found.");
        }

        if (provider.Active)
        {
            provider.Deactivate();
        }

        await _providers.UpdateAsync(provider, ct);
        return CreateServiceProviderHandler.ToResponse(provider);
    }
}
