using ControlEasyReborn.Modules.ServiceProviders.Application.Abstractions;
using ControlEasyReborn.Modules.ServiceProviders.Application.Handlers;
using ControlEasyReborn.Modules.ServiceProviders.Domain.Entities;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.ServiceProviders;

public sealed class DeactivateServiceProviderHandlerTests
{
    private readonly IServiceProviderRepository _providers = Substitute.For<IServiceProviderRepository>();

    [Fact]
    public async Task HandleAsync_deactivates_active_provider_and_persists_the_change()
    {
        var id = Guid.NewGuid();
        var provider = CreateProvider(id, active: true);
        _providers.FindAsync(id, Arg.Any<CancellationToken>()).Returns(provider);
        var sut = new DeactivateServiceProviderHandler(_providers);

        var response = await sut.HandleAsync(id, CancellationToken.None);

        response.Active.Should().BeFalse();
        await _providers.Received(1).UpdateAsync(provider, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_is_idempotent_for_an_already_inactive_provider()
    {
        var id = Guid.NewGuid();
        var provider = CreateProvider(id, active: false);
        _providers.FindAsync(id, Arg.Any<CancellationToken>()).Returns(provider);
        var sut = new DeactivateServiceProviderHandler(_providers);

        var response = await sut.HandleAsync(id, CancellationToken.None);

        response.Active.Should().BeFalse();
        await _providers.Received(1).UpdateAsync(provider, Arg.Any<CancellationToken>());
    }

    private static ServiceProvider CreateProvider(Guid id, bool active) =>
        new(id, Guid.NewGuid(), "Clean Co", "11222333000181", null, null, "Cleaning", null, active, DateTime.UtcNow);
}
