using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Visits.Application.Abstractions;
using ControlEasyReborn.Modules.Visits.Domain.Entities;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.Visits.Infrastructure.Persistence;

public sealed class VisitDirectoryRepository : IVisitDirectory
{
    private const string TableName = "Visits";
    private const string Fields = "Id, TenantId, VisitorName, VisitorDocument, VisitorPhone, ApartmentId, DestinationBlock, DestinationUnit, Purpose, Status, AttendantProfileId, GatehouseId, CheckedInAtUtc, CheckedOutAtUtc, CreatedAtUtc, UpdatedAtUtc";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;
    private readonly IVisitRepository _visits;

    public VisitDirectoryRepository(ITenantContext ctx, ITenantAwareLinqFactory factory, IVisitRepository visits)
    {
        _ctx = ctx;
        _factory = factory;
        _visits = visits;
    }

    public async Task<Visit?> FindByIdAsync(Guid tenantId, Guid visitId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "Id = @param0",
            parameters: new object[] { visitId },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<Visit?> FindLatestByDocumentAsync(Guid tenantId, string document, CancellationToken ct)
    {
        var raw = (document ?? string.Empty).Trim();
        var normalized = raw.Replace(".", "").Replace("-", "");
        if (normalized.Length == 0)
        {
            return null;
        }

        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "(VisitorDocument = @param0 OR REPLACE(REPLACE(VisitorDocument, '.', ''), '-', '') = @param1)",
            parameters: new object[] { raw, normalized },
            ct: ct);
        return MapList(rows).OrderByDescending(v => v.CreatedAtUtc).FirstOrDefault();
    }

    public async Task<IReadOnlyList<Visit>> SearchPendingByDocumentAsync(Guid tenantId, string document, CancellationToken ct)
    {
        var raw = (document ?? string.Empty).Trim();
        var normalized = raw.Replace(".", "").Replace("-", "");
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "Status = 0 AND (VisitorDocument = @param0 OR REPLACE(REPLACE(VisitorDocument, '.', ''), '-', '') = @param1)",
            parameters: new object[] { raw, normalized },
            ct: ct);
        return MapList(rows);
    }

    public async Task<IReadOnlyList<Visit>> SearchPendingByNameAsync(Guid tenantId, string nameTerm, int skip, int take, CancellationToken ct)
    {
        var term = (nameTerm ?? string.Empty).Trim();
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "Status = 0 AND VisitorName LIKE @param0",
            parameters: new object[] { term + "%" },
            ct: ct);
        return MapList(rows).Skip(skip).Take(take).ToList();
    }

    public async Task<bool> CheckInAsync(Guid tenantId, Guid visitId, Guid attendantProfileId, Guid? gatehouseId, CancellationToken ct)
    {
        var visit = await FindByIdAsync(tenantId, visitId, ct);
        if (visit is null || visit.Status != VisitStatus.Pending)
        {
            return false;
        }

        visit.CheckIn(attendantProfileId, gatehouseId);
        await _visits.UpdateAsync(visit, ct);
        return true;
    }

    public async Task<Visit> RegisterArrivalAsync(Application.Handlers.VisitorArrivalCommand command, CancellationToken ct)
    {
        var handler = new Application.Handlers.VisitorArrivalHandler(this, _visits);
        return await handler.HandleAsync(command, ct);
    }

    private static Visit? MapFirstOrDefault(DataTable table)
    {
        if (table.Rows.Count == 0) return null;
        return MapRow(table.Rows[0]);
    }

    private static IReadOnlyList<Visit> MapList(DataTable table)
    {
        var list = new List<Visit>(table.Rows.Count);
        foreach (DataRow row in table.Rows)
        {
            list.Add(MapRow(row));
        }
        return list;
    }

    private static Visit MapRow(DataRow r)
    {
        var id = Guid.Parse(r["Id"].ToString()!);
        var tenantId = Guid.Parse(r["TenantId"].ToString()!);
        var visitorName = r["VisitorName"].ToString()!;
        var visitorDocument = r["VisitorDocument"].ToString()!;
        var visitorPhone = r["VisitorPhone"] == DBNull.Value ? null : r["VisitorPhone"].ToString();
        var apartmentId = Guid.Parse(r["ApartmentId"].ToString()!);
        var destinationBlock = r["DestinationBlock"].ToString()!;
        var destinationUnit = r["DestinationUnit"].ToString()!;
        var purpose = r["Purpose"] == DBNull.Value ? null : r["Purpose"].ToString();
        var status = (VisitStatus)Convert.ToInt32(r["Status"]);
        var attendantProfileId = r["AttendantProfileId"] == DBNull.Value ? (Guid?)null : Guid.Parse(r["AttendantProfileId"].ToString()!);
        var gatehouseId = r["GatehouseId"] == DBNull.Value ? (Guid?)null : Guid.Parse(r["GatehouseId"].ToString()!);
        var checkedInAtUtc = r["CheckedInAtUtc"] == DBNull.Value ? (DateTime?)null : Convert.ToDateTime(r["CheckedInAtUtc"]);
        var checkedOutAtUtc = r["CheckedOutAtUtc"] == DBNull.Value ? (DateTime?)null : Convert.ToDateTime(r["CheckedOutAtUtc"]);
        var createdAtUtc = Convert.ToDateTime(r["CreatedAtUtc"]);
        var updatedAtUtc = r["UpdatedAtUtc"] == DBNull.Value ? (DateTime?)null : Convert.ToDateTime(r["UpdatedAtUtc"]);

        return new Visit(id, tenantId, visitorName, visitorDocument, visitorPhone, apartmentId, destinationBlock, destinationUnit, purpose, status, attendantProfileId, gatehouseId, checkedInAtUtc, checkedOutAtUtc, createdAtUtc, updatedAtUtc);
    }
}
