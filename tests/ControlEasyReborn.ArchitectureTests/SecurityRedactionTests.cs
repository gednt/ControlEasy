using System.Text.RegularExpressions;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.ArchitectureTests;

public sealed class SecurityRedactionTests
{
    [Fact]
    public void Security_and_Email_code_must_never_log_passwords_or_temp_passwords()
    {
        var root = FindRepositoryRoot();
        var searchRoots = new[]
        {
            Path.Combine(root, "src", "Modules", "Security"),
            Path.Combine(root, "src", "BuildingBlocks", "ControlEasyReborn.Infrastructure", "Email")
        };

        // Pattern matching any logger call that includes password/temppassword in template placeholders
        // or passes password/temppassword variables into logging parameters.
        var forbiddenLogPatterns = new[]
        {
            new Regex(@"_logger\.Log\w*\([^;]*\{[^}]*(?:password|temppassword)[^}]*\}[^;]*\)", RegexOptions.IgnoreCase | RegexOptions.Compiled),
            new Regex(@"_logger\.Log\w*\([^;]*,\s*(?:tempPassword|password|newPassword|currentPassword)\b[^;]*\)", RegexOptions.IgnoreCase | RegexOptions.Compiled)
        };

        var violations = new List<string>();

        foreach (var dir in searchRoots)
        {
            if (!Directory.Exists(dir)) continue;

            foreach (var path in Directory.EnumerateFiles(dir, "*.cs", SearchOption.AllDirectories))
            {
                if (path.Contains(Path.Combine("bin", "")) || path.Contains(Path.Combine("obj", "")))
                {
                    continue;
                }

                var content = File.ReadAllText(path);
                foreach (var pattern in forbiddenLogPatterns)
                {
                    var matches = pattern.Matches(content);
                    foreach (Match match in matches)
                    {
                        violations.Add($"{Path.GetFileName(path)}: '{match.Value.Trim()}' — Sensitive password data must never be logged (PASS-04).");
                    }
                }
            }
        }

        violations.Should().BeEmpty(string.Join(Environment.NewLine, violations));
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "AGENTS.md"))
                || (Directory.Exists(Path.Combine(directory.FullName, "src"))
                    && Directory.Exists(Path.Combine(directory.FullName, "tests"))
                    && File.Exists(Path.Combine(directory.FullName, "global.json"))))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Could not locate the repository root from the test output directory.");
    }
}
