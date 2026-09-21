using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.SharedKernel.Demo;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Data;

namespace ControlEasyReborn.Infrastructure.Demo;

public sealed class DemoSeederService : IHostedService
{
    private readonly ITenantAwareLinqFactory _linqFactory;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly DemoOptions _options;
    private readonly ILogger<DemoSeederService> _logger;

    public DemoSeederService(
        ITenantAwareLinqFactory linqFactory,
        IServiceScopeFactory scopeFactory,
        IOptions<DemoOptions> options,
        ILogger<DemoSeederService> logger)
    {
        _linqFactory = linqFactory;
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
            return Task.CompletedTask;

        return SeedAsync(force: false, cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public async Task SeedAsync(bool force, CancellationToken ct)
    {
        if (!_options.Enabled)
            return;

        var db = _linqFactory.Create(NullTenantContext.Instance, bypassTenantFilter: true);
        var currentVersion = await ReadSeedVersionAsync(db, ct);

        if (!force && currentVersion >= _options.SeedVersion)
        {
            _logger.LogInformation("Demo seed skipped — version {CurrentVersion} >= {TargetVersion}.", currentVersion, _options.SeedVersion);
            await BackfillAttendantProfilePermissionsAsync(db, ct);
            return;
        }

        if (force || currentVersion > 0)
            await ClearDemoDataAsync(db, ct);

        using var scope = _scopeFactory.CreateScope();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var passwordHash = passwordHasher.Hash(DemoIds.DemoPassword);
        var now = DateTime.UtcNow;

        await SeedTenantsAsync(db, now, ct);
        await SeedUsersAsync(db, passwordHash, now, ct);
        await SeedSecurityInfrastructureAsync(db, now, ct);
        await SeedAttendantProfilesAsync(db, now, ct);
        await SeedApartmentsAsync(db, DemoIds.AuroraTenantId, DemoFixtures.AuroraResidents, now, ct);
        await SeedApartmentsAsync(db, DemoIds.ParqueVerdeTenantId, DemoFixtures.ParqueVerdeResidents, now, ct);
        await SeedResidentsAsync(db, DemoIds.AuroraTenantId, DemoFixtures.AuroraResidents, 0, now, ct);
        await SeedResidentsAsync(db, DemoIds.ParqueVerdeTenantId, DemoFixtures.ParqueVerdeResidents, DemoFixtures.AuroraResidents.Length, now, ct);
        await SeedVisitsAsync(db, now, ct);
        await SeedVehiclesAsync(db, now, ct);
        await SeedServiceProvidersAsync(db, now, ct);
        await WriteSeedVersionAsync(db, _options.SeedVersion, now, ct);

        _logger.LogInformation(
            "Demo seed complete. Version={SeedVersion}. Tenants=demo-aurora,demo-parque-verde",
            _options.SeedVersion);
    }

    private static async Task<int> ReadSeedVersionAsync(IAsyncSqlClient db, CancellationToken ct)
    {
        var rows = await db.SelectAsync(
            fields: "SeedVersion",
            table: "DemoMetadata",
            whereClause: "Id = 1",
            parameters: Array.Empty<object>(),
            ct: ct);

        if (rows is null || rows.Rows.Count == 0)
            return 0;

        return Convert.ToInt32(rows.Rows[0]["SeedVersion"]);
    }

    private static async Task WriteSeedVersionAsync(IAsyncSqlClient db, int version, DateTime now, CancellationToken ct)
    {
        var existing = await ReadSeedVersionAsync(db, ct);
        if (existing == 0)
        {
            await db.InsertAsync(
                new[] { "Id", "SeedVersion", "SeededAtUtc" },
                "DemoMetadata",
                new object[] { 1, version, now },
                primaryKeyName: "Id",
                autoIncrement: false,
                ct: ct);
        }
        else
        {
            await db.UpdateAsync(
                new[] { "SeedVersion", "SeededAtUtc" },
                "DemoMetadata",
                new[] { version.ToString(), now.ToString("o") },
                "Id = 1",
                Array.Empty<object>(),
                ct: ct);
        }
    }

    private static async Task ClearDemoDataAsync(IAsyncSqlClient db, CancellationToken ct)
    {
        var demoTenantIds = new[] { DemoIds.AuroraTenantId, DemoIds.ParqueVerdeTenantId };

        foreach (var tenantId in demoTenantIds)
        {
            await db.DeleteAsync("Visits", "tenant_id = @param0", new object[] { tenantId }, ct);
            await db.DeleteAsync("Vehicles", "tenant_id = @param0", new object[] { tenantId }, ct);
            await db.DeleteAsync("ServiceProviders", "tenant_id = @param0", new object[] { tenantId }, ct);
            await db.DeleteAsync("Residents", "tenant_id = @param0", new object[] { tenantId }, ct);
            await db.DeleteAsync("Apartments", "tenant_id = @param0", new object[] { tenantId }, ct);
            await db.DeleteAsync("AttendantProfiles", "tenant_id = @param0", new object[] { tenantId }, ct);
            await db.DeleteAsync("Shifts", "tenant_id = @param0", new object[] { tenantId }, ct);
            await db.DeleteAsync("Gatehouses", "tenant_id = @param0", new object[] { tenantId }, ct);
        }

        var demoEmails = new[]
        {
            "platform@controleasy.app",
            "admin@controleasy.app",
            "porteiro@controleasy.app",
            "morador@controleasy.app",
            "multi@controleasy.app"
        };

        foreach (var email in demoEmails)
            await db.DeleteAsync("Users", "Email = @param0", new object[] { email }, ct);

        await db.DeleteAsync("AttendantProfiles", "UserId = @param0", new object[] { DemoIds.PlatformUserId }, ct);
        await db.DeleteAsync("Tenants", "Id = @param0", new object[] { DemoIds.AuroraTenantId }, ct);
        await db.DeleteAsync("Tenants", "Id = @param0", new object[] { DemoIds.ParqueVerdeTenantId }, ct);
    }

    private static async Task SeedTenantsAsync(IAsyncSqlClient db, DateTime now, CancellationToken ct)
    {
        await UpsertTenantAsync(db, DemoIds.AuroraTenantId, "demo-aurora", "[Demo] Residencial Aurora", now, ct);
        await UpsertTenantAsync(db, DemoIds.ParqueVerdeTenantId, "demo-parque-verde", "[Demo] Condomínio Parque Verde", now, ct);
    }

    private static async Task UpsertTenantAsync(IAsyncSqlClient db, Guid id, string slug, string displayName, DateTime now, CancellationToken ct)
    {
        var existing = await db.SelectAsync("Id", "Tenants", "Id = @param0", new object[] { id }, ct);
        if (existing is not null && existing.Rows.Count > 0)
            return;

        await db.InsertAsync(
            new[] { "Id", "Slug", "DisplayName", "Status", "CreatedAtUtc" },
            "Tenants",
            new object[] { id, slug, displayName, 0, now },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    private static async Task SeedUsersAsync(IAsyncSqlClient db, string passwordHash, DateTime now, CancellationToken ct)
    {
        await InsertUserAsync(db, DemoIds.PlatformUserId, DemoIds.PlatformTenantId, "platform@controleasy.app", passwordHash, "Platform Admin", "PlatformAdmin", now, ct);
        await InsertUserAsync(db, DemoIds.AdminUserId, DemoIds.AuroraTenantId, "admin@controleasy.app", passwordHash, "Demo Admin", "TenantAdmin", now, ct);
        await InsertUserAsync(db, DemoIds.PorteiroUserId, DemoIds.AuroraTenantId, "porteiro@controleasy.app", passwordHash, "Demo Porteiro", "AttendantProfile", now, ct);
        await InsertUserAsync(db, DemoIds.MoradorUserId, DemoIds.AuroraTenantId, "morador@controleasy.app", passwordHash, "Demo Morador", "Morador", now, ct);
        await InsertUserAsync(db, DemoIds.MultiUserId, DemoIds.AuroraTenantId, "multi@controleasy.app", passwordHash, "Demo Multi", "TenantAdmin,AttendantProfile", now, ct);
    }

    private static async Task InsertUserAsync(
        IAsyncSqlClient db,
        Guid id,
        Guid tenantId,
        string email,
        string passwordHash,
        string displayName,
        string roles,
        DateTime now,
        CancellationToken ct)
    {
        var existing = await db.SelectAsync("Id", "Users", "Email = @param0", new object[] { email }, ct);
        if (existing is not null && existing.Rows.Count > 0)
            return;

        await db.InsertAsync(
            new[] { "Id", "TenantId", "Email", "PasswordHash", "DisplayName", "Active", "MustChangePassword", "Roles", "CreatedAtUtc", "tenant_id" },
            "Users",
            new object[] { id, tenantId, email, passwordHash, displayName, true, false, roles, now, tenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    private static async Task SeedSecurityInfrastructureAsync(IAsyncSqlClient db, DateTime now, CancellationToken ct)
    {
        await InsertShiftAsync(db, DemoIds.AuroraShiftId, DemoIds.AuroraTenantId, "Manhã", TimeSpan.FromHours(6), TimeSpan.FromHours(14), now, ct);
        await InsertShiftAsync(db, DemoIds.ParqueShiftId, DemoIds.ParqueVerdeTenantId, "Tarde", TimeSpan.FromHours(14), TimeSpan.FromHours(22), now, ct);
        await InsertGatehouseAsync(db, DemoIds.AuroraGatehouseId, DemoIds.AuroraTenantId, "Portaria Principal", "Entrada Vila das Flores", now, ct);
        await InsertGatehouseAsync(db, DemoIds.ParqueGatehouseId, DemoIds.ParqueVerdeTenantId, "Portaria Parque", "Av. Verde 100", now, ct);
    }

    private static async Task InsertShiftAsync(
        IAsyncSqlClient db, Guid id, Guid tenantId, string name, TimeSpan start, TimeSpan end, DateTime now, CancellationToken ct)
    {
        var existing = await db.SelectAsync("Id", "Shifts", "Id = @param0", new object[] { id }, ct);
        if (existing is not null && existing.Rows.Count > 0)
            return;

        var crossesMidnight = end < start;
        await db.InsertAsync(
            new[] { "Id", "TenantId", "Name", "StartTime", "EndTime", "CrossesMidnight", "tenant_id" },
            "Shifts",
            new object[] { id, tenantId, name, start, end, crossesMidnight, tenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    private static async Task InsertGatehouseAsync(
        IAsyncSqlClient db, Guid id, Guid tenantId, string name, string? location, DateTime now, CancellationToken ct)
    {
        var existing = await db.SelectAsync("Id", "Gatehouses", "Id = @param0", new object[] { id }, ct);
        if (existing is not null && existing.Rows.Count > 0)
            return;

        await db.InsertAsync(
            new[] { "Id", "TenantId", "Name", "Location", "tenant_id" },
            "Gatehouses",
            new object[] { id, tenantId, name, location ?? (object)DBNull.Value, tenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    private static async Task SeedAttendantProfilesAsync(IAsyncSqlClient db, DateTime now, CancellationToken ct)
    {
        const string accessOperate = "Access.Read,Access.Access.Operate,Access.Control.Issue,Access.Control.Replace,Access.Control.Revoke";
        const string accessReadOnly = "Access.Read,Access.Access.Operate";
        const string allPerms = "Visits.CheckIn,Visits.CheckOut,Visits.Read,Apartments.Read,Apartments.Write,Residents.Read,Residents.Write,Vehicles.Read,Vehicles.Write,ServiceProviders.Read,ServiceProviders.Write,Reports.Read,Photos.Read,Photos.Write,Photos.Delete," + accessOperate;
        const string readPerms = "Visits.Read,Apartments.Read,Residents.Read,Vehicles.Read,ServiceProviders.Read,Reports.Read,Photos.Read,Photos.Write," + accessReadOnly;
        const string moradorPerms = "Visits.Read,Apartments.Read,Residents.Read,Vehicles.Read,ServiceProviders.Read,Reports.Read,Photos.Read,Photos.Write";
        const string platformPerms = "platform:*";

        await InsertProfileAsync(db, DemoIds.PlatformProfileId, DemoIds.PlatformTenantId, DemoIds.PlatformUserId, "Platform Admin", DemoIds.AuroraShiftId, DemoIds.AuroraGatehouseId, platformPerms, now, ct);
        await InsertProfileAsync(db, DemoIds.AdminProfileId, DemoIds.AuroraTenantId, DemoIds.AdminUserId, "Administrador Aurora", DemoIds.AuroraShiftId, DemoIds.AuroraGatehouseId, allPerms, now, ct);
        await InsertProfileAsync(db, DemoIds.PorteiroProfileId, DemoIds.AuroraTenantId, DemoIds.PorteiroUserId, "Porteiro Aurora", DemoIds.AuroraShiftId, DemoIds.AuroraGatehouseId, readPerms, now, ct);
        await InsertProfileAsync(db, DemoIds.MoradorProfileId, DemoIds.AuroraTenantId, DemoIds.MoradorUserId, "Morador Aurora", null, null, moradorPerms, now, ct);
        await InsertProfileAsync(db, DemoIds.MultiAuroraProfileId, DemoIds.AuroraTenantId, DemoIds.MultiUserId, "Multi Aurora", DemoIds.AuroraShiftId, DemoIds.AuroraGatehouseId, allPerms, now, ct);
        await InsertProfileAsync(db, DemoIds.MultiParqueProfileId, DemoIds.ParqueVerdeTenantId, DemoIds.MultiUserId, "Multi Parque", DemoIds.ParqueShiftId, DemoIds.ParqueGatehouseId, allPerms, now, ct);
    }

    private async Task BackfillAttendantProfilePermissionsAsync(IAsyncSqlClient db, CancellationToken ct)
    {
        const string marker = "Access.Access.Operate";
        const string accessRead = "Access.Read";
        const string issueMarker = "Access.Control.Issue";
        var rows = await db.SelectAsync(
            fields: "Id,Permissions",
            table: "AttendantProfiles",
            whereClause: "(Permissions NOT LIKE @param0 OR (Permissions LIKE '%Visits.CheckIn%' AND Permissions NOT LIKE @param2)) AND Permissions <> 'platform:*' AND Id <> @param1",
            parameters: new object[] { "%" + marker + "%", DemoIds.MoradorProfileId, "%" + issueMarker + "%" },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0)
            return;

        var adminCredentialPerms = new[]
        {
            "Access.Control.Issue",
            "Access.Control.Replace",
            "Access.Control.Revoke"
        };

        foreach (DataRow row in rows.Rows)
        {
            var id = row["Id"].ToString() ?? string.Empty;
            var current = row["Permissions"]?.ToString() ?? string.Empty;
            var normalizedTokens = current
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(t => t.Trim())
                .ToList();
            var tokenSet = new HashSet<string>(normalizedTokens, StringComparer.OrdinalIgnoreCase);

            var added = new List<string>();
            if (!tokenSet.Contains(marker))
            {
                normalizedTokens.Add(marker);
                tokenSet.Add(marker);
                added.Add(marker);
            }
            if (!tokenSet.Contains(accessRead))
            {
                normalizedTokens.Add(accessRead);
                tokenSet.Add(accessRead);
                added.Add(accessRead);
            }

            var isAdminProfile = tokenSet.Contains("Visits.CheckIn") ||
                id.Equals(DemoIds.AdminProfileId.ToString(), StringComparison.OrdinalIgnoreCase) ||
                id.Equals(DemoIds.MultiAuroraProfileId.ToString(), StringComparison.OrdinalIgnoreCase) ||
                id.Equals(DemoIds.MultiParqueProfileId.ToString(), StringComparison.OrdinalIgnoreCase);

            if (isAdminProfile)
            {
                foreach (var perm in adminCredentialPerms)
                {
                    if (!tokenSet.Contains(perm))
                    {
                        normalizedTokens.Add(perm);
                        tokenSet.Add(perm);
                        added.Add(perm);
                    }
                }
            }

            if (added.Count == 0)
                continue;

            var updated = await db.UpdateAsync(
                new[] { "Permissions" },
                "AttendantProfiles",
                new[] { string.Join(",", normalizedTokens) },
                "Id = @param0",
                new object[] { id },
                ct: ct);

            if (updated)
            {
                _logger.LogInformation(
                    "Backfilled attendant profile {ProfileId} permissions to grant {Grant}.",
                    id,
                    string.Join(",", added));
            }
            else
            {
                _logger.LogWarning(
                    "Backfill attempted but UpdateAsync reported no row matched for attendant profile {ProfileId}.",
                    id);
            }
        }
    }

    private static async Task InsertProfileAsync(
        IAsyncSqlClient db,
        Guid id,
        Guid tenantId,
        Guid userId,
        string displayName,
        Guid? shiftId,
        Guid? gatehouseId,
        string permissions,
        DateTime now,
        CancellationToken ct)
    {
        var existing = await db.SelectAsync("Id", "AttendantProfiles", "Id = @param0", new object[] { id }, ct);
        if (existing is not null && existing.Rows.Count > 0)
            return;

        await db.InsertAsync(
            new[] { "Id", "TenantId", "UserId", "DisplayName", "ShiftId", "GatehouseId", "Permissions", "Active", "CreatedAtUtc", "tenant_id" },
            "AttendantProfiles",
            new object?[]
            {
                id, tenantId, userId, displayName,
                shiftId.HasValue ? shiftId.Value : DBNull.Value,
                gatehouseId.HasValue ? gatehouseId.Value : DBNull.Value,
                permissions, true, now, tenantId
            },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    private static async Task SeedApartmentsAsync(
        IAsyncSqlClient db,
        Guid tenantId,
        DemoResidentFixture[] residents,
        DateTime now,
        CancellationToken ct)
    {
        var seen = new HashSet<(string Block, string Unit)>();
        foreach (var fixture in residents)
        {
            var key = (fixture.Block, fixture.Apt);
            if (!seen.Add(key))
                continue;

            var id = DemoIds.ApartmentId(tenantId, fixture.Block, fixture.Apt);
            var existing = await db.SelectAsync("Id", "Apartments", "Id = @param0", new object[] { id }, ct);
            if (existing is not null && existing.Rows.Count > 0)
                continue;

            await db.InsertAsync(
                new[] { "Id", "TenantId", "Block", "Unit", "Active", "CreatedAtUtc", "tenant_id" },
                "Apartments",
                new object[] { id, tenantId, fixture.Block, fixture.Apt, true, now, tenantId },
                primaryKeyName: "Id",
                autoIncrement: false,
                ct: ct);
        }
    }

    private static async Task SeedResidentsAsync(
        IAsyncSqlClient db,
        Guid tenantId,
        DemoResidentFixture[] residents,
        int cpfSeedOffset,
        DateTime now,
        CancellationToken ct)
    {
        for (var i = 0; i < residents.Length; i++)
        {
            var fixture = residents[i];
            var id = DemoIds.ResidentId(tenantId, i + 1);
            var apartmentId = DemoIds.ApartmentId(tenantId, fixture.Block, fixture.Apt);
            var cpf = DemoFixtures.GenerateValidCpf(cpfSeedOffset + i + 1);
            var email = $"{fixture.Name.Replace(" ", "").ToLowerInvariant()}@demo.local";

            var existing = await db.SelectAsync("Id", "Residents", "Id = @param0", new object[] { id }, ct);
            if (existing is not null && existing.Rows.Count > 0)
                continue;

            await db.InsertAsync(
                new[] { "Id", "TenantId", "Name", "Cpf", "Email", "Phone", "ApartmentId", "Active", "CreatedAtUtc", "tenant_id" },
                "Residents",
                new object?[]
                {
                    id, tenantId, fixture.Name, cpf, email, "+5511999990001",
                    apartmentId, fixture.Active, now, tenantId
                },
                primaryKeyName: "Id",
                autoIncrement: false,
                ct: ct);
        }
    }

    private static async Task SeedVisitsAsync(IAsyncSqlClient db, DateTime now, CancellationToken ct)
    {
        var madrugaApt = DemoIds.ApartmentId(DemoIds.AuroraTenantId, "A", "14");
        var michaelApt = DemoIds.ApartmentId(DemoIds.AuroraTenantId, "B", "101");
        var spartaApt = DemoIds.ApartmentId(DemoIds.AuroraTenantId, "C", "Sparta-1");

        var visits = new[]
        {
            (Id: DemoIds.StableGuid("visit:1"), Visitor: "Chaves", Doc: "11111111111", Apt: madrugaApt, Block: "A", Unit: "14", Purpose: "Pre-register visit for Seu Madruga", Status: 0, Created: now.AddHours(-2), CheckedIn: (DateTime?)null, CheckedOut: (DateTime?)null),
            (Id: DemoIds.StableGuid("visit:2"), Visitor: "Franklin Clinton", Doc: "22222222222", Apt: michaelApt, Block: "B", Unit: "101", Purpose: "Package delivery to Michael De Santa", Status: 2, Created: now.AddHours(-3), CheckedIn: now.AddHours(-2.5), CheckedOut: now.AddMinutes(-45)),
            (Id: DemoIds.StableGuid("visit:3"), Visitor: "Deimos", Doc: "33333333333", Apt: spartaApt, Block: "C", Unit: "Sparta-1", Purpose: "New resident registration", Status: 1, Created: now.AddHours(-5), CheckedIn: now.AddHours(-4), CheckedOut: (DateTime?)null),
        };

        foreach (var v in visits)
        {
            var existing = await db.SelectAsync("Id", "Visits", "Id = @param0", new object[] { v.Id }, ct);
            if (existing is not null && existing.Rows.Count > 0)
                continue;

            await db.InsertAsync(
                new[] { "Id", "TenantId", "VisitorName", "VisitorDocument", "VisitorPhone", "ApartmentId", "DestinationBlock", "DestinationUnit", "Purpose", "Status", "AttendantProfileId", "GatehouseId", "CheckedInAtUtc", "CheckedOutAtUtc", "CreatedAtUtc", "tenant_id" },
                "Visits",
                new object?[]
                {
                    v.Id, DemoIds.AuroraTenantId, v.Visitor, v.Doc, "+5511888880001", v.Apt, v.Block, v.Unit, v.Purpose, v.Status,
                    DemoIds.PorteiroProfileId, DemoIds.AuroraGatehouseId,
                    v.CheckedIn.HasValue ? v.CheckedIn.Value : DBNull.Value,
                    v.CheckedOut.HasValue ? v.CheckedOut.Value : DBNull.Value,
                    v.Created, DemoIds.AuroraTenantId
                },
                primaryKeyName: "Id",
                autoIncrement: false,
                ct: ct);
        }
    }

    private static async Task SeedVehiclesAsync(IAsyncSqlClient db, DateTime now, CancellationToken ct)
    {
        var vehicles = new[]
        {
            (DemoIds.StableGuid("vehicle:1"), "ABC1D23", "Obey", "9F", "Black", DemoIds.ApartmentId(DemoIds.AuroraTenantId, "B", "101"), "Michael De Santa", 0),
            (DemoIds.StableGuid("vehicle:2"), "DEF4G56", "Vapid", "Bullet", "Red", DemoIds.ApartmentId(DemoIds.AuroraTenantId, "B", "102"), "Franklin Clinton", 0),
            (DemoIds.StableGuid("vehicle:3"), "GHI7J89", "Pegassi", "Zentorno", "Orange", DemoIds.ApartmentId(DemoIds.AuroraTenantId, "B", "103"), "Trevor Philips", 0),
        };

        foreach (var (id, plate, brand, model, color, apt, owner, type) in vehicles)
        {
            var existing = await db.SelectAsync("Id", "Vehicles", "Id = @param0", new object[] { id }, ct);
            if (existing is not null && existing.Rows.Count > 0)
                continue;

            await db.InsertAsync(
                new[] { "Id", "TenantId", "Plate", "Brand", "Model", "Color", "ApartmentId", "OwnerName", "VehicleType", "Active", "CreatedAtUtc", "tenant_id" },
                "Vehicles",
                new object?[] { id, DemoIds.AuroraTenantId, plate, brand, model, color, apt, owner, type, true, now, DemoIds.AuroraTenantId },
                primaryKeyName: "Id",
                autoIncrement: false,
                ct: ct);
        }
    }

    private static async Task SeedServiceProvidersAsync(IAsyncSqlClient db, DateTime now, CancellationToken ct)
    {
        var providers = new[]
        {
            (DemoIds.StableGuid("sp:1"), "Jaiminho Entregas", "44444444444", "Courier", "Correios Vila"),
            (DemoIds.StableGuid("sp:2"), "Los Santos Plumbing", "55555555555", "Plumbing", "LS Services"),
        };

        foreach (var (id, name, doc, serviceType, company) in providers)
        {
            var existing = await db.SelectAsync("Id", "ServiceProviders", "Id = @param0", new object[] { id }, ct);
            if (existing is not null && existing.Rows.Count > 0)
                continue;

            await db.InsertAsync(
                new[] { "Id", "TenantId", "Name", "Document", "Phone", "Email", "ServiceType", "Company", "Active", "CreatedAtUtc", "tenant_id" },
                "ServiceProviders",
                new object?[] { id, DemoIds.AuroraTenantId, name, doc, "+5511777770001", "contact@demo.local", serviceType, company, true, now, DemoIds.AuroraTenantId },
                primaryKeyName: "Id",
                autoIncrement: false,
                ct: ct);
        }
    }
}
