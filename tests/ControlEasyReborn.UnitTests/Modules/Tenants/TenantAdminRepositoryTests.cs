using ControlEasyReborn.Modules.Tenants.Application;
using ControlEasyReborn.Modules.Tenants.Infrastructure.Persistence;
using ControlEasyReborn.UnitTests.TestDoubles;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Tenants;

public sealed class TenantAdminRepositoryTests
{
    [Fact]
    public async Task CreateAdminAsync_inserts_user_and_attendant_profile()
    {
        var client = new FakeAsyncSqlClient();
        var sut = new TenantAdminRepository(client);
        var tenantId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

        await sut.CreateAdminAsync(
            tenantId,
            "admin@condo.test",
            "Condo Admin",
            "hashed-password",
            CancellationToken.None);

        var inserts = client.Operations.Where(o => o.OperationType == "Insert").ToList();
        inserts.Should().HaveCount(2);

        var userInsert = inserts[0];
        userInsert.Sql.Should().Contain("Users");
        userInsert.Parameters.Should().Contain(tenantId);
        userInsert.Parameters.Should().Contain("TenantAdmin");
        userInsert.Parameters.Should().Contain(true);

        var profileInsert = inserts[1];
        profileInsert.Sql.Should().Contain("AttendantProfiles");
        profileInsert.Parameters.Should().Contain(tenantId);
        profileInsert.Parameters.Should().Contain("Condo Admin");
        profileInsert.Parameters.Should().Contain(TenantAdminDefaults.Permissions);
        profileInsert.Parameters.Should().Contain(userInsert.Parameters[0]);
    }

    [Fact]
    public async Task EnsureAttendantProfileAsync_inserts_profile_when_missing_for_tenant_admin()
    {
        var client = new FakeAsyncSqlClient();
        var sut = new TenantAdminRepository(client);
        var tenantId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var userId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");

        await sut.EnsureAttendantProfileAsync(
            userId,
            tenantId,
            "Recovered Admin",
            "TenantAdmin",
            CancellationToken.None);

        var insert = client.Operations.Single(o => o.OperationType == "Insert");
        insert.Sql.Should().Contain("AttendantProfiles");
        insert.Parameters.Should().Contain(tenantId);
        insert.Parameters.Should().Contain(userId);
        insert.Parameters.Should().Contain(TenantAdminDefaults.Permissions);
    }

    [Fact]
    public async Task EnsureAttendantProfileAsync_updates_profile_when_missing_permissions_for_tenant_admin()
    {
        var client = new FakeAsyncSqlClient();
        var sut = new TenantAdminRepository(client);
        var tenantId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var userId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var profileId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

        var table = new System.Data.DataTable();
        table.Columns.Add("Id", typeof(string));
        table.Columns.Add("Permissions", typeof(string));
        table.Rows.Add(profileId.ToString(), "Visits.Read");
        client.SelectResultFactory = () => table;

        await sut.EnsureAttendantProfileAsync(
            userId,
            tenantId,
            "Existing Admin",
            "TenantAdmin",
            CancellationToken.None);

        var update = client.Operations.Single(o => o.OperationType == "Update");
        update.Sql.Should().Contain("AttendantProfiles");
        update.Parameters.Should().Contain(profileId.ToString());
        var newPerms = update.Parameters.OfType<string>().First(p => p.Contains("Access.Control.Issue"));
        newPerms.Should().Contain("Visits.Read");
        newPerms.Should().Contain("Access.Control.Issue");
        newPerms.Should().Contain("Access.Control.Replace");
        newPerms.Should().Contain("Access.Control.Revoke");
        newPerms.Should().Contain("Access.Read");
        newPerms.Should().Contain("Access.Access.Operate");
    }

    [Fact]
    public async Task CreatePorteiroAsync_inserts_user_and_attendant_profile()
    {
        var client = new FakeAsyncSqlClient();
        var sut = new TenantAdminRepository(client);
        var tenantId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

        await sut.CreatePorteiroAsync(
            tenantId,
            "porteiro@condo.test",
            "Gate Keeper",
            "hashed-password",
            CancellationToken.None);

        var inserts = client.Operations.Where(o => o.OperationType == "Insert").ToList();
        inserts.Should().HaveCount(2);

        var userInsert = inserts[0];
        userInsert.Sql.Should().Contain("Users");
        userInsert.Parameters.Should().Contain(PorteiroDefaults.Role);

        var profileInsert = inserts[1];
        profileInsert.Sql.Should().Contain("AttendantProfiles");
        profileInsert.Parameters.Should().Contain(PorteiroDefaults.Permissions);
    }
}
