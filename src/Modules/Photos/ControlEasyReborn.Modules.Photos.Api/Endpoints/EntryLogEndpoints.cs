using ControlEasyReborn.Modules.Photos.Application.Handlers;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.Photos.Api.Endpoints;

/// <summary>
/// Read-only consent-audit endpoints. The legacy entry-log write path was
/// retired: walk-in registration lives in POST /api/v1/visits (checkInNow),
/// package drops in POST /api/v1/access-events/manual, and QR/manual entry
/// events in POST /api/v1/access-events/*. ConsentAuditLog remains a
/// privacy-consent audit trail (append-only), not an operational record.
/// </summary>
public static class EntryLogEndpoints
{
    public static IEndpointRouteBuilder MapEntryLogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/entry-log")
            .RequireAuthorization()
            .WithTags("Entry Log");

        group.MapGet("/", async (
            string? entryState,
            string? subjectType,
            DateTime? fromUtc,
            DateTime? toUtc,
            int? skip,
            int? take,
            ListEntryLogsHandler handler,
            CancellationToken ct) =>
        {
            var entries = await handler.HandleAsync(entryState, subjectType, fromUtc, toUtc, skip ?? 0, take ?? 50, ct);
            return Results.Ok(entries);
        })
        .RequireAuthorization("Permission_Photos.Read");

        group.MapGet("/export", async (
            string? entryState,
            string? subjectType,
            DateTime? fromUtc,
            DateTime? toUtc,
            ExportEntryLogCsvHandler handler,
            CancellationToken ct) =>
        {
            var csv = await handler.HandleAsync(entryState, subjectType, fromUtc, toUtc, ct);
            return Results.Text(csv, "text/csv", System.Text.Encoding.UTF8);
        })
        .RequireAuthorization("Permission_Photos.Read");

        return app;
    }
}