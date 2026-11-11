using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using StarKeepsake.Api;

static void Check(bool value,string message)
{
    if(!value)throw new Exception("TEST FAILED: "+message);
    Console.WriteLine("PASS "+message);
}
using var mappings=JsonDocument.Parse("""
[{"sku":"LED-WARM","asin":"B001ABC123","pack_quantity":2,
  "max_unit_price_cents":3000,"enabled":true},
 {"sku":"NOT-ACTIVE","asin":"B002ABC123","pack_quantity":1,
  "max_unit_price_cents":5000,"enabled":false}]
""");
var linked=AmazonCatalogParser.ParseMappings(mappings.RootElement);
Check(linked.Length==1&&linked[0].Asin=="B001ABC123","disabled mappings excluded");
using var live=JsonDocument.Parse("""
{"matchingProductCount":1,"products":[{"asin":"B001ABC123","title":"Warm White Micro LED",
 "includedDataTypes":{"OFFERS":[{"offerId":"offer-example","merchant":{"name":"Amazon"},
 "availability":"In Stock.","productCondition":"NEW","buyingRestrictions":[],
 "price":{"value":{"amount":39.77,"currencyCode":"USD"}}}]}}],"notFoundAsins":[]}
""");
var date=DateTimeOffset.Parse("2026-11-11T16:00:00Z");
var snapshot=AmazonCatalogParser.Parse(live.RootElement,linked,date);
Check(snapshot.Quotes.Length==1 && snapshot.Quotes[0].PackPriceCents==3977,
    "documented OFFERS price parsed in cents");
Check(snapshot.Quotes[0].UnitPriceCents==1989&&snapshot.Quotes[0].WithinCap,
    "price per mapped part rounded up and compared to cap");
Check(snapshot.Quotes[0].Flags.Contains("PHYSICAL_PACK_SIZE_REQUIRES_REVIEW")&&
    snapshot.Quotes[0].Flags.Contains("SHIPPING_TAX_NOT_CONFIRMED"),
    "pack quantity and shipping remain unverified");
Check(!snapshot.CheckoutEnabled&&snapshot.Mode=="read_only","catalog never buys parts");
Check(snapshot.ExpiresAtUtc==date.AddMinutes(10),"quote freshness is ten minutes");

using var wrongCurrency=JsonDocument.Parse("""
{"products":[{"asin":"B001ABC123","includedDataTypes":{"OFFERS":[{"offerId":"offer-example",
 "price":{"value":{"amount":12.99,"currencyCode":"EUR"}}}]}}]}
""");
var wrong=AmazonCatalogParser.Parse(wrongCurrency.RootElement,linked,date);
Check(wrong.Quotes[0].PackPriceCents==null&&
    wrong.Quotes[0].Flags.Contains("CURRENCY_OR_PRICE_INVALID"),"non-USD fails closed");

using var restricted=JsonDocument.Parse("""
{"products":[{"asin":"B001ABC123","includedDataTypes":{"OFFERS":[{"offerId":"id",
 "availability":"Not in stock","buyingRestrictions":[{"type":"RESTRICTED"}],
 "productCondition":"USED","price":{"value":{"amount":70,"currencyCode":"USD"}}}]}}]}
""");
var risk=AmazonCatalogParser.Parse(restricted.RootElement,linked,date);
Check(risk.Quotes[0].Flags.Contains("BUYING_RESTRICTIONS_OR_UNKNOWN") &&
      risk.Quotes[0].Flags.Contains("STOCK_NOT_CONFIRMED") &&
      risk.Quotes[0].Flags.Contains("CONDITION_REVIEW") &&
      risk.Quotes[0].Flags.Contains("ABOVE_MAX_UNIT_PRICE"),
      "restricted, unavailable, used and over-cap offer all flagged");

using var missing=JsonDocument.Parse("""{"products":[],"notFoundAsins":["B001ABC123"]}""");
Check(AmazonCatalogParser.Parse(missing.RootElement,linked,date).Quotes[0].Flags
    .Contains("ASIN_NOT_FOUND"),"missing ASIN never creates a price");

