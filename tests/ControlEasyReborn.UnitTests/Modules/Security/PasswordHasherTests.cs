using ControlEasyReborn.Modules.Security.Infrastructure.Persistence;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Security;

public sealed class PasswordHasherTests
{
    private readonly PasswordHasher _sut = new();

    [Fact]
    public void WorkFactor_ShouldBeExplicitlyPinnedToAtLeast11()
    {
        PasswordHasher.WorkFactor.Should().BeGreaterThanOrEqualTo(11);
    }

    [Fact]
    public void Hash_ShouldProduceBcryptHashWithWorkFactor11()
    {
        var password = "SecurePassword123!";
        var hash = _sut.Hash(password);

        hash.Should().NotBeNullOrWhiteSpace();
        hash.Should().MatchRegex(@"^\$2[abxy]\$11\$");
    }

    [Fact]
    public void Verify_WithCorrectPassword_ShouldReturnTrue()
    {
        var password = "CorrectPassword123!";
        var hash = _sut.Hash(password);

        _sut.Verify(password, hash).Should().BeTrue();
    }

    [Fact]
    public void Verify_WithWrongPassword_ShouldReturnFalse()
    {
        var password = "CorrectPassword123!";
        var hash = _sut.Hash(password);

        _sut.Verify("WrongPassword456!", hash).Should().BeFalse();
    }
}
