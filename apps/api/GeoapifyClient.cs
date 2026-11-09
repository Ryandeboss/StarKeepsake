using System.Globalization;
using System.Text.Json;

namespace StarKeepsake.Api;

public sealed class GeoapifyException(string message) : Exception(message);

/// <summary>Server-only worldwide location search and time-zone lookup.</summary>
public sealed class GeoapifyClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public GeoapifyClient(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Geoapify:ApiKey"] ?? string.Empty;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

    public async Task<IReadOnlyList<LocationCandidate>> SearchLocationsAsync(
        string query, CancellationToken cancellationToken)
    {
        EnsureConfigured();
        var response = await QueryAsync(
            "v1/geocode/search?text=" + Uri.EscapeDataString(query.Trim()) +
            "&format=json&limit=7&lang=en&apiKey=" + Uri.EscapeDataString(_apiKey),
            cancellationToken);

        return (response.Results ?? [])
            .Where(place => place.Lat is >= -90 and <= 90 &&
                            place.Lon is >= -180 and <= 180 &&
                            !string.IsNullOrWhiteSpace(place.Formatted))
            .Select(place => new LocationCandidate(
                place.Formatted!,
                place.Formatted!,
                place.Lat!.Value,
                place.Lon!.Value,
                ConfidenceLabel(place.Rank?.Confidence),
                place.Timezone?.Name,
                "geoapify"))
            .ToArray();
    }

    public async Task<string> GetTimeZoneIdAsync(
        double latitude, double longitude, CancellationToken cancellationToken)
    {
        EnsureConfigured();
        if (!double.IsFinite(latitude) || !double.IsFinite(longitude) ||
            latitude is < -90 or > 90 || longitude is < -180 or > 180)
            throw new GeoapifyException("Invalid coordinates for time-zone lookup.");

        var response = await QueryAsync(
            "v1/geocode/reverse?lat=" + latitude.ToString(CultureInfo.InvariantCulture) +
            "&lon=" + longitude.ToString(CultureInfo.InvariantCulture) +
            "&format=json&limit=1&apiKey=" + Uri.EscapeDataString(_apiKey),
            cancellationToken);

        var zone = response.Results?.FirstOrDefault()?.Timezone?.Name;
        if (string.IsNullOrWhiteSpace(zone))
            throw new GeoapifyException("The selected location has no available time zone.");
        return zone;
    }

    private async Task<GeoapifyResponse> QueryAsync(
        string path, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await _httpClient.GetAsync(path, cancellationToken);
            if (!response.IsSuccessStatusCode)
                throw new GeoapifyException(
                    "Geocoding failed at the location service (HTTP " +
                    (int)response.StatusCode + ").");

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await JsonSerializer.DeserializeAsync<GeoapifyResponse>(
                stream, JsonOptions, cancellationToken)
                ?? throw new GeoapifyException("The geocoding service returned no data.");
        }
        catch (HttpRequestException)
        {
            throw new GeoapifyException("The live location service could not be reached.");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new GeoapifyException("The live location service timed out.");
        }
        catch (JsonException)
        {
            throw new GeoapifyException("The geocoding service returned an invalid response.");
        }
    }

    private void EnsureConfigured()
    {
        if (!IsConfigured)
            throw new GeoapifyException("Geoapify is not configured for this environment.");
    }

    private static string ConfidenceLabel(double? value) =>
        value switch
        {
            >= 0.90 => "High",
            >= 0.65 => "Medium",
            >= 0.35 => "Low",
            _ => "Unknown",
        };

    private sealed record GeoapifyResponse(List<GeoapifyLocation>? Results);
    private sealed record GeoapifyLocation(
        double? Lat, double? Lon, string? Formatted,
        GeoapifyTimezone? Timezone, GeoapifyRank? Rank);
    private sealed record GeoapifyTimezone(string? Name);
    private sealed record GeoapifyRank(double? Confidence);
}
