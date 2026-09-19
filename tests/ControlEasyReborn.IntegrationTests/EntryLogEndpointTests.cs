using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using ControlEasyReborn.Modules.Photos.Application.Contracts;
using FluentAssertions;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

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

    private async Task<Guid> UploadTestPhotoAsync(HttpClient client)
    {
        var content = new ByteArrayContent(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x01, 0x02 });
        content.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        var response = await client.PostAsync("/api/v1/photos?fileName=entry-test.jpg", content);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var photo = await response.Content.ReadFromJsonAsync<PhotoResponse>();
        return photo!.Id;
    }

    [Fact]
    public async Task Create_WhenEnteredWithConsentAndValidPhoto_ReturnsCreated()
    {
        var client = _factory.AsTenantA();
        var photoId = await UploadTestPhotoAsync(client);

        var request = new CreateEntryLogRequest(
            EntryState: "entered_with_consent",
            SubjectType: "visitor",
            SubjectName: "Alice Walker",
            SubjectDocument: "12345678901",
            PhotoId: photoId,
            OverrideReason: null);

        var response = await client.PostAsJsonAsync("/api/v1/entry-log", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<EntryLogResponse>();
        body.Should().NotBeNull();
        body!.Id.Should().NotBeEmpty();
        body.PhotoId.Should().Be(photoId);
        body.EntryState.Should().Be("entered_with_consent");
        body.SubjectName.Should().Be("Alice Walker");
    }

    [Fact]
    public async Task Create_WhenEnteredWithConsentAndNullPhoto_ReturnsBadRequest()
    {
        var client = _factory.AsTenantA();
        var request = new CreateEntryLogRequest(
            EntryState: "entered_with_consent",
            SubjectType: "visitor",
            SubjectName: "Bob NoPhoto",
            SubjectDocument: "98765432100",
            PhotoId: null,
            OverrideReason: null);

        var response = await client.PostAsJsonAsync("/api/v1/entry-log", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_WhenGatehouseOnly_ReturnsBadRequest()
    {
        var client = _factory.AsTenantA();

        var request = new CreateEntryLogRequest(
            EntryState: "gatehouse_only",
            SubjectType: "service_provider",
            SubjectName: "Legacy Walk-in Probe",
            SubjectDocument: "12345678901",
            PhotoId: null,
            OverrideReason: null);

        var response = await client.PostAsJsonAsync("/api/v1/entry-log", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_WhenEnteredOverride_RequiresValidReason()
    {
        var client = _factory.AsTenantA();

        // Missing override reason -> 400
        var missingOverrideReq = new CreateEntryLogRequest(
            EntryState: "entered_override",
            SubjectType: "visitor",
            SubjectName: "Charlie Refused",
            SubjectDocument: "11122233344",
            PhotoId: null,
            OverrideReason: null);

        var badResponse = await client.PostAsJsonAsync("/api/v1/entry-log", missingOverrideReq);
        badResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // With valid override reason -> 201
        var validOverrideReq = new CreateEntryLogRequest(
            EntryState: "entered_override",
            SubjectType: "visitor",
            SubjectName: "Charlie Refused",
            SubjectDocument: "11122233344",
            PhotoId: null,
            OverrideReason: "emergency");

        var goodResponse = await client.PostAsJsonAsync("/api/v1/entry-log", validOverrideReq);
        goodResponse.StatusCode.Should().Be(HttpStatusCode.Created);
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
    public async Task Policy_WhenPhotoRequired_RejectsEntryWithoutPhoto_AndAcceptsEntryWithPhoto()
    {
        var client = _factory.AsTenantA();

        // 1. Configure policy for category "visitor" to require photo
        var updatePolicyReq = new UpdateConsentPolicyRequest("visitor", PhotoRequired: true, DwellTimeLimitMinutes: 480);
        var policyResp = await client.PutAsJsonAsync("/api/v1/consent-policy", updatePolicyReq);
        policyResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify policy GET
        var getPolicyResp = await client.GetAsync("/api/v1/consent-policy/visitor");
        getPolicyResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var policy = await getPolicyResp.Content.ReadFromJsonAsync<ConsentPolicyResponse>();
        policy!.PhotoRequired.Should().BeTrue();

        // 2. Entry attempt without photo should fail validation (400)
        // Per .specs/consent-gatehouse: the PhotoRequired policy gate only applies
        // to entries with consent (entered_with_consent). entered_without_consent
        // (refusal) is recorded without a photo regardless of policy.
        var entryWithoutPhoto = new CreateEntryLogRequest(
            EntryState: "entered_with_consent",
            SubjectType: "visitor",
            SubjectName: "Policy Test Visitor",
            SubjectDocument: "99988877766",
            PhotoId: null,
            OverrideReason: null);

        var badResp = await client.PostAsJsonAsync("/api/v1/entry-log", entryWithoutPhoto);
        badResp.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // 2b. Sanity: refused-consent entry is recorded even when policy requires photo
        // (a refusal means no photo is taken by design).
        var refusedEntry = new CreateEntryLogRequest(
            EntryState: "entered_without_consent",
            SubjectType: "visitor",
            SubjectName: "Policy Test Visitor Refused",
            SubjectDocument: "99988877767",
            PhotoId: null,
            OverrideReason: null);

        var refusedResp = await client.PostAsJsonAsync("/api/v1/entry-log", refusedEntry);
        refusedResp.StatusCode.Should().Be(HttpStatusCode.Created);

        // 3. Entry attempt with photo succeeds (201)
        var photoId = await UploadTestPhotoAsync(client);
        var entryWithPhoto = new CreateEntryLogRequest(
            EntryState: "entered_with_consent",
            SubjectType: "visitor",
            SubjectName: "Policy Test Visitor",
            SubjectDocument: "99988877766",
            PhotoId: photoId,
            OverrideReason: null);

        var goodResp = await client.PostAsJsonAsync("/api/v1/entry-log", entryWithPhoto);
        goodResp.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task ExportCsv_ReturnsCsvWithMillisecondPrecision()
    {
        var client = _factory.AsTenantA();
        var photoId = await UploadTestPhotoAsync(client);

        var createReq = new CreateEntryLogRequest(
            EntryState: "entered_with_consent",
            SubjectType: "visitor",
            SubjectName: "Csv Test Person",
            SubjectDocument: "12345678901",
            PhotoId: photoId,
            OverrideReason: null);

        var createResp = await client.PostAsJsonAsync("/api/v1/entry-log", createReq);
        createResp.StatusCode.Should().Be(HttpStatusCode.Created);

        var csvResp = await client.GetAsync("/api/v1/entry-log/export");
        csvResp.StatusCode.Should().Be(HttpStatusCode.OK);
        csvResp.Content.Headers.ContentType?.MediaType.Should().Be("text/csv");

        var csvText = await csvResp.Content.ReadAsStringAsync();
        csvText.Should().Contain("id,entry_state,override_reason,photo_id,subject_type,subject_name,subject_document,performed_by_profile_id,recorded_at");
        csvText.Should().Contain("Csv Test Person");

        // Verify millisecond precision format in the exported text (e.g., 2026-09-12 19:04:24.123)
        Regex.IsMatch(csvText, @"\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}").Should().BeTrue();
    }

    [Fact]
    public async Task CrossTenant_EntryLog_TenantCannotSeeOtherTenantEntries()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();

        var photoId = await UploadTestPhotoAsync(clientA);
        var uniqueName = $"TenantA Exclusive {Guid.NewGuid()}";

        var createReq = new CreateEntryLogRequest(
            EntryState: "entered_with_consent",
            SubjectType: "visitor",
            SubjectName: uniqueName,
            SubjectDocument: "12345678901",
            PhotoId: photoId,
            OverrideReason: null);

        var createResp = await clientA.PostAsJsonAsync("/api/v1/entry-log", createReq);
        createResp.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResp.Content.ReadFromJsonAsync<EntryLogResponse>();

        // Tenant B lists entry logs
        var listRespB = await clientB.GetAsync("/api/v1/entry-log");
        listRespB.StatusCode.Should().Be(HttpStatusCode.OK);
        var listB = await listRespB.Content.ReadFromJsonAsync<List<EntryLogResponse>>();
        listB.Should().NotContain(x => x.Id == created!.Id || x.SubjectName == uniqueName);

        // Tenant B exports CSV
        var csvRespB = await clientB.GetAsync("/api/v1/entry-log/export");
        csvRespB.StatusCode.Should().Be(HttpStatusCode.OK);
        var csvTextB = await csvRespB.Content.ReadAsStringAsync();
        csvTextB.Should().NotContain(created!.Id.ToString());
        csvTextB.Should().NotContain(uniqueName);
    }
}
