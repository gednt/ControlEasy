using ControlEasyReborn.Modules.Photos.Application.Contracts;
using ControlEasyReborn.Modules.Photos.Application.Handlers;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.Photos.Api.Endpoints;

public static class PhotosEndpoints
{
    public const long MaxUploadSizeBytes = 8 * 1024 * 1024;
    public const long MaxRequestSizeBytes = MaxUploadSizeBytes + (64 * 1024);

    public static IEndpointRouteBuilder MapPhotosEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/photos")
            .RequireAuthorization()
            .WithTags("Photos");

        group.MapPost("/", async (
            HttpRequest request,
            ITenantContext tenantContext,
            UploadPhotoHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");

            string? rawContentType = request.ContentType?.Split(';')[0].Trim();
            if (string.IsNullOrWhiteSpace(rawContentType))
            {
                return Results.StatusCode(StatusCodes.Status415UnsupportedMediaType);
            }
            var maxRequestSize = request.HasFormContentType ? MaxRequestSizeBytes : MaxUploadSizeBytes;
            if (request.ContentLength is long contentLength && contentLength > maxRequestSize)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status413PayloadTooLarge,
                    title: "Photo exceeds the 8 MB upload limit.");
            }

            Stream contentStream;
            string mimeType;
            string? fileName = null;
            DateTime? capturedAt = null;

            if (request.HasFormContentType)
            {
                var form = await request.ReadFormAsync(ct);
                var file = form.Files.FirstOrDefault();
                if (file is null)
                {
                    throw new ControlEasyReborn.Modules.Photos.Application.Errors.ValidationException(
                        new Dictionary<string, string[]> { ["File"] = new[] { "No file was provided." } });
                }
                if (file.Length > MaxUploadSizeBytes)
                {
                    return Results.Problem(
                        statusCode: StatusCodes.Status413PayloadTooLarge,
                        title: "Photo exceeds the 8 MB upload limit.");
                }

                mimeType = file.ContentType;
                fileName = file.FileName;
                var entityType = form["entityType"].FirstOrDefault();
                var entityId = form["entityId"].FirstOrDefault();
                if (form.TryGetValue("capturedAtUtc", out var capVal) && DateTime.TryParse(capVal, out var parsedCap))
                {
                    capturedAt = parsedCap;
                }

                var formMetadata = new UploadPhotoMetadata(mimeType, capturedAt, fileName, entityType, entityId);
                var ms = await CopyToMemoryAsync(file.OpenReadStream(), ct);
                var formResponse = await handler.HandleAsync(ms, formMetadata, tenantId, ct);
                return Results.Created($"/api/v1/photos/{formResponse.Id}", formResponse);
            }
            else if (rawContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                mimeType = rawContentType;
                fileName = request.Headers["X-File-Name"].FirstOrDefault()
                    ?? request.Query["fileName"].FirstOrDefault();

                var capStr = request.Headers["X-Captured-At"].FirstOrDefault()
                    ?? request.Query["capturedAtUtc"].FirstOrDefault()
                    ?? request.Query["capturedAt"].FirstOrDefault();
                if (DateTime.TryParse(capStr, out var parsedCap))
                {
                    capturedAt = parsedCap;
                }

                contentStream = await CopyToMemoryAsync(request.Body, ct);
            }
            else
            {
                return Results.StatusCode(StatusCodes.Status415UnsupportedMediaType);
            }

            var metadata = new UploadPhotoMetadata(
                mimeType,
                capturedAt,
                fileName,
                request.Headers["X-Entity-Type"].FirstOrDefault(),
                request.Headers["X-Entity-Id"].FirstOrDefault());
            var response = await handler.HandleAsync(contentStream, metadata, tenantId, ct);
            return Results.Created($"/api/v1/photos/{response.Id}", response);
        })
        .RequireAuthorization("Permission_Photos.Write");

        group.MapGet("/", async (
            [FromQuery] string? entityType,
            [FromQuery] string? entityId,
            ListPhotosHandler handler,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(entityType) || string.IsNullOrWhiteSpace(entityId))
            {
                return Results.BadRequest(new ProblemDetails { Title = "Entity type and entity id are required." });
            }

            return Results.Ok(await handler.HandleAsync(entityType, entityId, ct));
        })
        .RequireAuthorization("Permission_Photos.Read");

        group.MapGet("/{id:guid}", async (
            Guid id,
            GetPhotoHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(id, ct);
            return Results.File(result.Content, result.MimeType);
        })
        .RequireAuthorization("Permission_Photos.Read");

        group.MapDelete("/{id:guid}", async (
            Guid id,
            SoftDeletePhotoHandler handler,
            CancellationToken ct) =>
        {
            await handler.HandleAsync(id, ct);
            return Results.NoContent();
        })
        .RequireAuthorization("Permission_Photos.Delete");

        return app;
    }

    private static async Task<MemoryStream> CopyToMemoryAsync(Stream source, CancellationToken ct)
    {
        var destination = new MemoryStream();
        var buffer = new byte[81920];
        int bytesRead;
        while ((bytesRead = await source.ReadAsync(buffer.AsMemory(), ct)) > 0)
        {
            if (destination.Length + bytesRead > MaxUploadSizeBytes)
            {
                destination.Dispose();
                throw new ControlEasyReborn.Modules.Photos.Application.Errors.ValidationException(
                    new Dictionary<string, string[]> { ["File"] = new[] { "Photo exceeds the 8 MB upload limit." } });
            }
            await destination.WriteAsync(buffer.AsMemory(0, bytesRead), ct);
        }
        destination.Position = 0;
        return destination;
    }
}
