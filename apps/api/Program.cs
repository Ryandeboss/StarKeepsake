using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using StarKeepsake.Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpClient<AzureMapsClient>(client =>
{
    client.BaseAddress = new Uri("https://atlas.microsoft.com/");
    client.Timeout = TimeSpan.FromSeconds(10);
});

builder.Services.AddHttpClient<DesignEngineClient>(client =>
{
    var baseUrl = builder.Configuration["DesignEngine:BaseUrl"];
    if (Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
    {
        client.BaseAddress = uri;
    }

    client.Timeout = TimeSpan.FromSeconds(45);
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("web", policy =>
    {
        policy
            .SetIsOriginAllowed(origin =>
            {
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                {
                    return false;
                }

                return uri.Host.Equals("starkeepsake.vercel.app", StringComparison.OrdinalIgnoreCase)
                    || uri.Host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase)
                    || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                    || uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);
            })
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("maps", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));

    options.AddPolicy("engraving", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 12,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));

    options.AddPolicy("astronomy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));
});

var app = builder.Build();
var deploymentCommitSha = builder.Configuration["Deployment:CommitSha"] ?? "unknown";

app.UseCors("web");
app.UseRateLimiter();

app.MapGet("/health", () => Results.Ok(new
{
    service = "StarKeepsake.Api",
    status = "healthy",
    commitSha = deploymentCommitSha
}));

