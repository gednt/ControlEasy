namespace ControlEasyReborn.Modules.Security.Application.Errors;

public sealed class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
}

public sealed class ValidationException : Exception
{
    public IReadOnlyDictionary<string, string[]> Errors { get; }
    public ValidationException(IReadOnlyDictionary<string, string[]> errors)
        : base("One or more validation errors occurred.")
    {
        Errors = errors;
    }
}

public sealed class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
}

public sealed class UnauthorizedException : Exception
{
    public UnauthorizedException(string message) : base(message) { }
}

public sealed class ForbiddenException : Exception
{
    public ForbiddenException(string message = "Forbidden") : base(message) { }
}