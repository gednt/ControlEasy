namespace ControlEasyReborn.Modules.Devices.Application.Errors;

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

// Phase 25 - raised by DeviceEventRepository.InsertAsync when the MySQL
// UNIQUE constraint uq_device_events_idempotent fires (errno 1062).
// The IngestDeviceEventHandler catches this as the idempotency-race signal.
public sealed class DuplicateIdempotencyKeyException : Exception
{
    public DuplicateIdempotencyKeyException(string message) : base(message) { }
}
