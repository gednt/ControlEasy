using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

[Collection("Devices Collection")]
public sealed class SimulatorHarnessTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;

    public SimulatorHarnessTests(MySqlContainerFixture mySql) => _fx = new DevicesTestFixture(mySql);

    public async Task InitializeAsync()
    {
        await _fx.InitializeAsync();
        await _fx.SeedAsync();
        await _fx.ResetSimulatorAsync();
    }

    public Task DisposeAsync() => _fx.DisposeAsync();

    private HttpClient PorteiroClient()
    {
        var client = _fx.Factory.CreateClient();
        var token = JwtTestHelper.GenerateToken(
            userId: Guid.NewGuid(),
            email: $"sim-porteiro-{Guid.NewGuid()}@controleasy.test",
            tenantId: _fx.TenantId,
            profileId: _fx.ActorProfileId,
            roles: new[] { "Porteiro" },
            permissions: new[] { "devices.unlock" });

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private void ConfigureSimulator(SimulatorFailureMode mode)
    {
        using var scope = _fx.Factory.Services.CreateScope();
        var state = scope.ServiceProvider.GetRequiredService<IDoorSimulatorState>();
        state.SetFailureMode(_fx.DeviceId, mode);
    }

    private IReadOnlyList<SimulatedAttempt> GetAttempts()
    {
        using var scope = _fx.Factory.Services.CreateScope();
        var state = scope.ServiceProvider.GetRequiredService<IDoorSimulatorState>();
        return state.GetAttempts(_fx.TenantId, _fx.DeviceId);
    }

    [Fact]
    public async Task Simulator_RecordsAttempt_OnUnlock()
    {
        var client = PorteiroClient();
        var request = _fx.BuildSignedRequest();

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var attempts = GetAttempts();
        attempts.Should().HaveCount(1);
        attempts[0].Outcome.Should().Be("Success");
    }

    [Fact]
    public async Task Simulator_HonorsFailureMode_AuthFailed()
    {
        ConfigureSimulator(SimulatorFailureMode.AlwaysAuthFailed);

        var client = PorteiroClient();
        var request = _fx.BuildSignedRequest();

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", request);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var attempts = GetAttempts();
        attempts.Should().HaveCount(1);
        attempts[0].Outcome.Should().Be("AuthFailed");
    }

    [Fact]
    public async Task Simulator_HonorsOffline_DeviceOffline()
    {
        ConfigureSimulator(SimulatorFailureMode.AlwaysDeviceOffline);

        var client = PorteiroClient();
        var request = _fx.BuildSignedRequest();

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", request);
        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);

        var attempts = GetAttempts();
        attempts.Should().HaveCount(1);
        attempts[0].Outcome.Should().Be("DeviceOffline");
    }

    [Fact]
    public async Task Simulator_FailsThenRecovers()
    {
        ConfigureSimulator(SimulatorFailureMode.FailsThenRecovers);

        var client = PorteiroClient();
        var attempts = new List<string>();

        for (var i = 0; i < 4; i++)
        {
            var request = _fx.BuildSignedRequest();
            var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", request);
            attempts.Add(((int)response.StatusCode).ToString());
            // Wait between attempts to clear the per-device rate limit window.
            await Task.Delay(TimeSpan.FromSeconds(4));
        }

        // FailsThenRecover: attempts 1+2 are AuthFailed, attempt 3 succeeds.
        attempts[0].Should().Be(((int)HttpStatusCode.Unauthorized).ToString());
        attempts[1].Should().Be(((int)HttpStatusCode.Unauthorized).ToString());
        attempts[2].Should().Be(((int)HttpStatusCode.OK).ToString());
    }
}