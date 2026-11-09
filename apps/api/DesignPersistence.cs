using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.Features;

namespace StarKeepsake.Api;

// Customer photos and snapshots now live in a dedicated Supabase project.
// The secret API key is only read on the Azure API server, NEVER in Vite.
public sealed class DesignPersistenceOptions
{
    public string ProjectUrl { get; set; } = "";
    public string SecretKey { get; set; } = "";
    public string StorageBucketName { get; set; } = "starkeepsake-designs";

    public bool IsConfigured =>
        Uri.TryCreate(ProjectUrl, UriKind.Absolute, out var url) &&
        url.Scheme == Uri.UriSchemeHttps &&
        url.Host.EndsWith(".supabase.co", StringComparison.OrdinalIgnoreCase) &&
        url.AbsolutePath == "/" &&
        url.Query == "" && url.Fragment == "" &&
        (SecretKey.StartsWith("sb_secret_", StringComparison.Ordinal) ||
         SecretKey.StartsWith("eyJ", StringComparison.Ordinal)) &&
        SecretKey.Length >= 40 &&
        Regex.IsMatch(StorageBucketName,
            "^[a-z0-9](?:[a-z0-9-]{1,61})[a-z0-9]$");
}

// Knowing the public Etsy Design ID does not provide access to private photo bytes.
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

    // Validity for the M1 preview, not approval for physical manufacture.
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
            if (d.ValueKind != JsonValueKind.Object || p.ValueKind != JsonValueKind.Object ||
                !d.TryGetProperty("schemaVersion", out var version) ||
                version.GetString() != "1.5" ||
                !d.TryGetProperty("moment", out var moment) ||
                moment.ValueKind != JsonValueKind.Object ||
                !moment.TryGetProperty("date", out var date) ||
                date.ValueKind != JsonValueKind.String || date.GetString()?.Length != 10 ||
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
    string DesignId, byte[] KeyHash, DateTimeOffset CreatedUtc,
    string DesignJson, string PreferencesJson,
    string OriginalMime, string? ForegroundMime);

// PostgREST and private Supabase Storage need only one server-side secret key.
// New sb_secret_ keys must be sent in apikey, not as Authorization: Bearer.
public sealed class DesignRepository
{
    private readonly HttpClient _http;
    private readonly DesignPersistenceOptions _options;

    public DesignRepository(HttpClient http, DesignPersistenceOptions options)
    {
        _http = http;
        _options = options;
        if (options.IsConfigured)
            _http.BaseAddress = new Uri(options.ProjectUrl.TrimEnd('/') + "/");
    }

