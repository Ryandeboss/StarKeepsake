using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Azure;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace StarKeepsake.Api;

// Seller-only Etsy OAuth. Nothing in this file is intended for customer-facing authorization.
public sealed class EtsyConnectionOptions
{
    public string Keystring { get; set; } = "";
    public string SharedSecret { get; set; } = "";
    public string RedirectUri { get; set; } = "";
    public string ExpectedShopName { get; set; } = "";
    public string AdminSetupKey { get; set; } = "";
    public string StateSigningKey { get; set; } = "";
    public string KeyVaultUri { get; set; } = "";
    public string ManagedIdentityClientId { get; set; } = "";
    public string TokenSecretName { get; set; } = "starkeepsake-etsy-connection";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Keystring) &&
        !string.IsNullOrWhiteSpace(SharedSecret) &&
        Uri.TryCreate(RedirectUri, UriKind.Absolute, out var redirect) &&
        redirect.Scheme == Uri.UriSchemeHttps &&
        redirect.AbsolutePath == "/api/admin/etsy/callback" &&
        !string.IsNullOrWhiteSpace(ExpectedShopName) &&
        AdminSetupKey.Length >= 32 &&
        StateSigningKey.Length >= 32 &&
        Uri.TryCreate(KeyVaultUri, UriKind.Absolute, out var vault) &&
        vault.Scheme == Uri.UriSchemeHttps &&
        !string.IsNullOrWhiteSpace(TokenSecretName);
}

public sealed record EtsyStoredConnection(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset ExpiresAtUtc,
    long UserId,
    long ShopId,
    string ShopName,
    string Scope);

public static class EtsyOAuthProtocol
{
    public const string Scopes = "shops_r listings_r transactions_r";
    public const string StateCookieName = "__Host-StarkeepsakeEtsyState";
    private static readonly TimeSpan StateTtl = TimeSpan.FromMinutes(10);

    public static string NewState(string signingKey, DateTimeOffset now)
    {
        var nonce = Base64Url(RandomNumberGenerator.GetBytes(32));
        var payload = nonce + "." + now.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        return payload + "." + Sign(signingKey, "etsy-state-v1|" + payload);
    }

