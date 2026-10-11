using ControlEasyReborn.Modules.AccessControl.Application.Errors;
using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using ControlEasyReborn.Modules.Security.Infrastructure.Services;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Security;

public sealed class GatehouseAccessValidatorTests
{
    private readonly IGatehouseRepository _gatehouses = Substitute.For<IGatehouseRepository>();
    private readonly Guid _tenantId = Guid.NewGuid();

    [Fact]
    public async Task Rejects_omitted_gatehouse_id()
    {
        var validator = new GatehouseAccessValidator(_gatehouses);

        var act = () => validator.EnsureValidAsync(_tenantId, null, CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ValidationException>();
        exception.Which.Errors.Should().ContainKey("GatehouseId");
        await _gatehouses.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Rejects_unknown_gatehouse()
    {
        var gatehouseId = Guid.NewGuid();
        _gatehouses.FindAsync(gatehouseId, Arg.Any<CancellationToken>())
            .Returns((Gatehouse?)null);
        var validator = new GatehouseAccessValidator(_gatehouses);

        var act = () => validator.EnsureValidAsync(_tenantId, gatehouseId, CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ValidationException>();
        exception.Which.Errors.Should().ContainKey("GatehouseId");
    }

    [Fact]
    public async Task Rejects_gatehouse_from_another_tenant()
    {
        var gatehouseId = Guid.NewGuid();
        _gatehouses.FindAsync(gatehouseId, Arg.Any<CancellationToken>())
            .Returns(new Gatehouse(gatehouseId, Guid.NewGuid(), "Foreign gatehouse", null));
        var validator = new GatehouseAccessValidator(_gatehouses);

        var act = () => validator.EnsureValidAsync(_tenantId, gatehouseId, CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ValidationException>();
        exception.Which.Errors.Should().ContainKey("GatehouseId");
    }

    [Fact]
    public async Task Accepts_gatehouse_owned_by_current_tenant()
    {
        var gatehouseId = Guid.NewGuid();
        _gatehouses.FindAsync(gatehouseId, Arg.Any<CancellationToken>())
            .Returns(new Gatehouse(gatehouseId, _tenantId, "Reception", "Main entrance"));
        var validator = new GatehouseAccessValidator(_gatehouses);

        await validator.EnsureValidAsync(_tenantId, gatehouseId, CancellationToken.None);
    }

    [Fact]
    public async Task Rejects_inactive_gatehouse_owned_by_current_tenant()
    {
        var gatehouseId = Guid.NewGuid();
        _gatehouses.FindAsync(gatehouseId, Arg.Any<CancellationToken>())
            .Returns(new Gatehouse(gatehouseId, _tenantId, "Retired entrance", null, active: false));
        var validator = new GatehouseAccessValidator(_gatehouses);

        var act = () => validator.EnsureValidAsync(_tenantId, gatehouseId, CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ValidationException>();
        exception.Which.Errors.Should().ContainKey("GatehouseId");
    }
}
