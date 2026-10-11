namespace ControlEasyReborn.Modules.Security.Domain.Entities;

public sealed class Gatehouse
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Location { get; private set; }
    public bool Active { get; private set; }

    private Gatehouse() { }

    public Gatehouse(Guid id, Guid tenantId, string name, string? location, bool active = true)
    {
        Id = id;
        TenantId = tenantId;
        Name = name;
        Location = location;
        Active = active;
    }

    public void SetActive(bool active) => Active = active;
}
