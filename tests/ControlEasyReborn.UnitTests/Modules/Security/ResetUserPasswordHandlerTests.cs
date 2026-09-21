using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Errors;
using ControlEasyReborn.Modules.Security.Application.Handlers;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Security;

public sealed class ResetUserPasswordHandlerTests
{
    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly IPasswordResetRequestRepository _passwordResetRequests = Substitute.For<IPasswordResetRequestRepository>();
    private readonly IRefreshTokenRepository _refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
    private readonly IPasswordHasher _passwordHasher = Substitute.For<IPasswordHasher>();
    private readonly ITempPasswordGenerator _tempPasswordGenerator = Substitute.For<ITempPasswordGenerator>();
    private readonly ITenantContext _tenantContext = Substitute.For<ITenantContext>();

    private ResetUserPasswordHandler CreateSut()
    {
        return new ResetUserPasswordHandler(
            _users,
            _passwordResetRequests,
            _refreshTokenRepository,
            _passwordHasher,
            _tempPasswordGenerator,
            _tenantContext,
            NullLogger<ResetUserPasswordHandler>.Instance);
    }

    [Fact]
    public async Task HandleAsync_WhenCallerNeitherPlatformNorTenantAdmin_ThrowsForbiddenException()
    {
        _tenantContext.IsPlatformAdmin.Returns(false);
        _tenantContext.Roles.Returns(new[] { "Resident" });
        var sut = CreateSut();

        var act = () => sut.HandleAsync(Guid.NewGuid(), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Insufficient permissions*");
    }

    [Fact]
    public async Task HandleAsync_WhenTargetUserNotFound_ThrowsNotFoundException()
    {
        var targetUserId = Guid.NewGuid();
        _tenantContext.IsPlatformAdmin.Returns(true);
        _tenantContext.Roles.Returns(new[] { "PlatformAdmin" });
        _users.FindAsync(targetUserId, Arg.Any<CancellationToken>()).Returns((User?)null);
        var sut = CreateSut();

        var act = () => sut.HandleAsync(targetUserId, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{targetUserId}*");
    }

    [Fact]
    public async Task HandleAsync_WhenTenantAdminResetsUserInAnotherTenant_ThrowsForbiddenException()
    {
        var callerTenantId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();
        var targetUserId = Guid.NewGuid();

        _tenantContext.IsPlatformAdmin.Returns(false);
        _tenantContext.Roles.Returns(new[] { "TenantAdmin" });
        _tenantContext.TenantId.Returns(callerTenantId);

        var targetUser = new User(targetUserId, otherTenantId, "porteiro@other.com", "hash", "Porteiro User", true, false, "Porteiro", DateTime.UtcNow);
        _users.FindAsync(targetUserId, Arg.Any<CancellationToken>()).Returns(targetUser);
        var sut = CreateSut();

        var act = () => sut.HandleAsync(targetUserId, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*another condominium*");
    }

    [Fact]
    public async Task HandleAsync_WhenTenantAdminResetsNonPorteiroInSameTenant_ThrowsForbiddenException()
    {
        var tenantId = Guid.NewGuid();
        var targetUserId = Guid.NewGuid();

        _tenantContext.IsPlatformAdmin.Returns(false);
        _tenantContext.Roles.Returns(new[] { "TenantAdmin" });
        _tenantContext.TenantId.Returns(tenantId);

        var targetUser = new User(targetUserId, tenantId, "admin2@tenant.com", "hash", "Admin Two", true, false, "TenantAdmin", DateTime.UtcNow);
        _users.FindAsync(targetUserId, Arg.Any<CancellationToken>()).Returns(targetUser);
        var sut = CreateSut();

        var act = () => sut.HandleAsync(targetUserId, CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*only reset gatekeeper passwords*");
    }

    [Fact]
    public async Task HandleAsync_WhenTenantAdminResetsOwnPorteiro_SucceedsAndRevokesTokens()
    {
        var tenantId = Guid.NewGuid();
        var targetUserId = Guid.NewGuid();
        var callerProfileId = Guid.NewGuid();

        _tenantContext.IsPlatformAdmin.Returns(false);
        _tenantContext.Roles.Returns(new[] { "TenantAdmin" });
        _tenantContext.TenantId.Returns(tenantId);
        _tenantContext.ProfileId.Returns(callerProfileId);

        var targetUser = new User(targetUserId, tenantId, "porteiro@tenant.com", "oldhash", "Porteiro One", true, false, "Porteiro", DateTime.UtcNow);
        _users.FindAsync(targetUserId, Arg.Any<CancellationToken>()).Returns(targetUser);
        _tempPasswordGenerator.Generate(12).Returns("TempPass1234!");
        _passwordHasher.Hash("TempPass1234!").Returns("newHashedPassword11");

        var sut = CreateSut();
        var result = await sut.HandleAsync(targetUserId, CancellationToken.None);

        result.UserId.Should().Be(targetUserId);
        result.TempPassword.Should().Be("TempPass1234!");
        result.MustChangePassword.Should().BeTrue();

        targetUser.MustChangePassword.Should().BeTrue();
        targetUser.PasswordHash.Should().Be("newHashedPassword11");

        await _users.Received(1).UpdateAsync(targetUser, Arg.Any<CancellationToken>());
        await _passwordResetRequests.Received(1).AddAsync(Arg.Is<PasswordResetRequest>(r =>
            r.UserId == targetUserId &&
            r.TenantId == tenantId &&
            r.HashedTempPassword == "newHashedPassword11" &&
            r.DeliveryState == "Sent"), Arg.Any<CancellationToken>());
        await _refreshTokenRepository.Received(1).RevokeAllForUserAsync(targetUserId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WhenPlatformAdminResetsAnyUser_SucceedsAndRevokesTokens()
    {
        var tenantId = Guid.NewGuid();
        var targetUserId = Guid.NewGuid();
        var callerProfileId = Guid.NewGuid();

        _tenantContext.IsPlatformAdmin.Returns(true);
        _tenantContext.Roles.Returns(new[] { "PlatformAdmin" });
        _tenantContext.ProfileId.Returns(callerProfileId);

        var targetUser = new User(targetUserId, tenantId, "syndic@tenant.com", "oldhash", "Syndic User", true, false, "TenantAdmin", DateTime.UtcNow);
        _users.FindAsync(targetUserId, Arg.Any<CancellationToken>()).Returns(targetUser);
        _tempPasswordGenerator.Generate(12).Returns("PlatformReset12!");
        _passwordHasher.Hash("PlatformReset12!").Returns("hashedPlatformReset");

        var sut = CreateSut();
        var result = await sut.HandleAsync(targetUserId, CancellationToken.None);

        result.UserId.Should().Be(targetUserId);
        result.TempPassword.Should().Be("PlatformReset12!");
        result.MustChangePassword.Should().BeTrue();

        targetUser.MustChangePassword.Should().BeTrue();
        targetUser.PasswordHash.Should().Be("hashedPlatformReset");

        await _users.Received(1).UpdateAsync(targetUser, Arg.Any<CancellationToken>());
        await _passwordResetRequests.Received(1).AddAsync(Arg.Any<PasswordResetRequest>(), Arg.Any<CancellationToken>());
        await _refreshTokenRepository.Received(1).RevokeAllForUserAsync(targetUserId, Arg.Any<CancellationToken>());
    }
}