var opts=new AmazonBusinessCatalogOptions{
 EnableCatalogReads=true,ClientId="test-client-id",ClientSecret="test-client-secret",
 RefreshToken="test-refresh-token",BuyerEmail="buyer@example.com"
};
Check(opts.IsConfigured,"test LWA credentials recognized");
var handler=new FixtureHandler();
var catalog=new AmazonBusinessCatalogClient(new FixtureFactory(handler),opts);
Check(catalog.Readiness().Configured,"diagnostics report configured without exposing tokens");
var quote=await catalog.Refresh(linked,CancellationToken.None);
Check(quote.Quotes[0].PackPriceCents==3977,"read-only HTTP catalog lookup accepted");
Check(handler.TokenRequests==1&&handler.CatalogRequests==1,
 "one token refresh and one product read");
var again=await catalog.Refresh(linked,CancellationToken.None);
Check(again.ObservedAtUtc==quote.ObservedAtUtc &&
      handler.TokenRequests==1&&handler.CatalogRequests==1,
      "cached quote prevents excess provider requests");
try{
    await catalog.Refresh([linked[0] with {MaxUnitPriceCents=2000}],CancellationToken.None);
    throw new Exception("refresh cooldown did not block changed quote request");
}catch(AmazonCatalogException e)when(e.Code=="CATALOG_REFRESH_COOLDOWN"){
    Console.WriteLine("PASS cooldown blocks rapid repeat provider reads");
}
var off=new AmazonBusinessCatalogClient(new FixtureFactory(handler),new AmazonBusinessCatalogOptions());
Check(!off.Readiness().Configured&&!off.Readiness().CheckoutEnabled,
    "unconfigured catalog is disabled, no checkout");
try{
    await off.Refresh(linked,CancellationToken.None);
    throw new Exception("Unconfigured client accessed network");
}catch(AmazonCatalogException e)when(e.Code=="CATALOG_NOT_CONFIGURED"){
    Console.WriteLine("PASS fail-closed without authorization");
}
Check(handler.CatalogRequests==1,"unconfigured refresh never reached provider");

sealed class FixtureFactory(FixtureHandler handler):IHttpClientFactory
{
    public HttpClient CreateClient(string name)
    {
        var uri=name=="AmazonBusinessLwa"?"https://api.amazon.com/":
            "https://na.business-api.amazon.com/";
        return new HttpClient(handler,disposeHandler:false){BaseAddress=new Uri(uri)};
    }
}
sealed class FixtureHandler:HttpMessageHandler
{
    public int TokenRequests;
    public int CatalogRequests;
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,CancellationToken cancellationToken)
    {
        var path=request.RequestUri?.AbsolutePath??"";
        if(path=="/auth/o2/token")
        {
            TokenRequests++;
            var form=await request.Content!.ReadAsStringAsync(cancellationToken);
            if(!form.Contains("grant_type=refresh_token",StringComparison.Ordinal))
                throw new Exception("Wrong token grant");
            return Reply("""
              {"access_token":"test-token-at-least-16chars",
                "expires_in":3600,"token_type":"bearer"}
              """);
        }
        if(path=="/products/2020-08-26/products/getProductsByAsins")
        {
            CatalogRequests++;
            if(!request.Headers.Contains("x-amz-access-token")||
               !request.Headers.Contains("x-amz-user-email"))
                throw new Exception("Missing required Amazon Business headers");
            var body=await request.Content!.ReadAsStringAsync(cancellationToken);
            if(!body.Contains("B001ABC123",StringComparison.Ordinal)||
               !body.Contains("\"OFFERS\"",StringComparison.Ordinal))
                throw new Exception("Request must contain mapped ASIN and OFFERS facet");
            return Reply("""
              {"products":[{"asin":"B001ABC123","title":"Warm White Micro LED",
                "includedDataTypes":{"OFFERS":[{"offerId":"offer-example",
                "merchant":{"name":"Amazon"},"availability":"In Stock.",
                "productCondition":"NEW","buyingRestrictions":[],
                "price":{"value":{"amount":39.77,"currencyCode":"USD"}}}]}}]}
              """);
        }
        throw new Exception("Unexpected outbound request: "+path);
    }
    private static HttpResponseMessage Reply(string json)=>new(HttpStatusCode.OK){
        Content=new StringContent(json,Encoding.UTF8,"application/json")
    };
}
