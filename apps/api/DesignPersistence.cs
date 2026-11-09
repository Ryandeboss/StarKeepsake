using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Data.SqlClient;

namespace StarKeepsake.Api;

// Design IDs are public order references. The separate random access key is private:
// knowing an Etsy personalization ID alone must never expose a customer's photo.
public sealed class DesignPersistenceOptions
{
    public string SqlConnectionString { get; set; } = "";
    public string StorageConnectionString { get; set; } = "";
    public string StorageContainerName { get; set; } = "starkeepsake-artwork";
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(SqlConnectionString) &&
        !string.IsNullOrWhiteSpace(StorageConnectionString) &&
        Regex.IsMatch(StorageContainerName, "^[a-z0-9](?:[a-z0-9-]{1,61})[a-z0-9]$");
}

public static class DesignSecurity
{
    public const int MaxImageBytes = 10 * 1024 * 1024;
    public const int MaxJsonBytes = 1024 * 1024;
    public const long MaxRequestBytes = 23L * 1024 * 1024;

    public static string NewId() => "SK-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(8));
    public static string NewAccessKey() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    public static byte[] HashKey(string key) => SHA256.HashData(Encoding.UTF8.GetBytes(key));
    public static bool ValidId(string? id) =>
        id is not null && Regex.IsMatch(id, "^SK-[0-9A-F]{16}$");
    public static bool MatchesKey(string? key, byte[] hash) =>
        key is { Length: 43 } && Regex.IsMatch(key, "^[a-zA-Z0-9_-]{43}$") &&
        hash.Length == 32 && CryptographicOperations.FixedTimeEquals(HashKey(key), hash);

    public static bool IsImage(byte[] data, string mime)
    {
        if (data.Length is 0 or > MaxImageBytes) return false;
        return mime switch
        {
            "image/png" => data.Length >= 8 &&
                data.AsSpan(0, 8).SequenceEqual(new byte[] {137, 80, 78, 71, 13, 10, 26, 10}),
            "image/jpeg" => data.Length >= 3 &&
                data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff,
            "image/webp" => data.Length >= 12 &&
                Encoding.ASCII.GetString(data, 0, 4) == "RIFF" &&
                Encoding.ASCII.GetString(data, 8, 4) == "WEBP",
            _ => false
        };
    }

    // Before the production renderer trusts a saved design, a separate manufacturing
    // validation will check all dimensions, astronomy, materials and SKU compatibility.
    public static bool ValidDesignJson(string designJson, string preferencesJson, bool prepared)
    {
        if (Encoding.UTF8.GetByteCount(designJson) > MaxJsonBytes ||
            Encoding.UTF8.GetByteCount(preferencesJson) > 32_768)
            return false;
        try
        {
            using var design = JsonDocument.Parse(designJson,
                new JsonDocumentOptions { MaxDepth = 48 });
            using var prefs = JsonDocument.Parse(preferencesJson);
            var d = design.RootElement;
            var p = prefs.RootElement;
            if (d.ValueKind != JsonValueKind.Object || p.ValueKind != JsonValueKind.Object)
                return false;
            if (!d.TryGetProperty("schemaVersion", out var version) ||
                version.GetString() != "1.5" ||
                !d.TryGetProperty("moment", out var moment) ||
                moment.ValueKind != JsonValueKind.Object ||
                !moment.TryGetProperty("date", out var date) ||
                date.ValueKind != JsonValueKind.String ||
                date.GetString()?.Length != 10 ||
                !moment.TryGetProperty("location", out var loc) ||
                loc.ValueKind != JsonValueKind.Object ||
                !d.TryGetProperty("astronomy", out var astronomy) ||
                astronomy.ValueKind != JsonValueKind.Object ||
                !d.TryGetProperty("photo", out var photoSpec) ||
                photoSpec.ValueKind != JsonValueKind.Object ||
                !photoSpec.TryGetProperty("assetId", out var assetId) ||
                assetId.ValueKind != JsonValueKind.String ||
                !d.TryGetProperty("stars", out var stars) ||
                stars.ValueKind != JsonValueKind.Array ||
                stars.GetArrayLength() > 20_000 ||
                !p.TryGetProperty("layout", out var layout) ||
                layout.ValueKind != JsonValueKind.String ||
                !p.TryGetProperty("finish", out var finish) ||
                finish.ValueKind != JsonValueKind.String)
                return false;
            var layoutValue = layout.GetString();
            var finishValue = finish.GetString();
            return (layoutValue == "above" || layoutValue == "within") &&
                   (finishValue == "walnut" || finishValue == "oak" || finishValue == "ebony") &&
                   (layoutValue != "within" || prepared);
        }
        catch (JsonException) { return false; }
        catch (InvalidOperationException) { return false; }
    }
}

public sealed record SavedDesignRow(
    string DesignId, byte[] KeyHash, DateTime CreatedUtc,
    string DesignJson, string PreferencesJson,
    string OriginalMime, string? ForegroundMime);