    public static bool ValidState(string? state, string signingKey, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(state) || state.Length > 256) return false;
        var parts = state.Split('.');
        if (parts.Length != 3 || parts[0].Length != 43 ||
            !long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var timestamp))
            return false;
        if (timestamp > now.ToUnixTimeSeconds() + 60 ||
            timestamp < now.Subtract(StateTtl).ToUnixTimeSeconds()) return false;
        var payload = parts[0] + "." + parts[1];
        return SecureEquals(parts[2], Sign(signingKey, "etsy-state-v1|" + payload));
    }

    // Deterministically derive a different secret for PKCE from the signed state nonce.
    // The verifier is not sent to the browser; any API replica can reconstruct it.
    public static string Verifier(string signingKey, string state) =>
        Sign(signingKey, "etsy-pkce-v1|" + state.Split('.')[0]);

    public static string Challenge(string verifier) =>
        Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));

    public static string AuthorizeUrl(EtsyConnectionOptions options, string state)
    {
        var parameters = new Dictionary<string, string>
        {
            ["response_type"] = "code",
            ["client_id"] = options.Keystring,
            ["redirect_uri"] = options.RedirectUri,
            ["scope"] = Scopes,
            ["state"] = state,
            ["code_challenge"] = Challenge(Verifier(options.StateSigningKey, state)),
            ["code_challenge_method"] = "S256"
        };
        return "https://www.etsy.com/oauth/connect?" +
               string.Join("&", parameters.Select(p =>
                   Uri.EscapeDataString(p.Key) + "=" + Uri.EscapeDataString(p.Value)));
    }

    public static bool SecureEquals(string a, string b)
    {
        var aBytes = Encoding.UTF8.GetBytes(a);
        var bBytes = Encoding.UTF8.GetBytes(b);
        return aBytes.Length == bBytes.Length &&
               CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }

    private static string Sign(string signingKey, string message) =>
        Base64Url(HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey),
            Encoding.UTF8.GetBytes(message)));

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public sealed class EtsyApiClient(HttpClient client)
{
    public async Task<EtsyStoredConnection> ExchangeCodeAsync(
        EtsyConnectionOptions options, string code, string verifier, CancellationToken ct)
    {
        var values = new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["client_id"] = options.Keystring,
            ["redirect_uri"] = options.RedirectUri,
            ["code"] = code,
            ["code_verifier"] = verifier
        };
        return await RequestTokenAsync(options, values, ct);
    }

    public async Task<EtsyStoredConnection> RefreshAsync(
        EtsyConnectionOptions options, EtsyStoredConnection existing, CancellationToken ct)
    {
        var values = new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["client_id"] = options.Keystring,
            ["refresh_token"] = existing.RefreshToken
        };
        var refreshed = await RequestTokenAsync(options, values, ct);
        if (refreshed.UserId != existing.UserId)
            throw new InvalidOperationException("Etsy token owner changed during refresh.");
        return refreshed with { ShopId = existing.ShopId, ShopName = existing.ShopName };
    }

    public async Task<(long ShopId, long UserId, string ShopName)> GetOwnedShopAsync(
        EtsyConnectionOptions options, EtsyStoredConnection token, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get,
            "v3/application/users/" + token.UserId.ToString(CultureInfo.InvariantCulture) + "/shops");
        request.Headers.TryAddWithoutValidation("x-api-key", options.Keystring + ":" + options.SharedSecret);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("Could not verify the Etsy shop owner.");

        using var document = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var shop = document.RootElement;
        return (shop.GetProperty("shop_id").GetInt64(),
            shop.GetProperty("user_id").GetInt64(),
            shop.GetProperty("shop_name").GetString() ?? "");
    }

    private async Task<EtsyStoredConnection> RequestTokenAsync(
        EtsyConnectionOptions options, IDictionary<string, string> values, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "v3/public/oauth/token");
        request.Headers.TryAddWithoutValidation("x-api-key", options.Keystring + ":" + options.SharedSecret);
        request.Content = new FormUrlEncodedContent(values);
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("Etsy rejected the token request.");

        using var document = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var token = document.RootElement;
        var access = token.GetProperty("access_token").GetString() ?? "";
        var refresh = token.GetProperty("refresh_token").GetString() ?? "";
        var scopes = token.GetProperty("scope").GetString() ?? "";
        var granted = scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (string.IsNullOrWhiteSpace(access) || string.IsNullOrWhiteSpace(refresh) ||
            !EtsyOAuthProtocol.Scopes.Split(' ').All(s => granted.Contains(s, StringComparer.Ordinal)))
            throw new InvalidOperationException("Etsy did not grant the required read scopes.");

        var prefix = access.Split('.', 2)[0];
        if (!long.TryParse(prefix, NumberStyles.None, CultureInfo.InvariantCulture, out var userId) ||
            userId < 1)
            throw new InvalidOperationException("Etsy returned an invalid token owner.");

        var expiresIn = token.GetProperty("expires_in").GetInt32();
        if (expiresIn < 1)
            throw new InvalidOperationException("Etsy returned an expired token.");

        return new EtsyStoredConnection(
            access, refresh, DateTimeOffset.UtcNow.AddSeconds(expiresIn),
            userId, 0, "", scopes);
    }
}

// Key Vault provides durable storage across Azure Container Apps replicas and restarts.
// No token, refresh secret, or Etsy shared secret is returned to a browser.
public sealed class EtsyTokenVault(EtsyConnectionOptions options)
{
    private SecretClient Client => new(
        new Uri(options.KeyVaultUri),
        new DefaultAzureCredential(new DefaultAzureCredentialOptions
        {
            ManagedIdentityClientId = string.IsNullOrWhiteSpace(options.ManagedIdentityClientId)
                ? null : options.ManagedIdentityClientId
        }));

