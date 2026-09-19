using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Visits.Application.Contracts;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class VisitEndpointTests
{
    private readonly TestcontainersWebApplicationFactory _factory;

    public VisitEndpointTests(MySqlContainerFixture mySql)
    {
        _factory = new TestcontainersWebApplicationFactory(mySql);
    }

    [Fact]
    public async Task CreateVisit_AsTenantA_ReturnsCreated()
    {
        var client = _factory.AsTenantA();
        var apartmentId = await _factory.SeedApartmentForTenantAAsync();
        var request = new CreateVisitRequest("Ana Costa", "12345678901", null, apartmentId, "Delivery");

        var response = await client.PostAsJsonAsync("/api/v1/visits", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<VisitResponse>();
        body.Should().NotBeNull();
        body!.VisitorName.Should().Be("Ana Costa");
        body.Status.Should().Be("Pending");
        body.ApartmentId.Should().Be(apartmentId);
    }

    [Fact]
    public async Task CreateVisit_EmptyVisitorName_Returns400()
    {
        var client = _factory.AsTenantA();
        var apartmentId = await _factory.SeedApartmentForTenantAAsync();
        var request = new CreateVisitRequest("", "12345678901", null, apartmentId, null);

        var response = await client.PostAsJsonAsync("/api/v1/visits", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CheckInVisit_AsPending_ReturnsOkWithCheckedInStatus()
    {
        var client = _factory.AsTenantA();
        var apartmentId = await _factory.SeedApartmentForTenantAAsync();
        var createResponse = await client.PostAsJsonAsync("/api/v1/visits",
            new CreateVisitRequest("Check In Test", "12345678901", null, apartmentId, "Visit"));
        var created = await createResponse.Content.ReadFromJsonAsync<VisitResponse>();

        var checkInResponse = await client.PostAsync($"/api/v1/visits/{created!.Id}/checkin", null);
        checkInResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await checkInResponse.Content.ReadFromJsonAsync<VisitResponse>();
        body!.Status.Should().Be("CheckedIn");
        body.CheckedInAtUtc.Should().NotBeNull();
        body.CheckedOutAtUtc.Should().BeNull();
    }

    [Fact]
    public async Task CheckOutVisit_AfterCheckIn_ReturnsOkWithCheckedOutStatus()
    {
        var client = _factory.AsTenantA();
        var apartmentId = await _factory.SeedApartmentForTenantAAsync();
        var createResponse = await client.PostAsJsonAsync("/api/v1/visits",
            new CreateVisitRequest("Check Out Test", "98765432100", null, apartmentId, null));
        var created = await createResponse.Content.ReadFromJsonAsync<VisitResponse>();

        await client.PostAsync($"/api/v1/visits/{created!.Id}/checkin", null);

        var checkOutResponse = await client.PostAsync($"/api/v1/visits/{created.Id}/checkout", null);
        checkOutResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await checkOutResponse.Content.ReadFromJsonAsync<VisitResponse>();
        body!.Status.Should().Be("CheckedOut");
        body.CheckedInAtUtc.Should().NotBeNull();
        body.CheckedOutAtUtc.Should().NotBeNull();
    }

    [Fact]
    public async Task CheckInVisit_AlreadyCheckedIn_Returns409()
    {
        var client = _factory.AsTenantA();
        var apartmentId = await _factory.SeedApartmentForTenantAAsync();
        var createResponse = await client.PostAsJsonAsync("/api/v1/visits",
            new CreateVisitRequest("Double Check In", "11122233344", null, apartmentId, null));
        var created = await createResponse.Content.ReadFromJsonAsync<VisitResponse>();

        await client.PostAsync($"/api/v1/visits/{created!.Id}/checkin", null);

        var secondCheckIn = await client.PostAsync($"/api/v1/visits/{created.Id}/checkin", null);
        secondCheckIn.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CheckOutVisit_WithoutCheckIn_Returns409()
    {
        var client = _factory.AsTenantA();
        var apartmentId = await _factory.SeedApartmentForTenantAAsync();
        var createResponse = await client.PostAsJsonAsync("/api/v1/visits",
            new CreateVisitRequest("Early Check Out", "55566677788", null, apartmentId, null));
        var created = await createResponse.Content.ReadFromJsonAsync<VisitResponse>();

        var checkOutResponse = await client.PostAsync($"/api/v1/visits/{created!.Id}/checkout", null);
        checkOutResponse.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateVisit_WithCheckInNow_LandsDirectlyCheckedIn()
    {
        var client = _factory.AsTenantA();
        var apartmentId = await _factory.SeedApartmentForTenantAAsync();
        var request = new CreateVisitRequest("Walk-in Wanda", "10203040506", null, apartmentId, "Errand", CheckInNow: true);

        var response = await client.PostAsJsonAsync("/api/v1/visits", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<VisitResponse>();
        body.Should().NotBeNull();
        body!.Status.Should().Be("CheckedIn");
        body.CheckedInAtUtc.Should().NotBeNull();
        body.CheckedOutAtUtc.Should().BeNull();
        body.AttendantProfileId.Should().NotBeNull();
    }

    [Fact]
    public async Task CrossTenant_GetVisit_AsDifferentTenant_Returns404()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();
        var apartmentId = await _factory.SeedApartmentForTenantAAsync();

        var createResponse = await clientA.PostAsJsonAsync("/api/v1/visits",
            new CreateVisitRequest("Cross Tenant Visit", "98765432100", null, apartmentId, null));
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await createResponse.Content.ReadFromJsonAsync<VisitResponse>();
        created.Should().NotBeNull();

        var getResponse = await clientB.GetAsync($"/api/v1/visits/{created!.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
