using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Errors;
using ControlEasyReborn.Modules.Security.Application.Handlers;
using ControlEasyReborn.Modules.Security.Application.Validators;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Security;

public sealed class UpdateGatehouseHandlerTests
{
    private readonly IGatehouseRepository _repository = Substitute.For<IGatehouseRepository>();

    [Fact]
    public async Task HandleAsync_updates_details_and_preserves_inactive_state()
    {
        var gatehouse = new Gatehouse(Guid.NewGuid(), Guid.NewGuid(), "Original", "Old", active: false);
        _repository.FindAsync(gatehouse.Id, Arg.Any<CancellationToken>()).Returns(gatehouse, gatehouse);
        var sut = new UpdateGatehouseHandler(_repository, new UpdateGatehouseRequestValidator());

        var response = await sut.HandleAsync(
            gatehouse.Id,
            new UpdateGatehouseRequest("  Updated  ", "   "),
            CancellationToken.None);

        response.Id.Should().Be(gatehouse.Id);
        response.Name.Should().Be("Updated");
        response.Location.Should().BeNull();
        response.Active.Should().BeFalse();
        await _repository.Received(1).UpdateAsync(gatehouse, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_returns_current_lifecycle_state_after_details_update()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var initiallyActive = new Gatehouse(id, tenantId, "Original", "Old", active: true);
        var concurrentlyDisabled = new Gatehouse(id, tenantId, "Updated", "New", active: false);
        _repository.FindAsync(id, Arg.Any<CancellationToken>())
            .Returns(initiallyActive, concurrentlyDisabled);
        var sut = new UpdateGatehouseHandler(_repository, new UpdateGatehouseRequestValidator());

        var response = await sut.HandleAsync(
            id,
            new UpdateGatehouseRequest("Updated", "New"),
            CancellationToken.None);

        response.Name.Should().Be("Updated");
        response.Location.Should().Be("New");
        response.Active.Should().BeFalse();
        await _repository.Received(2).FindAsync(id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_when_gatehouse_is_not_visible_returns_not_found()
    {
        var id = Guid.NewGuid();
        _repository.FindAsync(id, Arg.Any<CancellationToken>()).Returns((Gatehouse?)null);
        var sut = new UpdateGatehouseHandler(_repository, new UpdateGatehouseRequestValidator());

        var action = () => sut.HandleAsync(
            id,
            new UpdateGatehouseRequest("Updated", null),
            CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
        await _repository.DidNotReceive().UpdateAsync(Arg.Any<Gatehouse>(), Arg.Any<CancellationToken>());
    }
}