app.MapGet("/api/locations/search", async (
    string? q,
    AzureMapsClient maps,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
    {
        return Results.BadRequest(new
        {
            code = "invalid_location_query",
            message = "Enter at least two characters to search for a location."
        });
    }

    try
    {
        var results = await maps.SearchLocationsAsync(q, cancellationToken);
        return Results.Ok(results);
    }
    catch (AzureMapsException exception)
    {
        return Results.Problem(
            title: "Location service unavailable",
            detail: exception.Message,
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).RequireRateLimiting("maps");

app.MapPost("/api/moments/resolve", async (
    ResolveMomentRequest request,
    AzureMapsClient maps,
    CancellationToken cancellationToken) =>
{
    if (!DateOnly.TryParseExact(
        request.Date,
        "yyyy-MM-dd",
        CultureInfo.InvariantCulture,
        DateTimeStyles.None,
        out var date))
    {
        return Results.BadRequest(new
        {
            code = "invalid_date",
            message = "Choose a valid calendar date."
        });
    }

    if (request.Location.Latitude is < -90 or > 90 ||
        request.Location.Longitude is < -180 or > 180)
    {
        return Results.BadRequest(new
        {
            code = "invalid_coordinates",
            message = "The selected location has invalid coordinates."
        });
    }

    TimeOnly? localTime = null;

    if (!request.ExactTimeUnknown)
    {
        if (string.IsNullOrWhiteSpace(request.Time) ||
            !TimeOnly.TryParseExact(
                request.Time,
                "HH:mm",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsedTime))
        {
            return Results.BadRequest(new
            {
                code = "invalid_time",
                message = "Choose a valid local time or mark the exact time as unknown."
            });
        }

        localTime = parsedTime;
    }

    try
    {
        var timeZoneId = await maps.GetTimeZoneIdAsync(
            request.Location.Latitude,
            request.Location.Longitude,
            cancellationToken);

        string? localDateTime = null;
        string? utcDateTime = null;

        if (localTime is not null)
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            var local = date.ToDateTime(localTime.Value, DateTimeKind.Unspecified);

            if (zone.IsInvalidTime(local))
            {
                return Results.BadRequest(new
                {
                    code = "invalid_dst_time",
                    message = "That local time does not exist because the clocks move forward. Choose another time."
                });
            }

            if (zone.IsAmbiguousTime(local))
            {
                return Results.Conflict(new
                {
                    code = "ambiguous_dst_time",
                    message = "That local time occurs twice because the clocks move back. Choose a nearby time for now."
                });
            }

            var utc = TimeZoneInfo.ConvertTimeToUtc(local, zone);
            localDateTime = local.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);
            utcDateTime = utc.ToString("O", CultureInfo.InvariantCulture);
        }

        var resolvedLocation = new ResolvedLocation(
            request.LocationQuery.Trim(),
            request.Location.DisplayName,
            request.Location.FormattedAddress,
            request.Location.Latitude,
            request.Location.Longitude,
            timeZoneId,
            NormalizeConfidence(request.Location.Confidence));

        return Results.Ok(new ResolvedMomentResponse(
            request.Date,
            request.ExactTimeUnknown ? null : request.Time,
            request.ExactTimeUnknown,
            resolvedLocation,
            localDateTime,
            utcDateTime));
    }
    catch (TimeZoneNotFoundException)
    {
        return Results.Problem(
            title: "Time zone unavailable",
            detail: "The selected location returned a time zone this server could not resolve.",
            statusCode: StatusCodes.Status502BadGateway);
    }
    catch (AzureMapsException exception)
    {
        return Results.Problem(
            title: "Location service unavailable",
            detail: exception.Message,
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).RequireRateLimiting("maps");


app.MapPost("/api/astronomy/stars", async (
    GenerateAstronomyRequest request,
    DesignEngineClient designEngine,
    CancellationToken cancellationToken) =>
{
    if (request.Moment.Location is null)
    {
        return Results.BadRequest(new
        {
            code = "location_not_resolved",
            message = "Resolve a location before generating the star field."
        });
    }

    try
    {
        var response = await designEngine.GenerateStarsAsync(
            new AstronomyEngineRequest(
                request.Moment.Date,
                request.Moment.UtcDateTime,
                request.Moment.ExactTimeUnknown,
                request.Moment.Location.TimeZoneId,
                request.Moment.Location.Latitude,
                request.Moment.Location.Longitude,
                request.SkySettings.MagnitudeLimit,
                request.SkySettings.MaxStars,
                request.SkySettings.MinSeparationMm,
                request.FramePresetId ?? "11x14",
                request.PhotoAspectRatio),
            cancellationToken);

        return Results.Ok(response);
    }
    catch (DesignEngineException exception)
    {
        return Results.Problem(
            title: "Astronomy service unavailable",
            detail: exception.Message,
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).RequireRateLimiting("astronomy");

app.MapPost("/api/engraving/preview", async (
    HttpRequest request,
    DesignEngineClient designEngine,
    CancellationToken cancellationToken) =>
{
    const long maxPhotoBytes = 10L * 1024 * 1024;

    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new { message = "Choose a JPG, PNG, or WebP photo." });
    }

    try
    {
        var form = await request.ReadFormAsync(cancellationToken);
        var photo = form.Files.GetFile("image");

        if (photo is null || photo.Length == 0)
        {
            return Results.BadRequest(new { message = "Choose a photo to process." });
        }

        if (photo.Length > maxPhotoBytes)
        {
            return Results.Problem(
                title: "Photo too large",
                detail: "Choose a photo no larger than 10 MB.",
                statusCode: StatusCodes.Status413PayloadTooLarge);
        }

        if (photo.ContentType is not ("image/jpeg" or "image/png" or "image/webp"))
        {
            return Results.BadRequest(new { message = "Use a JPG, PNG, or WebP photo." });
        }

        var framePresetId = form["framePresetId"].ToString();
        var aspectString = form["photoAspectRatio"].ToString();
        double? photoAspectRatio = null;
        if (aspectString.Length > 0)
        {
            if (!double.TryParse(aspectString,
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var parsedAspect) ||
                !double.IsFinite(parsedAspect) || parsedAspect < 0.35 || parsedAspect > 3.0)
                return Results.BadRequest(new { message = "Choose a valid source photo aspect ratio." });
            photoAspectRatio = parsedAspect;
        }
        var fitMode = form["fitMode"].ToString();
        var cropJson = form["crop"].ToString();
        if (framePresetId is not ("auto" or "8x10" or "11x14" or "16x20") ||
            (framePresetId == "auto" && photoAspectRatio is null) ||
            fitMode is not ("contain" or "cover") ||
            cropJson.Length is < 2 or > 512)
        {
            return Results.BadRequest(new { message = "Choose valid frame and crop settings." });
        }

        using var stream = photo.OpenReadStream();
        var engravingPng = await designEngine.GenerateEngravingPreviewAsync(
            stream, photo.ContentType, framePresetId, photoAspectRatio, fitMode, cropJson, cancellationToken);

        request.HttpContext.Response.Headers.CacheControl = "no-store";
        return Results.Bytes(engravingPng, contentType: "image/png");
    }
    catch (InvalidDataException)
    {
        return Results.BadRequest(new { message = "The photo upload is invalid." });
    }
    catch (DesignEngineInputException exception)
    {
        return Results.BadRequest(new { message = exception.Message });
    }
    catch (DesignEngineException)
    {
        return Results.Problem(
            title: "Engraving preview unavailable",
            detail: "We could not generate the engraving preview right now.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch (HttpRequestException)
    {
        return Results.Problem(
            title: "Engraving preview unavailable",
            detail: "We could not contact the engraving service right now.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
    {
        return Results.Problem(
            title: "Engraving preview timeout",
            detail: "The engraving preview took too long. Please try again.",
            statusCode: StatusCodes.Status504GatewayTimeout);
    }
})
.WithMetadata(new RequestSizeLimitAttribute(11L * 1024 * 1024))
.RequireRateLimiting("engraving");

app.Run();

static string NormalizeConfidence(string confidence) =>
    confidence is "High" or "Medium" or "Low" ? confidence : "Unknown";

public sealed record ResolveMomentRequest(
    string Date,
    string? Time,
    bool ExactTimeUnknown,
    string LocationQuery,
    LocationCandidate Location);

public sealed record ResolvedLocation(
    string Query,
    string DisplayName,
    string FormattedAddress,
    double Latitude,
    double Longitude,
    string TimeZoneId,
    string Confidence);

public sealed record ResolvedMomentResponse(
    string Date,
    string? Time,
    bool ExactTimeUnknown,
    ResolvedLocation Location,
    string? LocalDateTime,
    string? UtcDateTime);

public partial class Program;


public sealed record GenerateAstronomyRequest(
    AstronomyMomentInput Moment,
    AstronomySkySettingsInput SkySettings,
    string? FramePresetId = null,
    double? PhotoAspectRatio = null);

public sealed record AstronomyMomentInput(
    string Date,
    string? Time,
    bool ExactTimeUnknown,
    ResolvedLocation? Location,
    string? LocalDateTime,
    string? UtcDateTime);

public sealed record AstronomySkySettingsInput(
    string Background,
    double Brightness,
    bool ShowConstellation,
    string Projection,
    double MagnitudeLimit,
    int MaxStars,
    double MinSeparationMm);
