using System.Globalization;
using System.Net.Http.Json;
using System.Net;
using System.Net.Mail;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StarKeepsake.Api;

// M6.2: strictly READ-ONLY Amazon Business Product Search. No order endpoint,
// checkout/purchasing role, buyer payment method or customer-order data.
public sealed class AmazonBusinessCatalogOptions
{
    public bool EnableCatalogReads { get; set; }
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public string BuyerEmail { get; set; } = "";
    public string? GroupTag { get; set; }

    public bool IsConfigured =>
        EnableCatalogReads && ClientId.Length is >= 8 and <= 2048 &&
        ClientSecret.Length is >= 8 and <= 2048 &&
        RefreshToken.Length is >= 8 and <= 8192 &&
        BuyerEmail.Length is >= 5 and <= 254 &&
        MailAddress.TryCreate(BuyerEmail,out var email) && email.Address == BuyerEmail &&
        (string.IsNullOrEmpty(GroupTag) ||
          Regex.IsMatch(GroupTag,"^[a-zA-Z0-9_-]{1,100}$"));
}

public sealed record AmazonCatalogMapping(string Sku,string Asin,decimal PackQuantity,long? MaxUnitPriceCents);
public sealed record AmazonCatalogQuote(
    string Sku,string Asin,string? OfferId,string? ProductTitle,string? Merchant,
    long? PackPriceCents,long? UnitPriceCents,string Currency,
    string? Availability,string? Condition,bool WithinCap,
    string[] Flags);
public sealed record AmazonCatalogSnapshot(
    string Source,string Mode,bool CheckoutEnabled,DateTimeOffset ObservedAtUtc,
    DateTimeOffset ExpiresAtUtc,int MappedCount,AmazonCatalogQuote[] Quotes,
    string[] Notices);
public sealed record AmazonCatalogReadiness(
    bool Enabled,bool Configured,bool BuyerEmailConfigured,bool CatalogRoleConfirmed,
    bool CheckoutEnabled,string Region,string Mode,string[] MissingConfiguration);

public sealed class AmazonCatalogException(string code) : Exception(code)
{
    public string Code { get; } = code;
}

public static class AmazonCatalogParser
{
    private static JsonElement P(JsonElement x,string key)=>
        x.ValueKind==JsonValueKind.Object&&x.TryGetProperty(key,out var item)?item:default;
    private static string? S(JsonElement x,string key)=>
        P(x,key).ValueKind==JsonValueKind.String?P(x,key).GetString():null;
    private static string? SafeText(string? text,int max)=>
        string.IsNullOrWhiteSpace(text)?null:
        new string(text.Trim().Where(ch=>!char.IsControl(ch)).Take(max).ToArray());
    private static bool DecimalValue(JsonElement value,out decimal result)
    {
        result=0;
        if(value.ValueKind==JsonValueKind.Number)return value.TryGetDecimal(out result);
        return value.ValueKind==JsonValueKind.String &&
            decimal.TryParse(value.GetString(),NumberStyles.Number,
                CultureInfo.InvariantCulture,out result);
    }
    private static bool Money(JsonElement value,out long cents)
    {
        cents=0;
        var amt=P(value,"amount");
        if(amt.ValueKind!=JsonValueKind.Number||!amt.TryGetDecimal(out var n)||
            n<0||n>1000000||n!=decimal.Round(n,2))return false;
        cents=checked((long)(n*100m));
        return true;
    }
    public static AmazonCatalogMapping[] ParseMappings(JsonElement mappings)
    {
        if(mappings.ValueKind!=JsonValueKind.Array)throw new AmazonCatalogException("MAPPING_RESPONSE_INVALID");
        var candidates=new List<AmazonCatalogMapping>();
        foreach(var row in mappings.EnumerateArray())
        {
            if(P(row,"enabled").ValueKind!=JsonValueKind.True)continue;
            var sku=S(row,"sku")??"";var asin=S(row,"asin")??"";
            var qty=P(row,"pack_quantity");
            if(!MaterialValidation.ValidSku(sku)||
               !Regex.IsMatch(asin,"^[A-Z0-9]{10}$")||
               !DecimalValue(qty,out var pack)||pack<=0||pack>100000||
               pack!=decimal.Round(pack,3))
                throw new AmazonCatalogException("MAPPING_DATA_INVALID");
            var cap=P(row,"max_unit_price_cents");
            long? unitCap=null;
            if(cap.ValueKind==JsonValueKind.Number)
            {
                if(!cap.TryGetInt64(out var value)||value<1||value>100000000)
                    throw new AmazonCatalogException("MAPPING_DATA_INVALID");
                unitCap=value;
            }
            candidates.Add(new AmazonCatalogMapping(sku,asin,pack,unitCap));
        }
        if(candidates.Count>20||candidates.Select(x=>x.Sku).Distinct().Count()!=candidates.Count)
            throw new AmazonCatalogException("MAPPING_LIMIT_OR_DUPLICATE");
        return candidates.ToArray();
    }

