using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;

namespace StarKeepsake.Api;

public sealed class DesignEngineException(string message) : Exception(message);
public sealed class DesignEngineInputException(string message) : Exception(message);

public sealed class DesignEngineClient
{
    private readonly HttpClient _httpClient;

    public DesignEngineClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<AstronomyEngineResponse> GenerateStarsAsync(
        AstronomyEngineRequest request,
        CancellationToken cancellationToken)
    {
        if (_httpClient.BaseAddress is null)
        {
            throw new DesignEngineException("The design engine is not configured for this environment.");
        }

        using var response = await _httpClient.PostAsJsonAsync(
            "astronomy/stars",
            request,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new DesignEngineException(
                $"The design engine returned status {(int)response.StatusCode}: {detail}");
        }

        return await response.Content.ReadFromJsonAsync<AstronomyEngineResponse>(
            cancellationToken: cancellationToken)
            ?? throw new DesignEngineException("The design engine returned an empty astronomy response.");
    }

    public async Task<byte[]> GenerateEngravingPreviewAsync(
        Stream photoStream,
        string contentType,
        CancellationToken cancellationToken)
    {
        if (_httpClient.BaseAddress is null)
        {
            throw new DesignEngineException("The design engine is not configured for this environment.");
        }

        using var multipart = new MultipartFormDataContent();
        using var image = new StreamContent(photoStream);
        image.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        multipart.Add(image, "image", "photo");

        using var response = await _httpClient.PostAsync(
            "engraving/preview", multipart, cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.UnprocessableEntity)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var message = "We could not process this photo. Try a JPG, PNG, or WebP.";
            try
            {
                using var document = JsonDocument.Parse(body);
                if (document.RootElement.TryGetProperty("detail", out var detail)
                    && detail.ValueKind == JsonValueKind.String)
                {
                    message = detail.GetString() ?? message;
                }
            }
            catch (JsonException)
            {
                // Keep the generic message for unexpected upstream responses.
            }

            throw new DesignEngineInputException(message);
        }

        if (!response.IsSuccessStatusCode ||
            response.Content.Headers.ContentType?.MediaType != "image/png")
        {
            throw new DesignEngineException("The engraving service did not return a PNG preview.");
        }

        const int maxOutputBytes = 8 * 1024 * 1024;
        await using var input = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var output = new MemoryStream();
        var buffer = new byte[81920];
        int count;
        while ((count = await input.ReadAsync(buffer, cancellationToken)) > 0)
        {
            if (output.Length + count > maxOutputBytes)
            {
                throw new DesignEngineException("The engraving preview exceeded the response limit.");
            }
            await output.WriteAsync(buffer.AsMemory(0, count), cancellationToken);
        }

        return output.ToArray();
    }
}

public sealed record AstronomyEngineRequest(
    string Date,
    string? UtcDateTime,
    bool ExactTimeUnknown,
    string TimeZoneId,
    double Latitude,
    double Longitude,
    double MagnitudeLimit,
    int MaxStars,
    double MinSeparationMm);

public sealed record AstronomyEngineResponse(
    AstronomyCalculation Calculation,
    IReadOnlyList<DesignStar> Stars);

public sealed record AstronomyCalculation(
    string Catalog,
    string Ephemeris,
    string Projection,
    string Orientation,
    string CalculationUtcDateTime,
    string TimeBasis,
    double MagnitudeLimit,
    int MaxStars,
    double MinSeparationMm,
    int VisibleCatalogStars,
    int ProjectedCandidates,
    int SelectedStars);

public sealed record DesignStar(
    int HipparcosId,
    double XMm,
    double YMm,
    double Magnitude,
    double AltitudeDeg,
    double AzimuthDeg,
    double HoleSizeMm,
    int LedIndex);
