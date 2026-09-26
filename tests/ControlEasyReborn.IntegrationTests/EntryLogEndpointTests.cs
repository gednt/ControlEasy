using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using ControlEasyReborn.Modules.Photos.Application.Contracts;
using FluentAssertions;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

/// <summary>
/// The /api/v1/entry-log read path (list + CSV export) over the append-only
/// ConsentAuditLog. The legacy POST write path was retired: operational
/// entries are Visits (POST /api/v1/visits) and AccessEvents
/// (POST /api/v1/access-events/*). Rows here are seeded via direct SQL.
/// </summary>
[Collection("MySql Collection")]
public sealed class EntryLogEndpointTests
{
    private readonly TestcontainersWebApplicationFactory _factory;
    private readonly MySqlContainerFixture _mySql;

    public EntryLogEndpointTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
        _factory = new TestcontainersWebApplicationFactory(mySql);
    }

    private async Task SeedEntryAsync(Guid tenantId, string entryState, string subjectName, string subjectDocument, string? overrideReason = null, Guid? performedByProfileId = null)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();

        var sql = @"
            INSERT INTO ConsentAuditLog (Id, TenantId, EntryState, OverrideReason, PhotoId, SubjectType, SubjectName, SubjectDocument, PerformedByProfileId, RecordedAt, tenant_id)
            VALUES (@Id, @TenantId, @EntryState, @OverrideReason, NULL, 'visitor', @SubjectName, @SubjectDocument, @PerformedByProfileId, UTC_TIMESTAMP(3), @TenantId);";

        await using var cmd = new MySqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Id", Guid.NewGuid().ToString());
        cmd.Parameters.AddWithValue("@TenantId", tenantId.ToString());
        cmd.Parameters.AddWithValue("@EntryState", entryState);
        cmd.Parameters.AddWithValue("@OverrideReason", (object?)overrideReason ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@SubjectName", subjectName);
        cmd.Parameters.AddWithValue("@SubjectDocument", subjectDocument);
        cmd.Parameters.AddWithValue("@PerformedByProfileId", (object?)performedByProfileId ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task DirectSql_WhenEnteredWithConsentAndNullPhoto_FailsCheckConstraint()
    {
        var id = Guid.NewGuid();
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;

        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();

        var sql = @"
            INSERT INTO ConsentAuditLog (Id, TenantId, EntryState, OverrideReason, PhotoId, SubjectType, SubjectName, SubjectDocument, PerformedByProfileId, RecordedAt, tenant_id)
            VALUES (@Id, @TenantId, 'entered_with_consent', NULL, NULL, 'visitor', 'Violator', '00000000000', NULL, UTC_TIMESTAMP(3), @TenantId);";

        await using var cmd = new MySqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Id", id.ToString());
        cmd.Parameters.AddWithValue("@TenantId", tenantId.ToString());

        Func<Task> act = async () => await cmd.ExecuteNonQueryAsync();
        await act.Should().ThrowAsync<MySqlException>();
    }

    [Fact]
    public async Task DirectSql_WhenUpdateOnConsentAuditLog_FailsAppendOnlyTrigger()
    {
        var id = Guid.NewGuid();
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;

        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();

        var insertSql = @"
            INSERT INTO ConsentAuditLog (Id, TenantId, EntryState, OverrideReason, PhotoId, SubjectType, SubjectName, SubjectDocument, PerformedByProfileId, RecordedAt, tenant_id)
            VALUES (@Id, @TenantId, 'entered_without_consent', NULL, NULL, 'visitor', 'Original Name', '12345678901', NULL, UTC_TIMESTAMP(3), @TenantId);";

        await using (var insertCmd = new MySqlCommand(insertSql, conn))
        {
            insertCmd.Parameters.AddWithValue("@Id", id.ToString());
            insertCmd.Parameters.AddWithValue("@TenantId", tenantId.ToString());
            await insertCmd.ExecuteNonQueryAsync();
        }

        var updateSql = "UPDATE ConsentAuditLog SET SubjectName = 'Tampered' WHERE Id = @Id;";
        await using var updateCmd = new MySqlCommand(updateSql, conn);
        updateCmd.Parameters.AddWithValue("@Id", id.ToString());

        Func<Task> act = async () => await updateCmd.ExecuteNonQueryAsync();
        var exception = await act.Should().ThrowAsync<MySqlException>();
        exception.Which.Message.Should().Contain("ConsentAuditLog is append-only: UPDATE is not permitted");
    }

    [Fact]
    public async Task DirectSql_WhenDeleteOnConsentAuditLog_FailsAppendOnlyTrigger()
    {
        var id = Guid.NewGuid();
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;

        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();

        var insertSql = @"
            INSERT INTO ConsentAuditLog (Id, TenantId, EntryState, OverrideReason, PhotoId, SubjectType, SubjectName, SubjectDocument, PerformedByProfileId, RecordedAt, tenant_id)
            VALUES (@Id, @TenantId, 'entered_without_consent', NULL, NULL, 'visitor', 'To Be Deleted', '12345678901', NULL, UTC_TIMESTAMP(3), @TenantId);";

        await using (var insertCmd = new MySqlCommand(insertSql, conn))
        {
            insertCmd.Parameters.AddWithValue("@Id", id.ToString());
            insertCmd.Parameters.AddWithValue("@TenantId", tenantId.ToString());
            await insertCmd.ExecuteNonQueryAsync();
        }

        var deleteSql = "DELETE FROM ConsentAuditLog WHERE Id = @Id;";
        await using var deleteCmd = new MySqlCommand(deleteSql, conn);
        deleteCmd.Parameters.AddWithValue("@Id", id.ToString());

        Func<Task> act = async () => await deleteCmd.ExecuteNonQueryAsync();
        var exception = await act.Should().ThrowAsync<MySqlException>();
        exception.Which.Message.Should().Contain("ConsentAuditLog is append-only: DELETE is not permitted");
    }

    [Fact]
    public async Task List_ReturnsSeededEntries()
    {
        var client = _factory.AsTenantA();
        var uniqueName = $"Seeded List {Guid.NewGuid()}";

        await SeedEntryAsync(TenantAwareWebApplicationFactory.TenantAId, "entered_without_consent", uniqueName, "12345678901");

        var listResp = await client.GetAsync("/api/v1/entry-log");
        listResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var list = await listResp.Content.ReadFromJsonAsync<List<EntryLogResponse>>();
        list.Should().NotBeNull();
        list.Should().Contain(x => x.SubjectName == uniqueName);
    }

    [Fact]
    public async Task ExportCsv_ReturnsCsvWithMillisecondPrecision()
    {
        var client = _factory.AsTenantA();
        var uniqueName = $"Csv Test Person {Guid.NewGuid()}";

        await SeedEntryAsync(TenantAwareWebApplicationFactory.TenantAId, "entered_without_consent", uniqueName, "12345678901");

        var csvResp = await client.GetAsync("/api/v1/entry-log/export");
        csvResp.StatusCode.Should().Be(HttpStatusCode.OK);
        csvResp.Content.Headers.ContentType?.MediaType.Should().Be("text/csv");

        var csvText = await csvResp.Content.ReadAsStringAsync();
        csvText.Should().Contain("id,entry_state,override_reason,photo_id,subject_type,subject_name,subject_document,performed_by_profile_id,recorded_at");
        csvText.Should().Contain(uniqueName);

        // Verify millisecond precision format in the exported text (e.g., 2026-09-12 19:04:24.123)
        Regex.IsMatch(csvText, @"\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}").Should().BeTrue();
    }

    [Fact]
    public async Task CrossTenant_EntryLog_TenantCannotSeeOtherTenantEntries()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();

        var uniqueName = $"TenantA Exclusive {Guid.NewGuid()}";

        await SeedEntryAsync(TenantAwareWebApplicationFactory.TenantAId, "entered_without_consent", uniqueName, "12345678901");

        // Tenant B lists entry logs
        var listRespB = await clientB.GetAsync("/api/v1/entry-log");
        listRespB.StatusCode.Should().Be(HttpStatusCode.OK);
        var listB = await listRespB.Content.ReadFromJsonAsync<List<EntryLogResponse>>();
        listB.Should().NotBeNull();
        listB.Should().NotContain(x => x.SubjectName == uniqueName);

        // Tenant B exports CSV
        var csvRespB = await clientB.GetAsync("/api/v1/entry-log/export");
        csvRespB.StatusCode.Should().Be(HttpStatusCode.OK);
        var csvTextB = await csvRespB.Content.ReadAsStringAsync();
        csvTextB.Should().NotContain(uniqueName);
    }

    [Fact]
    public async Task Post_IsRetired_ReturnsNotFoundOrMethodNotAllowed()
    {
        var client = _factory.AsTenantA();

        var response = await client.PostAsJsonAsync("/api/v1/entry-log", new { entryState = "entered_without_consent", subjectType = "visitor" });
        response.StatusCode.Should().BeOneOf(HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed);
    }

    [Fact]
    public async Task List_WithPorteiroFilter_ReturnsOnlyMatchingProfileRows()
    {
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;
        var porteiroA = Guid.NewGuid();
        var porteiroB = Guid.NewGuid();

        await SeedEntryAsync(tenantId, "entered_override", $"A-{Guid.NewGuid()}", "11111111111", "emergency", porteiroA);
        await SeedEntryAsync(tenantId, "entered_override", $"B-{Guid.NewGuid()}", "22222222222", "emergency", porteiroB);

        var client = _factory.AsTenantA();

        var porteiroAFilterResp = await client.GetAsync($"/api/v1/entry-log?porteiro={porteiroA}");
        porteiroAFilterResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var porteiroAList = await porteiroAFilterResp.Content.ReadFromJsonAsync<List<EntryLogResponse>>();
        porteiroAList.Should().NotBeNull();
        porteiroAList!.Should().OnlyContain(r => r.PerformedByProfileId == porteiroA);
        porteiroAList.Should().NotBeEmpty();

        var porteiroBFilterResp = await client.GetAsync($"/api/v1/entry-log?porteiro={porteiroB}");
        porteiroBFilterResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var porteiroBList = await porteiroBFilterResp.Content.ReadFromJsonAsync<List<EntryLogResponse>>();
        porteiroBList.Should().NotBeNull();
        porteiroBList!.Should().OnlyContain(r => r.PerformedByProfileId == porteiroB);
        porteiroBList.Should().NotBeEmpty();
    }

    [Fact]
    public async Task List_WithPorteiroFilterMatchingNothing_ReturnsEmpty()
    {
        var client = _factory.AsTenantA();
        var orphan = Guid.NewGuid();

        var response = await client.GetAsync($"/api/v1/entry-log?porteiro={orphan}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var list = await response.Content.ReadFromJsonAsync<List<EntryLogResponse>>();
        list.Should().NotBeNull();
        list!.Should().BeEmpty();
    }

    [Fact]
    public async Task ExportCsv_WithPorteiroFilter_ReturnsOnlyMatchingProfileRows()
    {
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;
        var porteiroA = Guid.NewGuid();
        var porteiroAUniqueName = $"Csv Port A {Guid.NewGuid()}";

        await SeedEntryAsync(tenantId, "entered_override", porteiroAUniqueName, "77777777777", "emergency", porteiroA);
        await SeedEntryAsync(tenantId, "entered_override", $"Csv Other {Guid.NewGuid()}", "88888888888", "vouched", Guid.NewGuid());

        var client = _factory.AsTenantA();

        var filteredResp = await client.GetAsync($"/api/v1/entry-log/export?porteiro={porteiroA}");
        filteredResp.StatusCode.Should().Be(HttpStatusCode.OK);
        filteredResp.Content.Headers.ContentType?.MediaType.Should().Be("text/csv");

        var filteredCsv = await filteredResp.Content.ReadAsStringAsync();
        filteredCsv.Should().Contain(porteiroAUniqueName);
        Regex.IsMatch(filteredCsv, @"\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}").Should().BeTrue();
    }
}