    // Only the documented getProductsByAsins OFFERS facet is accepted.
    // No catalog price ever overwrites the owner-controlled M3 cost automatically.
    public static AmazonCatalogSnapshot Parse(
        JsonElement response,AmazonCatalogMapping[] mappings,DateTimeOffset observedAt)
    {
        var products=P(response,"products");
        if(products.ValueKind!=JsonValueKind.Array)
            throw new AmazonCatalogException("PROVIDER_RESPONSE_INVALID");
        var byAsin=new Dictionary<string,JsonElement>(StringComparer.Ordinal);
        foreach(var item in products.EnumerateArray())
        {
            var asin=S(item,"asin");
            if(asin is null||!Regex.IsMatch(asin,"^[A-Z0-9]{10}$")||
               !mappings.Any(x=>x.Asin==asin))continue;
            if(!byAsin.TryAdd(asin,item))
                throw new AmazonCatalogException("PROVIDER_RESPONSE_DUPLICATE_ASIN");
        }
        var quotes=new List<AmazonCatalogQuote>();
        foreach(var m in mappings)
        {
            var flags=new List<string>();
            string? id=null,merchant=null,title=null,availability=null,condition=null;
            long? price=null,unitPrice=null;
            var withinCap=false;
            if(!byAsin.TryGetValue(m.Asin,out var product))
            {
                flags.Add("ASIN_NOT_FOUND");
            }
            else
            {
                title=SafeText(S(product,"title"),150);
                var offers=P(P(product,"includedDataTypes"),"OFFERS");
                if(offers.ValueKind!=JsonValueKind.Array||offers.GetArrayLength()==0)
                    flags.Add("NO_FEATURED_OFFER");
                else
                {
                    // Amazon documents that bulk ASIN lookups return the featured offer.
                    // If unexpected multiple offers appear, fail closed instead of guessing.
                    if(offers.GetArrayLength()!=1)flags.Add("MULTIPLE_OFFERS_REVIEW");
                    var offer=offers[0];
                    id=SafeText(S(offer,"offerId"),160);
                    merchant=SafeText(S(P(offer,"merchant"),"name"),120);
                    availability=SafeText(S(offer,"availability"),120);
                    condition=SafeText(S(offer,"productCondition"),40);
                    if(id is null)flags.Add("OFFER_ID_MISSING");
                    var money=P(P(offer,"price"),"value");
                    var currency=S(money,"currencyCode");
                    if(currency!="USD"||!Money(money,out var cents))
                        flags.Add("CURRENCY_OR_PRICE_INVALID");
                    else
                    {
                        price=cents;
                        unitPrice=checked((long)decimal.Ceiling(cents/m.PackQuantity));
                        if(m.MaxUnitPriceCents.HasValue)
                        {
                            withinCap=unitPrice<=m.MaxUnitPriceCents.Value;
                            if(!withinCap)flags.Add("ABOVE_MAX_UNIT_PRICE");
                        }
                        else flags.Add("PRICE_CEILING_UNSET");
                    }
                    if(condition!="NEW")flags.Add("CONDITION_REVIEW");
                    if(availability is null||
                        !availability.Contains("In Stock",StringComparison.OrdinalIgnoreCase))
                        flags.Add("STOCK_NOT_CONFIRMED");
                    var restrictions=P(offer,"buyingRestrictions");
                    if(restrictions.ValueKind!=JsonValueKind.Array||
                       restrictions.GetArrayLength()!=0)
                        flags.Add("BUYING_RESTRICTIONS_OR_UNKNOWN");
                    // Manufacturer pack count is NOT independently verified by ASIN
                    // mapping. Amazon's quantity data reflects sellable ASIN units.
                    flags.Add("PHYSICAL_PACK_SIZE_REQUIRES_REVIEW");
                    flags.Add("SHIPPING_TAX_NOT_CONFIRMED");
                }
            }
            quotes.Add(new AmazonCatalogQuote(m.Sku,m.Asin,id,title,merchant,
                price,unitPrice,"USD",availability,condition,withinCap,flags.ToArray()));
        }
        return new AmazonCatalogSnapshot("amazon-business-product-search","read_only",false,
            observedAt,observedAt.AddMinutes(10),mappings.Length,quotes.ToArray(),
            ["Featured offers only; not a checkout quote.",
             "Shipping, tax, physical pack match and ordering permissions require review.",
             "No M3 inventory, BOM price, supplier order, or Etsy listing was changed."]);
    }
}

