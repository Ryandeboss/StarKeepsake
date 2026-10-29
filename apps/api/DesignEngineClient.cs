using System.Net.Http.Json;

namespace StarKeepsake.Api;

public sealed class DesignEngineException(string message) : Exception(message);

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
