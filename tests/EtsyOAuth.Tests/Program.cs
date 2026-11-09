using System.Net;
using System.Net.Http;
using System.Text;
using StarKeepsake.Api;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception("FAIL: " + message);
    Console.WriteLine("PASS: " + message);
}

static async Task ExpectFailure(Func<Task> action, string label)
{
    try { await action(); }
    catch (InvalidOperationException) { Console.WriteLine("PASS: " + label); return; }
    throw new Exception("FAIL: " + label);
}

var secret = new string('S', 44);
var now = new DateTimeOffset(2026, 11, 9, 15, 0, 0, TimeSpan.Zero);
var state = EtsyOAuthProtocol.NewState(secret, now);
Check(EtsyOAuthProtocol.ValidState(state, secret, now), "valid signed OAuth state");
Check(!EtsyOAuthProtocol.ValidState(state, "different key", now), "state rejects different key");
Check(!EtsyOAuthProtocol.ValidState(state + "X", secret, now), "state rejects signature tampering");
Check(!EtsyOAuthProtocol.ValidState(state, secret, now.AddMinutes(11)), "state expires");
Check(!EtsyOAuthProtocol.ValidState(state, secret, now.AddMinutes(-2)), "future state rejected");
Check(!EtsyOAuthProtocol.ValidState("invalid", secret, now), "malformed state rejected");
var verifier = EtsyOAuthProtocol.Verifier(secret, state);
Check(verifier.Length == 43, "PKCE verifier is 43 characters");
Check(EtsyOAuthProtocol.Challenge(verifier).Length == 43, "SHA-256 challenge has PKCE format");
Check(EtsyOAuthProtocol.SecureEquals("abc", "abc") &&
      !EtsyOAuthProtocol.SecureEquals("abc", "abx"), "fixed-time comparison");

var options = new EtsyConnectionOptions
{
    Keystring = "test-keystring",
    SharedSecret = "test-shared-secret",
    RedirectUri = "https://api.example.test/api/admin/etsy/callback",
    ExpectedShopName = "ApexCraftedUS",
    AdminSetupKey = new string('A', 40),
    StateSigningKey = secret,
    StorageConnectionString = "UseDevelopmentStorage=true",
    StorageContainerName = "starkeepsake-private",
    TokenBlobName = "integrations/etsy/connection.json"
};
Check(options.IsConfigured, "configuration validation accepts Container Apps secret and private blob settings");
options.StorageConnectionString = "";
Check(!options.IsConfigured, "missing durable token storage fails closed");
options.StorageConnectionString = "UseDevelopmentStorage=true";
var url = EtsyOAuthProtocol.AuthorizeUrl(options, state);
Check(url.StartsWith("https://www.etsy.com/oauth/connect?") &&
      url.Contains("code_challenge_method=S256") &&
      url.Contains("scope=shops_r%20listings_r%20transactions_r") &&
      url.Contains("redirect_uri=https%3A%2F%2Fapi.example.test%2Fapi%2Fadmin%2Fetsy%2Fcallback"),
      "authorization URL has Etsy endpoint, scopes, PKCE and exact redirect");
Check(!url.Contains(options.SharedSecret) && !url.Contains(verifier),
      "no shared secret or PKCE verifier in authorization URL");
Check(EtsyConnectionEndpoints.ConnectionContentSecurityPolicy.Contains(
    "form-action 'self' https://www.etsy.com", StringComparison.Ordinal),
    "browser CSP permits Etsy OAuth redirect after local form POST");
Check(!EtsyConnectionEndpoints.ConnectionContentSecurityPolicy.Contains(
    "form-action *", StringComparison.Ordinal),
    "browser CSP does not permit arbitrary form navigation");
options.RedirectUri = "http://insecure.example/api/admin/etsy/callback";
Check(!options.IsConfigured, "insecure redirect URI rejected");
options.RedirectUri = "https://api.example.test/api/admin/etsy/callback";

var requests = new List<(string Path, string Method, string? ApiKey, string? Auth, string? Body)>();
var handler = new FakeHandler(async message =>
{
    var body = message.Content is null ? null : await message.Content.ReadAsStringAsync();
    requests.Add((
        message.RequestUri?.AbsolutePath ?? "",
        message.Method.Method,
        message.Headers.TryGetValues("x-api-key", out var values) ? values.Single() : null,
        message.Headers.Authorization?.ToString(), body));
    var result = message.RequestUri?.AbsolutePath == "/v3/public/oauth/token"
        ? """{"access_token":"12345.fake-access","refresh_token":"12345.fake-refresh","expires_in":3600,"scope":"shops_r listings_r transactions_r","token_type":"Bearer"}"""
        : """{"shop_id":98765,"user_id":12345,"shop_name":"ApexCraftedUS"}""";
    return new HttpResponseMessage(HttpStatusCode.OK)
    {
        Content = new StringContent(result, Encoding.UTF8, "application/json")
    };
});
var etsy = new EtsyApiClient(new HttpClient(handler) { BaseAddress = new Uri("https://api.etsy.com/") });
var tokens = await etsy.ExchangeCodeAsync(options, "test-code", verifier, CancellationToken.None);
Check(tokens.UserId == 12345 && tokens.Scope == EtsyOAuthProtocol.Scopes, "token response parsed");
Check(requests[0].Path == "/v3/public/oauth/token" &&
      requests[0].ApiKey == "test-keystring:test-shared-secret" &&
      requests[0].Body!.Contains("grant_type=authorization_code") &&
      requests[0].Body!.Contains("code_verifier="), "correct token request fields and API header");
var shop = await etsy.GetOwnedShopAsync(options, tokens, CancellationToken.None);
Check(shop.ShopId == 98765 && shop.UserId == 12345 &&
      shop.ShopName == "ApexCraftedUS", "shop verification parses expected owner");
Check(requests[1].Auth == "Bearer 12345.fake-access" &&
      requests[1].ApiKey == "test-keystring:test-shared-secret",
      "authenticated shop request carries scoped token and API key");
var refreshed = await etsy.RefreshAsync(options, tokens, CancellationToken.None);
Check(refreshed.UserId == tokens.UserId &&
      requests[2].Body!.Contains("grant_type=refresh_token"), "refresh grant supported");
await ExpectFailure(async () =>
{
    var bad = new EtsyApiClient(new HttpClient(new FakeHandler(_ =>
        Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) {
            Content = new StringContent(
                """{"access_token":"12345.token","refresh_token":"12345.refresh","expires_in":3600,"scope":"shops_r"}""")
        }))) { BaseAddress = new Uri("https://api.etsy.com/") });
    await bad.ExchangeCodeAsync(options, "code", verifier, CancellationToken.None);
}, "missing required scopes fail closed");

Console.WriteLine("All Etsy OAuth contract tests passed.");

sealed class FakeHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> responder)
    : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken) => responder(request);
}
