using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Errors;
using ControlEasyReborn.Modules.Security.Application.Handlers;
using ControlEasyReborn.Modules.Security.Application.Validators;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using ControlEasyReborn.SharedKernel.Email;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Security;

public sealed class ForgotPasswordHandlerTests
{
    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly IPasswordResetRequestRepository _passwordResetRequests = Substitute.For<IPasswordResetRequestRepository>();
    private readonly IRefreshTokenRepository _refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
    private readonly IPasswordHasher _passwordHasher = Substitute.For<IPasswordHasher>();
    private readonly ITempPasswordGenerator _tempPasswordGenerator = Substitute.For<ITempPasswordGenerator>();
    private readonly IEmailSender _emailSender = Substitute.For<IEmailSender>();
    private readonly IMemoryCache _memoryCache = new MemoryCache(new MemoryCacheOptions());
    private readonly ForgotPasswordRequestValidator _validator = new();

    private ForgotPasswordHandler CreateSut()
    {
        return new ForgotPasswordHandler(
            _users,
            _passwordResetRequests,
            _refreshTokenRepository,
            _passwordHasher,
            _tempPasswordGenerator,
            _emailSender,
            _memoryCache,
            _validator,
            NullLogger<ForgotPasswordHandler>.Instance);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("@missinguser.com")]
    public async Task HandleAsync_WhenValidationFails_ThrowsValidationException(string invalidEmail)
    {
        var sut = CreateSut();
        var request = new ForgotPasswordRequest(invalidEmail);

        var act = () => sut.HandleAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task HandleAsync_WhenUserNotFound_PerformsDecoyVerifyAndReturnsUniformResponse()
    {
        _passwordResetRequests.CountRecentRequestsAsync(Arg.Any<string>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(0);
        _users.FindByEmailAsync("UNKNOWN@TEST.COM", Arg.Any<CancellationToken>())
            .Returns((User?)null);
        var sut = CreateSut();
        var request = new ForgotPasswordRequest("unknown@test.com");

        var response = await sut.HandleAsync(request, CancellationToken.None);

        response.Message.Should().Be("If an account matches that email, instructions have been sent.");
        _passwordHasher.Received(1).Verify("DecoyDummyPassword123!", Arg.Any<string>());
        await _users.DidNotReceive().UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>());
        await _emailSender.DidNotReceive().SendEmailAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WhenUserNotAdmin_PerformsDecoyVerifyAndReturnsUniformResponse()
    {
        var user = new User(Guid.NewGuid(), Guid.NewGuid(), "porteiro@test.com", "hash", "Porteiro", true, false, "Porteiro", DateTime.UtcNow);
        _passwordResetRequests.CountRecentRequestsAsync(Arg.Any<string>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(0);
        _users.FindByEmailAsync("PORTEIRO@TEST.COM", Arg.Any<CancellationToken>())
            .Returns(user);
        var sut = CreateSut();
        var request = new ForgotPasswordRequest("porteiro@test.com");

        var response = await sut.HandleAsync(request, CancellationToken.None);

        response.Message.Should().Be("If an account matches that email, instructions have been sent.");
        _passwordHasher.Received(1).Verify("DecoyDummyPassword123!", Arg.Any<string>());
        await _users.DidNotReceive().UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>());
        await _emailSender.DidNotReceive().SendEmailAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WhenAdminUserInactive_PerformsDecoyVerifyAndReturnsUniformResponse()
    {
        var user = new User(Guid.NewGuid(), Guid.NewGuid(), "admin@test.com", "hash", "Admin", false, false, "TenantAdmin", DateTime.UtcNow);
        _passwordResetRequests.CountRecentRequestsAsync(Arg.Any<string>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(0);
        _users.FindByEmailAsync("ADMIN@TEST.COM", Arg.Any<CancellationToken>())
            .Returns(user);
        var sut = CreateSut();
        var request = new ForgotPasswordRequest("admin@test.com");

        var response = await sut.HandleAsync(request, CancellationToken.None);

        response.Message.Should().Be("If an account matches that email, instructions have been sent.");
        _passwordHasher.Received(1).Verify("DecoyDummyPassword123!", Arg.Any<string>());
        await _users.DidNotReceive().UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>());
        await _emailSender.DidNotReceive().SendEmailAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WhenEligibleAdmin_ResetsPasswordSendsEmailAndReturnsUniformResponse()
    {
        var user = new User(Guid.NewGuid(), Guid.NewGuid(), "admin@test.com", "oldHash", "Condo Admin", true, false, "TenantAdmin", DateTime.UtcNow);
        _passwordResetRequests.CountRecentRequestsAsync(Arg.Any<string>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(0);
        _users.FindByEmailAsync("ADMIN@TEST.COM", Arg.Any<CancellationToken>())
            .Returns(user);
        _tempPasswordGenerator.Generate(12).Returns("TempSecPass42");
        _passwordHasher.Hash("TempSecPass42").Returns("newHashedTemp");

        var sut = CreateSut();
        var request = new ForgotPasswordRequest("admin@test.com");

        var response = await sut.HandleAsync(request, CancellationToken.None);

        response.Message.Should().Be("If an account matches that email, instructions have been sent.");
        user.PasswordHash.Should().Be("newHashedTemp");
        user.MustChangePassword.Should().BeTrue();

        await _users.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
        await _refreshTokenRepository.Received(1).RevokeAllForUserAsync(user.Id, Arg.Any<CancellationToken>());
        await _passwordResetRequests.Received(1).AddAsync(Arg.Is<PasswordResetRequest>(r =>
            r.UserId == user.Id &&
            r.NormalizedEmail == "ADMIN@TEST.COM" &&
            r.HashedTempPassword == "newHashedTemp"), Arg.Any<CancellationToken>());
        await _emailSender.Received(1).SendEmailAsync(
            "admin@test.com",
            "Condo Admin",
            Arg.Any<string>(),
            Arg.Is<string>(b => b.Contains("TempSecPass42")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WhenIdempotentResend_ReusesCachedPasswordWithoutRehashing()
    {
        var user = new User(Guid.NewGuid(), Guid.NewGuid(), "admin@test.com", "oldHash", "Condo Admin", true, false, "TenantAdmin", DateTime.UtcNow);
        _passwordResetRequests.CountRecentRequestsAsync(Arg.Any<string>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(0);
        _users.FindByEmailAsync("ADMIN@TEST.COM", Arg.Any<CancellationToken>())
            .Returns(user);
        _tempPasswordGenerator.Generate(12).Returns("CachedPass42!");
        _passwordHasher.Hash("CachedPass42!").Returns("hashedCached");

        var sut = CreateSut();
        var request = new ForgotPasswordRequest("admin@test.com");

        // First attempt: generates and caches password
        await sut.HandleAsync(request, CancellationToken.None);

        // Second attempt within 15 minutes: re-sends same cached password
        _tempPasswordGenerator.ClearReceivedCalls();
        _passwordHasher.ClearReceivedCalls();
        _users.ClearReceivedCalls();

        var secondResponse = await sut.HandleAsync(request, CancellationToken.None);

        secondResponse.Message.Should().Be("If an account matches that email, instructions have been sent.");
        _tempPasswordGenerator.DidNotReceive().Generate(Arg.Any<int>());
        _passwordHasher.DidNotReceive().Hash(Arg.Any<string>());
        await _users.DidNotReceive().UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>());
        await _emailSender.Received(2).SendEmailAsync(
            "admin@test.com",
            "Condo Admin",
            Arg.Any<string>(),
            Arg.Is<string>(b => b.Contains("CachedPass42!")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WhenResetFloodDetected_SuppressesResetAndReturnsUniformResponse()
    {
        _passwordResetRequests.CountRecentRequestsAsync("ADMIN@TEST.COM", Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(5);
        var sut = CreateSut();
        var request = new ForgotPasswordRequest("admin@test.com");

        var response = await sut.HandleAsync(request, CancellationToken.None);

        response.Message.Should().Be("If an account matches that email, instructions have been sent.");
        await _users.DidNotReceive().FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        await _emailSender.DidNotReceive().SendEmailAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WhenEmailDeliveryFails_MarksRequestFailedWithoutThrowing()
    {
        var user = new User(Guid.NewGuid(), Guid.NewGuid(), "admin@test.com", "oldHash", "Condo Admin", true, false, "PlatformAdmin", DateTime.UtcNow);
        _passwordResetRequests.CountRecentRequestsAsync(Arg.Any<string>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(0);
        _users.FindByEmailAsync("ADMIN@TEST.COM", Arg.Any<CancellationToken>())
            .Returns(user);
        _tempPasswordGenerator.Generate(12).Returns("TempPassFail");
        _passwordHasher.Hash("TempPassFail").Returns("hashedFail");
        _emailSender.SendEmailAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("SMTP host down"));

        var sut = CreateSut();
        var request = new ForgotPasswordRequest("admin@test.com");

        var response = await sut.HandleAsync(request, CancellationToken.None);

        response.Message.Should().Be("If an account matches that email, instructions have been sent.");
        await _passwordResetRequests.Received(1).UpdateAsync(
            Arg.Is<PasswordResetRequest>(r => r.DeliveryState == "Failed" && r.FailureReason == "SMTP host down"),
            Arg.Any<CancellationToken>());
    }
}
