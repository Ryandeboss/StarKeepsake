using System.Text;
using System.Text.Json;

namespace StarKeepsake.Api;

/// <summary>
/// Text-prompted sky segmentation. Returns only a mask, never regenerated
/// buildings or tree pixels. Credentials are server-only and optional.
/// </summary>
public sealed class SkyMaskClient(HttpClient http, IConfiguration config)
{
    // Opt-in gate: adding a Fal key to the live API must NOT enable paid calls.
    public bool IsConfigured => config.GetValue<bool>("SkyMask:Enabled") &&
        !string.IsNullOrWhiteSpace(config["Fal:ApiKey"]);

    public async Task<byte[]> GetSkyMaskAsync(Stream image, string mimeType, CancellationToken token)
    {
        var key = config["Fal:ApiKey"];
        if (string.IsNullOrWhiteSpace(key))
            throw new SkyMaskUnavailableException("AI sky removal has not been configured on this server.");

        using var memory = new MemoryStream();
        await image.CopyToAsync(memory, token);
        var payload = JsonSerializer.Serialize(new
        {
            image_url = $"data:{mimeType};base64,{Convert.ToBase64String(memory.ToArray())}",
            prompt = "sky",
            apply_mask = false,
            sync_mode = true,
            output_format = "png",
            return_multiple_masks = false,
            max_masks = 1,
            include_scores = false,
        });

        using var request = new HttpRequestMessage(HttpMethod.Post,
            "https://fal.run/fal-ai/sam-3/image");
        request.Headers.TryAddWithoutValidation("Authorization", $"Key {key}");
        request.Headers.TryAddWithoutValidation("X-Fal-Store-IO", "0");
        request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
        if (!response.IsSuccessStatusCode)
        {
            // Do not return upstream response bodies: they can include
            // sensitive account information, URLs or internal provider data.
            var message = response.StatusCode switch
            {
                System.Net.HttpStatusCode.PaymentRequired =>
                    "Fal account has insufficient credits or requires billing setup.",
                System.Net.HttpStatusCode.Unauthorized =>
                    "Fal rejected the API key. Check the staging key and account.",
                System.Net.HttpStatusCode.Forbidden =>
                    "Fal denied the request. Check API key permissions and account billing.",
                System.Net.HttpStatusCode.TooManyRequests =>
                    "Fal is rate-limiting requests. Please retry later.",
                _ => "Fal could not process this image (HTTP " + (int)response.StatusCode + ")."
            };
            throw new SkyMaskUnavailableException(message);
        }

        await using var responseStream = await response.Content.ReadAsStreamAsync(token);
        using var json = await JsonDocument.ParseAsync(responseStream,
            new JsonDocumentOptions { MaxDepth = 12 }, token);

        var root = json.RootElement;
        if (!root.TryGetProperty("masks", out var masks) ||
            masks.ValueKind != JsonValueKind.Array || masks.GetArrayLength() == 0 ||
            !masks[0].TryGetProperty("url", out var urlElement))
            throw new SkyMaskUnavailableException("The AI service returned no sky mask.");

        // sync_mode returns an inline PNG. Do not follow URLs from third-party
        // model output: this keeps the proxy free of SSRF and remote fetches.
        var uri = urlElement.GetString() ?? "";
        const string prefix = "data:image/png;base64,";
        if (!uri.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            throw new SkyMaskUnavailableException("The AI service did not return an inline PNG mask.");
        if (uri.Length > 28_000_000)
            throw new SkyMaskUnavailableException("The sky mask was too large.");

        try
        {
            var png = Convert.FromBase64String(uri[prefix.Length..]);
            if (png.Length < 8 || !png.AsSpan(0, 8).SequenceEqual(
                    new byte[] {137,80,78,71,13,10,26,10}))
                throw new SkyMaskUnavailableException("The sky mask is not a valid PNG.");
            return png;
        }
        catch (FormatException)
        {
            throw new SkyMaskUnavailableException("The AI service returned a malformed PNG mask.");
        }
    }
}
public sealed class SkyMaskUnavailableException(string message) : Exception(message);
