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
public sealed class DeviceUnlockEndpointTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;

    public DeviceUnlockEndpointTests(MySqlContainerFixture mySql)
    {
        _fx = new DevicesTestFixture(mySql);
    }

    public async Task InitializeAsync()
    {
        await _fx.InitializeAsync();
        await _fx.SeedAsync();
        await _fx.ResetSimulatorAsync();
    }

    public Task DisposeAsync() => _fx.DisposeAsync();

    private HttpClient CreateClient(string[] roles, string[] permissions, Guid? profileId = null)
    {
        var client = _fx.Factory.CreateClient();
        var token = JwtTestHelper.GenerateToken(
            userId: Guid.NewGuid(),
            email: $"{roles[0].ToLowerInvariant()}-{Guid.NewGuid()}@controleasy.test",
            tenantId: _fx.TenantId,
            profileId: profileId ?? _fx.ActorProfileId,
            roles: roles,
            permissions: permissions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private HttpClient PorteiroClient() =>
        CreateClient(new[] { "Porteiro" }, new[] { "devices.unlock" });

    [Fact]
    public async Task Unlock_WithValidSignature_ReturnsSuccess()
    {
        var client = PorteiroClient();
        var request = _fx.BuildSignedRequest();

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<DoorUnlockResponse>();
        body.Should().NotBeNull();
        body!.Outcome.Should().Be("success");
        body.DeviceId.Should().Be(_fx.DeviceId);

        (await _fx.CountAuditRowsByOutcomeAsync("Success")).Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task Unlock_WithInvalidSignature_ReturnsAuthFailed()
    {
        var client = PorteiroClient();
        var request = _fx.BuildRequestWithWrongSignature();

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", request);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var beforeAuditCount = await _fx.CountDeviceUnlockAuditRowsAsync();
        (await _fx.CountAuditRowsByOutcomeAsync("AuthFailed")).Should().Be(0);
    }

    [Fact]
    public async Task Unlock_WithExpiredTimestamp_ReturnsAuthFailed()
    {
        var client = PorteiroClient();
        var request = _fx.BuildRequestWithExpiredTimestamp();

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", request);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Unlock_WithReplayedNonce_ReturnsAuthFailed()
    {
        var client = PorteiroClient();
        var nonce = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var firstRequest = _fx.BuildSignedRequest(nonceBase64Url: nonce);
        var secondRequest = _fx.BuildSignedRequest(nonceBase64Url: nonce);

        var firstResponse = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", firstRequest);
        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var secondResponse = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", secondRequest);
        secondResponse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Unlock_ExceedingRateLimit_Returns429ThenSuccess()
    {
        var client = PorteiroClient();

        var first = _fx.BuildSignedRequest();
        var firstResponse = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", first);
        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var second = _fx.BuildSignedRequest();
        var secondResponse = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", second);
        secondResponse.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        (await _fx.CountAuditRowsByOutcomeAsync("RateLimited")).Should().BeGreaterThanOrEqualTo(1);

        await Task.Delay(TimeSpan.FromSeconds(4));

        var third = _fx.BuildSignedRequest();
        var thirdResponse = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", third);
        thirdResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Unlock_WithUnknownDevice_ReturnsUnknownDevice()
    {
        var client = PorteiroClient();
        var unknownDeviceId = Guid.NewGuid();
        var nonce = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var ts = DateTime.UtcNow.ToUniversalTime();
        var timestampIso = ts.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        var bodyHash = new string('0', 64);

        var canonical = $"POST\n{unknownDeviceId:D}\n{timestampIso}\n{nonce}\n{bodyHash}";
        var key = _fx.GetTenantHmacKey();
        using var hmac = new System.Security.Cryptography.HMACSHA256(key);
        var sig = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(canonical));
        var sigBase64 = Convert.ToBase64String(sig).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var request = new DoorUnlockRequest(
            Nonce: nonce,
            TimestampUtc: ts,
            Signature: sigBase64,
            BodyHash: bodyHash);

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{unknownDeviceId}/unlock", request);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Unlock_WhenTenantFlagDisabled_Returns404()
    {
        await _fx.SetDoorIntegrationEnabledAsync(false);

        var client = PorteiroClient();
        var request = _fx.BuildSignedRequest();

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", request);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        await _fx.SetDoorIntegrationEnabledAsync(true);
    }

    [Fact]
    public async Task Unlock_AsNonPorteiro_Returns403()
    {
        var client = CreateClient(
            roles: new[] { "TenantAdmin" },
            permissions: Array.Empty<string>());

        var request = _fx.BuildSignedRequest();

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/unlock", request);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}