using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Vehicles.Application.Contracts;
using ControlEasyReborn.Modules.Vehicles.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class VehicleEndpointTests
{
    private readonly TestcontainersWebApplicationFactory _factory;

    public VehicleEndpointTests(MySqlContainerFixture mySql)
    {
        _factory = new TestcontainersWebApplicationFactory(mySql);
    }

    [Fact]
    public async Task CreateVehicle_AsTenantA_ReturnsCreated()
    {
        var client = _factory.AsTenantA();
        var request = new CreateVehicleRequest("ABC1D23", "Toyota", "Corolla", "Silver", null, "Joao Silva", null);

        var response = await client.PostAsJsonAsync("/api/v1/vehicles", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<VehicleResponse>();
        body.Should().NotBeNull();
        body!.Plate.Should().Be("ABC1D23");
    }

    [Fact]
    public async Task CreateVehicle_WithNumericVehicleType_ReturnsCreatedVehicleType()
    {
        var client = _factory.AsTenantA();

        var response = await client.PostAsJsonAsync("/api/v1/vehicles", new
        {
            plate = "MOTO123",
            vehicleType = 1
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<VehicleResponse>();
        body.Should().NotBeNull();
        body!.VehicleType.Should().Be(VehicleType.Motorcycle);
    }

    [Fact]
    public async Task CrossTenant_GetVehicle_AsDifferentTenant_Returns404()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();

        var createResponse = await clientA.PostAsJsonAsync("/api/v1/vehicles",
            new CreateVehicleRequest("XYZ9W87", null, null, null, null, null, null));
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await createResponse.Content.ReadFromJsonAsync<VehicleResponse>();
        created.Should().NotBeNull();

        var getResponse = await clientB.GetAsync($"/api/v1/vehicles/{created!.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