    public async Task<EtsyStoredConnection?> LoadAsync(CancellationToken ct)
    {
        try
        {
            var result = await Client.GetSecretAsync(options.TokenSecretName, cancellationToken: ct);
            return JsonSerializer.Deserialize<EtsyStoredConnection>(result.Value.Value);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async Task SaveAsync(EtsyStoredConnection connection, CancellationToken ct)
    {
        await Client.SetSecretAsync(options.TokenSecretName,
            JsonSerializer.Serialize(connection), ct);
    }
}

public sealed class EtsyTokenProvider(
    EtsyConnectionOptions options, EtsyTokenVault vault, EtsyApiClient etsy)
{
    private static readonly SemaphoreSlim RefreshGate = new(1, 1);

    public async Task<EtsyStoredConnection?> GetValidAsync(CancellationToken ct)
    {
        var current = await vault.LoadAsync(ct);
        if (current is null || current.ExpiresAtUtc > DateTimeOffset.UtcNow.AddMinutes(5))
            return current;

        await RefreshGate.WaitAsync(ct);
        try
        {
            current = await vault.LoadAsync(ct);
            if (current is null || current.ExpiresAtUtc > DateTimeOffset.UtcNow.AddMinutes(5))
                return current;
            var updated = await etsy.RefreshAsync(options, current, ct);
            await vault.SaveAsync(updated, ct);
            return updated;
        }
        finally
        {
            RefreshGate.Release();
        }
    }
}

public static class EtsyConnectionEndpoints
{
    private const string CallbackPath = "/api/admin/etsy/callback";

    public static void MapEtsyConnectionEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/admin/etsy/connect", (HttpContext context, EtsyConnectionOptions settings) =>
        {
            Harden(context);
            if (!settings.IsConfigured) return Results.StatusCode(503);
            const string page = """
                <!doctype html><html lang="en"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>Connect StarKeepsake to Etsy</title></head>
                <body style="max-width:34rem;margin:5rem auto;padding:1rem;font:16px system-ui;background:#101b2b;color:#fff">
                <h1>Connect your Etsy shop</h1>
                <p>Owner-only setup. Enter the StarKeepsake admin setup key, not your Etsy Shared Secret.</p>
                <form method="post" action="/api/admin/etsy/connect/start">
                <label>Admin setup key <input type="password" name="adminKey" required
                autocomplete="off" style="width:100%;padding:.8rem;margin:.8rem 0"></label>
                <button type="submit" style="padding:.8rem">Authorize with Etsy</button></form>
                <p>No payments or listings will be changed.</p></body></html>
                """;
            return Results.Content(page, "text/html", Encoding.UTF8);
        }).RequireRateLimiting("etsy-admin");

        app.MapPost("/api/admin/etsy/connect/start", async (
            HttpContext context, EtsyConnectionOptions settings) =>
        {
            Harden(context);
            if (!settings.IsConfigured) { context.Response.StatusCode = 503; return; }
            if (!context.Request.HasFormContentType ||
                context.Request.ContentLength > 4096)
            {
                context.Response.StatusCode = 400;
                return;
            }
            var form = await context.Request.ReadFormAsync(context.RequestAborted);
            if (!form.TryGetValue("adminKey", out var value) || value.Count != 1 ||
                !EtsyOAuthProtocol.SecureEquals(value.ToString(), settings.AdminSetupKey))
            {
                context.Response.StatusCode = 401;
                return;
            }
            var state = EtsyOAuthProtocol.NewState(settings.StateSigningKey, DateTimeOffset.UtcNow);
            context.Response.Cookies.Append(EtsyOAuthProtocol.StateCookieName, state, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                MaxAge = TimeSpan.FromMinutes(10),
                IsEssential = true
            });
            context.Response.StatusCode = StatusCodes.Status303SeeOther;
            context.Response.Headers.Location = EtsyOAuthProtocol.AuthorizeUrl(settings, state);
        }).RequireRateLimiting("etsy-admin");

