using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using ControlEasyReborn.Modules.Security.Infrastructure.Persistence;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using ControlEasyReborn.UnitTests.TestDoubles;
using DBTools.Abstractions;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Security;

public sealed class GatehouseRepositoryTests
{
    private readonly Guid _tenantId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly FakeAsyncSqlClient _fakeClient = new();

    [Fact]
    public async Task AddAsync_writes_both_tenant_columns_from_authenticated_context()
    {
        var gatehouse = CreateGatehouse(_tenantId, location: null);
        var sut = CreateRepository(_tenantId);

        await sut.AddAsync(gatehouse, CancellationToken.None);

        var operation = _fakeClient.Operations.Should().ContainSingle().Subject;
        operation.Sql.Should().Contain("TenantId");
        operation.Sql.Should().Contain("tenant_id");
        operation.Parameters.Should().HaveCount(5);
        operation.Parameters[1].Should().Be(_tenantId);
        operation.Parameters[3].Should().Be(DBNull.Value);
        operation.Parameters[4].Should().Be(_tenantId);
    }

    [Fact]
    public async Task AddAsync_when_insert_fails_throws_with_database_error()
    {
        _fakeClient.InsertResultFactory = () => false;
        _fakeClient.Error = "synthetic insert failure";
        var sut = CreateRepository(_tenantId);

        var action = () => sut.AddAsync(CreateGatehouse(_tenantId), CancellationToken.None);

        await action.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*synthetic insert failure*");
    }

    [Fact]
    public async Task AddAsync_when_tenant_does_not_match_rejects_before_insert()
    {
        var sut = CreateRepository(_tenantId);

        var action = () => sut.AddAsync(CreateGatehouse(Guid.NewGuid()), CancellationToken.None);

        await action.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*does not match*");
        _fakeClient.Operations.Should().BeEmpty();
    }

    [Fact]
    public async Task AddAsync_when_failed_insert_was_cancelled_preserves_cancellation()
    {
        _fakeClient.InsertResultFactory = () => false;
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();
        var sut = CreateRepository(_tenantId);

        var action = () => sut.AddAsync(CreateGatehouse(_tenantId), cancellation.Token);

        await action.Should().ThrowAsync<OperationCanceledException>();
    }

    [Fact]
    public async Task SetActiveAsync_updates_only_lifecycle_state_by_id()
    {
        var gatehouse = CreateGatehouse(_tenantId);
        gatehouse.SetActive(false);
        var sut = CreateRepository(_tenantId);

        await sut.SetActiveAsync(gatehouse, CancellationToken.None);

        var operation = _fakeClient.Operations.Should().ContainSingle().Subject;
        operation.Sql.Should().Contain("Active");
        operation.Sql.Should().Contain("tenant_id = @param2");
        operation.Parameters.Should().Contain("0");
        operation.Parameters.Should().Contain(gatehouse.Id.ToString());
        operation.Parameters.Should().Contain(_tenantId.ToString());
    }

    [Fact]
    public async Task UpdateAsync_is_tenant_scoped_and_persists_null_location()
    {
        var gatehouse = CreateGatehouse(_tenantId, location: null);
        var sut = CreateRepository(_tenantId);

        await sut.UpdateAsync(gatehouse, CancellationToken.None);

        var operation = _fakeClient.Operations.Should().ContainSingle().Subject;
        operation.Sql.Should().Contain("tenant_id = @param3");
        operation.Parameters.Should().ContainInOrder(
            gatehouse.Name,
            DBNull.Value,
            gatehouse.Id.ToString(),
            _tenantId.ToString());
    }

    [Fact]
    public async Task UpdateAsync_when_tenant_does_not_match_rejects_before_update()
    {
        var sut = CreateRepository(_tenantId);

        var action = () => sut.UpdateAsync(CreateGatehouse(Guid.NewGuid()), CancellationToken.None);

        await action.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*does not match*");
        _fakeClient.Operations.Should().BeEmpty();
    }

    [Fact]
    public async Task UpdateAsync_when_write_fails_throws_with_database_error()
    {
        _fakeClient.UpdateResultFactory = () => false;
        _fakeClient.Error = "synthetic update failure";
        var sut = CreateRepository(_tenantId);

        var action = () => sut.UpdateAsync(CreateGatehouse(_tenantId), CancellationToken.None);

        await action.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*synthetic update failure*");
    }

    private GatehouseRepository CreateRepository(Guid? contextTenantId)
    {
        var context = new FakeTenantContext(contextTenantId);
        return new GatehouseRepository(context, new FakeTenantAwareLinqFactory(_fakeClient));
    }

    private static Gatehouse CreateGatehouse(Guid tenantId, string? location = "Main entrance") =>
        new(Guid.NewGuid(), tenantId, "Synthetic gatehouse", location);

    private sealed class FakeTenantAwareLinqFactory(FakeAsyncSqlClient client) : ITenantAwareLinqFactory
    {
        public IAsyncSqlClient Create(ITenantContext ctx, bool bypassTenantFilter = false) => client;
    }

    private sealed class FakeTenantContext(Guid? tenantId) : ITenantContext
    {
        public Guid? TenantId { get; } = tenantId;
        public Guid? ProfileId => null;
        public IReadOnlyCollection<string> Roles => Array.Empty<string>();
        public IReadOnlyCollection<string> Permissions => Array.Empty<string>();
        public bool IsPlatformAdmin => false;
        public bool IsResolved => TenantId.HasValue;

        public void Set(
            Guid? tenantId,
            Guid? profileId,
            IReadOnlyCollection<string> roles,
            IReadOnlyCollection<string> permissions)
        {
        }
    }
}