public sealed class DesignRepository(DesignPersistenceOptions options)
{
    private BlobContainerClient Container =>
        new BlobServiceClient(options.StorageConnectionString)
            .GetBlobContainerClient(options.StorageContainerName);

    private SqlConnection NewConnection() => new(options.SqlConnectionString);

    private static async Task<byte[]> ReadImage(IFormFile file, CancellationToken ct)
    {
        if (file.Length is < 1 or > DesignSecurity.MaxImageBytes)
            throw new InvalidDataException("Image size must be between 1 byte and 10 MB.");
        await using var stream = file.OpenReadStream();
        using var buffer = new MemoryStream((int)file.Length);
        await stream.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();
        if (!DesignSecurity.IsImage(bytes, file.ContentType))
            throw new InvalidDataException("The uploaded file is not a valid JPG, PNG or WebP image.");
        return bytes;
    }

    public async Task<(string Id, string Key, DateTime CreatedUtc)> SaveAsync(
        string designJson, string preferencesJson, IFormFile photo,
        IFormFile? foreground, CancellationToken ct)
    {
        var photoBytes = await ReadImage(photo, ct);
        byte[]? foregroundBytes = foreground is null ? null : await ReadImage(foreground, ct);
        if (foreground is not null && foreground.ContentType != "image/png")
            throw new InvalidDataException("Prepared foreground must be a PNG.");

        var id = DesignSecurity.NewId();
        var key = DesignSecurity.NewAccessKey();
        var design = JsonNode.Parse(designJson)!.AsObject();
        design["designId"] = id;
        design["photo"]!["assetId"] = "private-blob-original";
        var finalDesignJson = design.ToJsonString();

        var container = Container;
        var originalBlob = container.GetBlobClient(id + "/original");
        var foregroundBlob = container.GetBlobClient(id + "/foreground");
        var uploadedOriginal = false;
        var uploadedForeground = false;
        var insertionStarted = false;
        try
        {
            await originalBlob.UploadAsync(BinaryData.FromBytes(photoBytes),
                new BlobUploadOptions {
                    HttpHeaders = new BlobHttpHeaders { ContentType = photo.ContentType }
                }, ct);
            uploadedOriginal = true;
            if (foregroundBytes is not null)
            {
                await foregroundBlob.UploadAsync(BinaryData.FromBytes(foregroundBytes),
                    new BlobUploadOptions {
                        HttpHeaders = new BlobHttpHeaders { ContentType = "image/png" }
                    }, ct);
                uploadedForeground = true;
            }

            await using var sql = NewConnection();
            await sql.OpenAsync(ct);
            await using var command = sql.CreateCommand();
            command.CommandText = """
                INSERT INTO dbo.CustomerDesigns
                  (DesignId, AccessKeyHash, DesignJson, PreferencesJson, OriginalMime, ForegroundMime)
                OUTPUT inserted.CreatedUtc
                VALUES (@id, @hash, @design, @prefs, @mime, @fgMime);
                """;
            command.Parameters.Add("@id", SqlDbType.NVarChar, 24).Value = id;
            command.Parameters.Add("@hash", SqlDbType.VarBinary, 32).Value = DesignSecurity.HashKey(key);
            command.Parameters.Add("@design", SqlDbType.NVarChar, -1).Value = finalDesignJson;
            command.Parameters.Add("@prefs", SqlDbType.NVarChar, -1).Value = preferencesJson;
            command.Parameters.Add("@mime", SqlDbType.VarChar, 24).Value = photo.ContentType;
            command.Parameters.Add("@fgMime", SqlDbType.VarChar, 24).Value =
                foregroundBytes is null ? DBNull.Value : "image/png";
            insertionStarted = true;
            var created = (DateTime)(await command.ExecuteScalarAsync(ct) ??
                throw new InvalidOperationException("Design was not saved."));
            return (id, key, DateTime.SpecifyKind(created, DateTimeKind.Utc));
        }
        catch
        {
            // If the SQL insert was attempted, it might have committed despite a
            // network timeout. Keep the blobs rather than leave a valid SQL row
            // pointing at deleted artwork. A reconciliation job can remove orphans.
            if (!insertionStarted)
            {
                if (uploadedOriginal)
                    try { await originalBlob.DeleteIfExistsAsync(cancellationToken: CancellationToken.None); }
                    catch (RequestFailedException) { }
                if (uploadedForeground)
                    try { await foregroundBlob.DeleteIfExistsAsync(cancellationToken: CancellationToken.None); }
                    catch (RequestFailedException) { }
            }
            throw;
        }
    }

