using ControlEasyReborn.Modules.Security.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Security;

public sealed class GatehouseEntityTests
{
    [Fact]
    public void UpdateDetails_normalizes_values_without_changing_identity_or_lifecycle()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var gatehouse = new Gatehouse(id, tenantId, "Original", "Original location", active: false);

        gatehouse.UpdateDetails("  Renamed gatehouse  ", "  Service entrance  ");

        gatehouse.Id.Should().Be(id);
        gatehouse.TenantId.Should().Be(tenantId);
        gatehouse.Name.Should().Be("Renamed gatehouse");
        gatehouse.Location.Should().Be("Service entrance");
        gatehouse.Active.Should().BeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void UpdateDetails_clears_blank_location(string? location)
    {
        var gatehouse = new Gatehouse(Guid.NewGuid(), Guid.NewGuid(), "Gatehouse", "Location");

        gatehouse.UpdateDetails("Gatehouse", location);

        gatehouse.Location.Should().BeNull();
    }

    [Fact]
    public void UpdateDetails_rejects_null_name()
    {
        var gatehouse = new Gatehouse(Guid.NewGuid(), Guid.NewGuid(), "Gatehouse", null);

        var action = () => gatehouse.UpdateDetails(null!, null);

        action.Should().Throw<ArgumentNullException>();
    }
}