public sealed class AmazonBusinessCatalogClient(
    IHttpClientFactory clients,AmazonBusinessCatalogOptions options)
{
    private readonly SemaphoreSlim gate=new(1,1);
    private string? accessToken;
    private DateTimeOffset tokenExpires=DateTimeOffset.MinValue;
    private AmazonCatalogSnapshot? cached;
    private string? cachedKey;
    private DateTimeOffset lastAttempt=DateTimeOffset.MinValue;

    public AmazonCatalogReadiness Readiness()
    {
        var missing=new List<string>();
        if(!options.EnableCatalogReads)missing.Add("Catalog reads explicitly disabled");
        if(options.ClientId.Length<8)missing.Add("Client ID not configured");
        if(options.ClientSecret.Length<8)missing.Add("Client secret not configured");
        if(options.RefreshToken.Length<8)missing.Add("LWA refresh token not configured");
        if(!MailAddress.TryCreate(options.BuyerEmail,out var email)||
           email.Address!=options.BuyerEmail)missing.Add("Consented Amazon Business buyer email missing");
        return new AmazonCatalogReadiness(options.EnableCatalogReads,options.IsConfigured,
            !missing.Contains("Consented Amazon Business buyer email missing"),
            cached is not null&&cached.ExpiresAtUtc>DateTimeOffset.UtcNow,
            false,"US",options.IsConfigured?"ready_for_provider_validation":"setup_required",
            missing.ToArray());
    }

    private async Task<string> Token(CancellationToken ct)
    {
        if(accessToken is not null&&tokenExpires>DateTimeOffset.UtcNow.AddSeconds(90))
            return accessToken;
        using var request=new HttpRequestMessage(HttpMethod.Post,"auth/o2/token"){
            Content=new FormUrlEncodedContent(new Dictionary<string,string>{
                ["grant_type"]="refresh_token",["client_id"]=options.ClientId,
                ["client_secret"]=options.ClientSecret,["refresh_token"]=options.RefreshToken
            })};
        using var response=await clients.CreateClient("AmazonBusinessLwa").SendAsync(request,ct);
        if(!response.IsSuccessStatusCode)throw new AmazonCatalogException("LWA_TOKEN_REFRESH_DENIED");
        using var document=JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var payload=document.RootElement;
        if(!payload.TryGetProperty("access_token",out var token)||
           token.ValueKind!=JsonValueKind.String||token.GetString() is not string value||
           value.Length is <16 or >8192||
           !payload.TryGetProperty("expires_in",out var duration)||
           !duration.TryGetInt32(out var seconds)||seconds<=120||seconds>86400)
            throw new AmazonCatalogException("LWA_TOKEN_RESPONSE_INVALID");
        accessToken=value;
        tokenExpires=DateTimeOffset.UtcNow.AddSeconds(seconds);
        return value;
    }

    public async Task<AmazonCatalogSnapshot> Refresh(
        AmazonCatalogMapping[] mappings,CancellationToken ct)
    {
        if(!options.IsConfigured)throw new AmazonCatalogException("CATALOG_NOT_CONFIGURED");
        if(mappings.Length==0)throw new AmazonCatalogException("NO_ENABLED_ASIN_MAPPINGS");
        if(mappings.Length>20)throw new AmazonCatalogException("ASIN_LIMIT_EXCEEDED");
        var sorted=mappings.OrderBy(x=>x.Sku,StringComparer.Ordinal).ToArray();
        var key=string.Join("|",sorted.Select(m=>m.Sku+":"+m.Asin+":"+
            m.PackQuantity.ToString(CultureInfo.InvariantCulture)+":"+m.MaxUnitPriceCents));
        await gate.WaitAsync(ct);
        try
        {
            var now=DateTimeOffset.UtcNow;
            if(cachedKey==key&&cached is not null&&cached.ExpiresAtUtc>now)return cached;
            if(now-lastAttempt<TimeSpan.FromSeconds(120))
                throw new AmazonCatalogException("CATALOG_REFRESH_COOLDOWN");
            lastAttempt=now;
            var token=await Token(ct);
            var asin=sorted.Select(x=>x.Asin).Distinct(StringComparer.Ordinal).ToArray();
            using var request=new HttpRequestMessage(HttpMethod.Post,
                "products/2020-08-26/products/getProductsByAsins");
            request.Headers.TryAddWithoutValidation("x-amz-access-token",token);
            request.Headers.TryAddWithoutValidation("x-amz-user-email",options.BuyerEmail);
            if(!string.IsNullOrWhiteSpace(options.GroupTag))
                request.RequestUri=new Uri(request.RequestUri!.OriginalString+"?groupTag="+
                    Uri.EscapeDataString(options.GroupTag),UriKind.Relative);
            request.Content=JsonContent.Create(new {
                productIds=asin,productRegion="US",locale="en_US",facets=new[]{"OFFERS"}
            });
            using var response=await clients.CreateClient("AmazonBusinessProductSearch").SendAsync(request,ct);
            if(response.StatusCode==(HttpStatusCode)429)
                throw new AmazonCatalogException("PROVIDER_RATE_LIMITED");
            if(response.StatusCode==HttpStatusCode.Unauthorized||response.StatusCode==HttpStatusCode.Forbidden)
            {
                accessToken=null;
                throw new AmazonCatalogException("PRODUCT_CATALOG_ROLE_OR_AUTH_DENIED");
            }
            if(!response.IsSuccessStatusCode)
                throw new AmazonCatalogException("PROVIDER_LOOKUP_FAILED");
            await using var stream=await response.Content.ReadAsStreamAsync(ct);
            using var doc=await JsonDocument.ParseAsync(stream,cancellationToken:ct);
            cached=AmazonCatalogParser.Parse(doc.RootElement,sorted,now);
            cachedKey=key;
            return cached;
        }
        catch(JsonException){throw new AmazonCatalogException("PROVIDER_RESPONSE_INVALID");}
        catch(HttpRequestException){throw new AmazonCatalogException("PROVIDER_NETWORK_ERROR");}
        catch(TaskCanceledException)when(!ct.IsCancellationRequested)
        {throw new AmazonCatalogException("PROVIDER_TIMEOUT");}
        finally{gate.Release();}
    }
}