    public async Task<SavedDesignRow?> FindAsync(string id, CancellationToken ct)
    {
        await using var sql = NewConnection();
        await sql.OpenAsync(ct);
        await using var command = sql.CreateCommand();
        command.CommandText = """
            SELECT DesignId, AccessKeyHash, CreatedUtc, DesignJson,
                   PreferencesJson, OriginalMime, ForegroundMime
              FROM dbo.CustomerDesigns WHERE DesignId = @id;
            """;
        command.Parameters.Add("@id", SqlDbType.NVarChar, 24).Value = id;
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new SavedDesignRow(
            reader.GetString(0), (byte[])reader[1],
            DateTime.SpecifyKind(reader.GetDateTime(2), DateTimeKind.Utc),
            reader.GetString(3), reader.GetString(4), reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6));
    }

    public async Task<byte[]> DownloadAssetAsync(string id, string type, CancellationToken ct)
    {
        var blob = Container.GetBlobClient(id + "/" + type);
        var result = await blob.DownloadContentAsync(ct);
        return result.Value.Content.ToArray();
    }
}

public static class DesignPersistenceEndpoints
{
    public static void MapDesignPersistenceEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/designs", async (HttpContext context,
            DesignPersistenceOptions options, DesignRepository repository) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!options.IsConfigured)
                return Results.Problem("Design saving is not configured.", statusCode: 503);
            var bodyFeature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (bodyFeature is { IsReadOnly: false })
                bodyFeature.MaxRequestBodySize = DesignSecurity.MaxRequestBytes;
            if (context.Request.ContentLength > DesignSecurity.MaxRequestBytes)
                return Results.Problem("File too large.", statusCode: 413);
            if (!context.Request.HasFormContentType)
                return Results.BadRequest("Expected a multipart design upload.");
            try
            {
                var form = await context.Request.ReadFormAsync(context.RequestAborted);
                var photo = form.Files.GetFile("photo");
                var foreground = form.Files.GetFile("foreground");
                var design = form["design"].ToString();
                var prefs = form["preferences"].ToString();
                if (photo is null || !DesignSecurity.ValidDesignJson(
                    design, prefs, foreground is not null))
                    return Results.BadRequest("Complete your design and sky before saving.");
                var saved = await repository.SaveAsync(design, prefs, photo,
                    foreground, context.RequestAborted);
                return Results.Ok(new {
                    designId = saved.Id, accessKey = saved.Key,
                    createdAtUtc = saved.CreatedUtc,
                    status = "SAVED_UNPAID"
                });
            }
            catch (InvalidDataException) {
                return Results.BadRequest("Please upload a valid JPG, PNG or WebP image (up to 10 MB).");
            }
            catch (Exception ex) when (ex is SqlException or RequestFailedException or
                InvalidOperationException or JsonException or IOException) {
                return Results.Problem("Design storage is temporarily unavailable.", statusCode: 503);
            }
        }).RequireRateLimiting("design-save");

        app.MapGet("/api/designs/{designId}", async (string designId, HttpContext context,
            DesignPersistenceOptions options, DesignRepository repository) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (!options.IsConfigured) return Results.StatusCode(503);
            if (!DesignSecurity.ValidId(designId)) return Results.NotFound();
            try {
                var row = await repository.FindAsync(designId, context.RequestAborted);
                if (row is null || !DesignSecurity.MatchesKey(
                    context.Request.Headers["X-Design-Access-Key"].ToString(), row.KeyHash))
                    return Results.NotFound();
                return Results.Ok(new {
                    designId = row.DesignId,
                    createdAtUtc = row.CreatedUtc,
                    status = "SAVED_UNPAID",
                    design = JsonSerializer.Deserialize<JsonElement>(row.DesignJson),
                    preferences = JsonSerializer.Deserialize<JsonElement>(row.PreferencesJson),
                    hasPreparedForeground = row.ForegroundMime is not null
                });
            }
            catch (Exception ex) when (ex is SqlException or RequestFailedException or JsonException)
            { return Results.Problem("Design retrieval is temporarily unavailable.", statusCode: 503); }
        }).RequireRateLimiting("design-load");

        app.MapGet("/api/designs/{designId}/assets/{type}", async (
            string designId, string type, HttpContext context,
            DesignPersistenceOptions options, DesignRepository repository) =>
        {
            context.Response.Headers.CacheControl = "private, no-store";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            if (!options.IsConfigured) return Results.StatusCode(503);
            if (!DesignSecurity.ValidId(designId) ||
                (type != "original" && type != "foreground")) return Results.NotFound();
            try {
                var row = await repository.FindAsync(designId, context.RequestAborted);
                if (row is null || !DesignSecurity.MatchesKey(
                    context.Request.Headers["X-Design-Access-Key"].ToString(), row.KeyHash))
                    return Results.NotFound();
                if (type == "foreground" && row.ForegroundMime is null) return Results.NotFound();
                var data = await repository.DownloadAssetAsync(designId, type, context.RequestAborted);
                return Results.File(data, type == "foreground" ? row.ForegroundMime : row.OriginalMime);
            }
            catch (Exception ex) when (ex is SqlException or RequestFailedException)
            { return Results.Problem("Design file is temporarily unavailable.", statusCode: 503); }
        }).RequireRateLimiting("design-load");
    }
}
