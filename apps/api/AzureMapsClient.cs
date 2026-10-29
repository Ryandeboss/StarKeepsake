using System.Globalization;
using System.Text.Json;

namespace StarKeepsake.Api;

public sealed record LocationCandidate(
    string DisplayName,
    string FormattedAddress,
    double Latitude,
    double Longitude,
    string Confidence);

public sealed class AzureMapsException(string message) : Exception(message);

public sealed class AzureMapsClient
{
    private readonly HttpClient _httpClient;
    private readonly string _subscriptionKey;

    public AzureMapsClient(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _subscriptionKey = configuration["AzureMaps:SubscriptionKey"] ?? string.Empty;
    }

    public async Task<IReadOnlyList<LocationCandidate>> SearchLocationsAsync(
        string query,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();

        var requestUri =
            $"geocode?api-version=2025-01-01&top=5&query={Uri.EscapeDataString(query.Trim())}";

        using var request = CreateRequest(requestUri);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new AzureMapsException(
                $"Azure Maps geocoding failed with status {(int)response.StatusCode}.");
        }

        using var document = JsonDocument.Parse(payload);
        if (!document.RootElement.TryGetProperty("features", out var features))
        {
            return [];
        }

        var results = new List<LocationCandidate>();

        foreach (var feature in features.EnumerateArray())
        {
            if (!feature.TryGetProperty("geometry", out var geometry) ||
                !geometry.TryGetProperty("coordinates", out var coordinates) ||
                coordinates.GetArrayLength() < 2)
            {
                continue;
            }

            var longitude = coordinates[0].GetDouble();
            var latitude = coordinates[1].GetDouble();

            var properties = feature.GetProperty("properties");
            var address = properties.TryGetProperty("address", out var addressElement)
                ? addressElement
                : default;

            var formattedAddress =
                address.ValueKind == JsonValueKind.Object &&
                address.TryGetProperty("formattedAddress", out var formattedAddressElement)
                    ? formattedAddressElement.GetString() ?? query.Trim()
                    : query.Trim();

            var confidence =
                properties.TryGetProperty("confidence", out var confidenceElement)
                    ? confidenceElement.GetString() ?? "Unknown"
                    : "Unknown";

            if (confidence is not ("High" or "Medium" or "Low"))
            {
                confidence = "Unknown";
            }

            results.Add(new LocationCandidate(
                formattedAddress,
                formattedAddress,
                latitude,
                longitude,
                confidence));
        }

        return results;
    }

    public async Task<string> GetTimeZoneIdAsync(
        double latitude,
        double longitude,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();

        var lat = latitude.ToString(CultureInfo.InvariantCulture);
        var lon = longitude.ToString(CultureInfo.InvariantCulture);

        var requestUri =
            $"timezone/byCoordinates/json?api-version=1.0&query={lat},{lon}";

        using var request = CreateRequest(requestUri);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new AzureMapsException(
                $"Azure Maps timezone lookup failed with status {(int)response.StatusCode}.");
        }

        using var document = JsonDocument.Parse(payload);

        if (!document.RootElement.TryGetProperty("timeZones", out var timeZones) ||
            timeZones.GetArrayLength() == 0 ||
            !timeZones[0].TryGetProperty("id", out var idElement))
        {
            throw new AzureMapsException("Azure Maps did not return a time zone for this location.");
        }

        return idElement.GetString()
            ?? throw new AzureMapsException("Azure Maps returned an empty time zone identifier.");
    }

    private HttpRequestMessage CreateRequest(string requestUri)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        request.Headers.TryAddWithoutValidation("subscription-key", _subscriptionKey);
        return request;
    }

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_subscriptionKey))
        {
            throw new AzureMapsException("Azure Maps is not configured for this environment.");
        }
    }
}