        app.MapGet(CallbackPath, async (
            HttpContext context,
            EtsyConnectionOptions settings,
            EtsyApiClient etsy,
            EtsyTokenVault vault) =>
        {
            Harden(context);
            if (!settings.IsConfigured) return Results.StatusCode(503);
            var state = context.Request.Query["state"].ToString();
            var cookie = context.Request.Cookies[EtsyOAuthProtocol.StateCookieName];
            context.Response.Cookies.Delete(EtsyOAuthProtocol.StateCookieName,
                new CookieOptions { Secure = true, HttpOnly = true, SameSite = SameSiteMode.Lax,
                    Path = "/" });

            if (string.IsNullOrWhiteSpace(cookie) ||
                !EtsyOAuthProtocol.SecureEquals(cookie, state) ||
                !EtsyOAuthProtocol.ValidState(state, settings.StateSigningKey, DateTimeOffset.UtcNow))
                return Results.BadRequest("Invalid or expired Etsy authorization request.");

            if (context.Request.Query.ContainsKey("error"))
                return Results.BadRequest("Etsy authorization was declined.");

            var code = context.Request.Query["code"].ToString();
            if (string.IsNullOrWhiteSpace(code) || code.Length > 2048)
                return Results.BadRequest("Missing Etsy authorization code.");

            try
            {
                var connection = await etsy.ExchangeCodeAsync(settings, code,
                    EtsyOAuthProtocol.Verifier(settings.StateSigningKey, state),
                    context.RequestAborted);
                var shop = await etsy.GetOwnedShopAsync(settings, connection, context.RequestAborted);
                if (shop.UserId != connection.UserId || shop.ShopId < 1 ||
                    !string.Equals(shop.ShopName, settings.ExpectedShopName,
                        StringComparison.OrdinalIgnoreCase))
                    return Results.BadRequest("Authorized account does not own the expected Etsy shop.");

                await vault.SaveAsync(connection with
                {
                    ShopId = shop.ShopId,
                    ShopName = shop.ShopName
                }, context.RequestAborted);

                return Results.Content(
                    "<!doctype html><html><body><h1>Etsy connected</h1><p>Your shop was verified. You can close this window.</p></body></html>",
                    "text/html", Encoding.UTF8);
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or
                InvalidOperationException or RequestFailedException or Azure.Identity.AuthenticationFailedException)
            {
                // Deliberately never log or reflect authorization codes, bearer tokens or secret values.
                return Results.Problem("Etsy connection failed. Check API and Key Vault configuration.",
                    statusCode: 502);
            }
        }).RequireRateLimiting("etsy-admin");

        app.MapGet("/api/admin/etsy/status", async (
            HttpContext context,
            EtsyConnectionOptions settings,
            EtsyTokenProvider tokens,
            EtsyApiClient etsy) =>
        {
            Harden(context);
            if (!settings.IsConfigured) return Results.StatusCode(503);
            if (!context.Request.Headers.TryGetValue("X-Starkeepsake-Admin-Key", out var value) ||
                value.Count != 1 ||
                !EtsyOAuthProtocol.SecureEquals(value.ToString(), settings.AdminSetupKey))
                return Results.Unauthorized();

            try
            {
                var token = await tokens.GetValidAsync(context.RequestAborted);
                if (token is null)
                    return Results.Ok(new { connected = false });

                var shop = await etsy.GetOwnedShopAsync(settings, token, context.RequestAborted);
                if (shop.ShopId != token.ShopId || shop.UserId != token.UserId ||
                    !string.Equals(shop.ShopName, settings.ExpectedShopName,
                        StringComparison.OrdinalIgnoreCase))
                    return Results.Problem("Etsy shop verification failed.", statusCode: 409);

                return Results.Ok(new { connected = true, shopName = shop.ShopName,
                    shopId = shop.ShopId, tokenExpiresAtUtc = token.ExpiresAtUtc });
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or
                InvalidOperationException or RequestFailedException or Azure.Identity.AuthenticationFailedException)
            {
                return Results.Problem("Unable to verify Etsy status.", statusCode: 502);
            }
        }).RequireRateLimiting("etsy-admin");
    }

    private static void Harden(HttpContext context)
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["Content-Security-Policy"] =
            "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
    }
}
