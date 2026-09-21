using ControlEasyReborn.Modules.Security.Infrastructure.Persistence;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Security;

public sealed class TempPasswordGeneratorTests
{
    private readonly TempPasswordGenerator _sut = new();

    [Fact]
    public void Generate_DefaultLength_ShouldBeAtLeast12()
    {
        var password = _sut.Generate();
        password.Length.Should().Be(12);
    }

    [Fact]
    public void Generate_CustomLength_ShouldMatchRequestedLength()
    {
        var password = _sut.Generate(16);
        password.Length.Should().Be(16);
    }

    [Fact]
    public void Generate_LengthLessThan8_ShouldFallbackTo12()
    {
        var password = _sut.Generate(5);
        password.Length.Should().Be(12);
    }

    [Fact]
    public void Generate_ShouldContainRequiredCharacterClasses()
    {
        for (int i = 0; i < 20; i++)
        {
            var password = _sut.Generate();
            password.Any(c => TempPasswordGenerator.Digits.Contains(c)).Should().BeTrue();
            password.Any(c => TempPasswordGenerator.Uppercase.Contains(c)).Should().BeTrue();
            password.Any(c => TempPasswordGenerator.Lowercase.Contains(c)).Should().BeTrue();
            password.Any(c => TempPasswordGenerator.Symbols.Contains(c)).Should().BeTrue();
        }
    }

    [Fact]
    public void Generate_ShouldNotContainAmbiguousCharacters()
    {
        // 0, O, o, 1, l, I must never appear per PASS-05
        char[] ambiguous = ['0', 'O', 'o', '1', 'l', 'I'];
        for (int i = 0; i < 50; i++)
        {
            var password = _sut.Generate();
            password.IndexOfAny(ambiguous).Should().Be(-1, "Password '{0}' contains ambiguous character", password);
        }
    }

    [Fact]
    public void Generate_MultipleCalls_ShouldProduceDistinctPasswords()
    {
        var passwords = Enumerable.Range(0, 10).Select(_ => _sut.Generate()).ToHashSet();
        passwords.Count.Should().Be(10);
    }
}