    private HttpRequestMessage NewRequest(HttpMethod method, string relativePath)
    {
        var request = new HttpRequestMessage(method, relativePath.TrimStart('/'));
        request.Headers.TryAddWithoutValidation("apikey", _options.SecretKey);
        if (_options.SecretKey.StartsWith("eyJ", StringComparison.Ordinal))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.SecretKey);
        return request;
    }

    private string AssetPath(string id, string type) =>
        _options.StorageBucketName + "/" + id + "/" + type;

    private async Task UploadImageAsync(
        string id, string type, byte[] bytes, string mime, CancellationToken ct)
    {
        using var request = NewRequest(HttpMethod.Post,
            "storage/v1/object/" + AssetPath(id, type));
        request.Content = new ByteArrayContent(bytes);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(mime);
        request.Headers.TryAddWithoutValidation("x-upsert", "false");
        using var response = await _http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException("Private photo upload failed.", null, response.StatusCode);
    }

    private async Task DeleteUploadedAsync(string id, string type)
    {
        try
        {
            using var request = NewRequest(HttpMethod.Delete,
                "storage/v1/object/" + AssetPath(id, type));
            using var response = await _http.SendAsync(request, CancellationToken.None);
        }
        catch (HttpRequestException) { /* Reconcile any orphaned objects separately. */ }
        catch (TaskCanceledException) { }
    }

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

    public async Task<(string Id, string Key, DateTimeOffset CreatedUtc)> SaveAsync(
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
        design["photo"]!["assetId"] = "private-supabase-original";
        var designPayload = JsonSerializer.Deserialize<JsonElement>(design.ToJsonString());
        var preferencesPayload = JsonSerializer.Deserialize<JsonElement>(preferencesJson);
        var uploadedOriginal = false;
        var uploadedForeground = false;
        var insertStarted = false;
        try
        {
            await UploadImageAsync(id, "original", photoBytes, photo.ContentType, ct);
            uploadedOriginal = true;
            if (foregroundBytes is not null)
            {
                await UploadImageAsync(id, "foreground", foregroundBytes, "image/png", ct);
                uploadedForeground = true;
            }

            // The service key never enters the browser. No user-supplied ID controls
            // object paths, and all column values are JSON encoded (not SQL strings).
            using var request = NewRequest(HttpMethod.Post, "rest/v1/customer_designs");
            request.Headers.TryAddWithoutValidation("Prefer", "return=representation");
            request.Content = new StringContent(JsonSerializer.Serialize(new
            {
                design_id = id,
                access_key_hash = Convert.ToHexString(DesignSecurity.HashKey(key)),
                design_json = designPayload,
                preferences_json = preferencesPayload,
                original_mime = photo.ContentType,
                foreground_mime = foregroundBytes is null ? null : "image/png"
            }), Encoding.UTF8, "application/json");
            insertStarted = true;
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException("Could not save design metadata.", null, response.StatusCode);
            using var result = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct),
                cancellationToken: ct);
            var rows = result.RootElement;
            if (rows.ValueKind != JsonValueKind.Array || rows.GetArrayLength() != 1)
                throw new InvalidDataException("Design database returned no row.");
            var created = rows[0].GetProperty("created_at").GetDateTimeOffset();
            return (id, key, created);
        }
        catch
        {
            // The INSERT can commit despite a timeout. Never delete photos once a
            // metadata insert was attempted, or a real design may lose its files.
            if (!insertStarted)
            {
                if (uploadedOriginal) await DeleteUploadedAsync(id, "original");
                if (uploadedForeground) await DeleteUploadedAsync(id, "foreground");
            }
            throw;
        }
    }

    public async Task<SavedDesignRow?> FindAsync(string id, CancellationToken ct)
    {
        using var request = NewRequest(HttpMethod.Get,
            "rest/v1/customer_designs?design_id=eq." + id +
            "&select=design_id%2Caccess_key_hash%2Ccreated_at%2Cdesign_json%2Cpreferences_json%2Coriginal_mime%2Cforeground_mime&limit=1");
        using var response = await _http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException("Design lookup failed.", null, response.StatusCode);
        using var result = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct),
            cancellationToken: ct);
        var rows = result.RootElement;
        if (rows.ValueKind != JsonValueKind.Array || rows.GetArrayLength() == 0)
            return null;
        var row = rows[0];
        return new SavedDesignRow(
            row.GetProperty("design_id").GetString()!,
            Convert.FromHexString(row.GetProperty("access_key_hash").GetString()!),
            row.GetProperty("created_at").GetDateTimeOffset(),
            row.GetProperty("design_json").GetRawText(),
            row.GetProperty("preferences_json").GetRawText(),
            row.GetProperty("original_mime").GetString()!,
            row.GetProperty("foreground_mime").ValueKind == JsonValueKind.Null
                ? null : row.GetProperty("foreground_mime").GetString());
    }

    public async Task<byte[]> DownloadAssetAsync(string id, string type, CancellationToken ct)
    {
        using var request = NewRequest(HttpMethod.Get,
            "storage/v1/object/authenticated/" + AssetPath(id, type));
        using var response = await _http.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
            throw new FileNotFoundException("Private design file not found.");
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException("Private design file read failed.", null, response.StatusCode);
        return await response.Content.ReadAsByteArrayAsync(ct);
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
            catch (Exception ex) when (ex is HttpRequestException or JsonException or
                InvalidOperationException or IOException or FormatException) {
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
            catch (Exception ex) when (ex is HttpRequestException or JsonException or FormatException)
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
            catch (FileNotFoundException) { return Results.NotFound(); }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or FormatException)
            { return Results.Problem("Design file is temporarily unavailable.", statusCode: 503); }
        }).RequireRateLimiting("design-load");
    }
}
