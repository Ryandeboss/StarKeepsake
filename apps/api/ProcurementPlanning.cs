using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StarKeepsake.Api;

// Read-only procurement simulation. No Amazon Business network client or checkout method.
public sealed record AmazonMappingDraft(string Sku,string Asin,decimal PackQuantity,
    long? MaxUnitPriceCents,bool Enabled);
public static class AmazonMappingValidation
{
    private static readonly Regex Asin=new("^[A-Z0-9]{10}$",RegexOptions.Compiled);
    public static bool Valid(AmazonMappingDraft? m) =>
        m is not null && MaterialValidation.ValidSku(m.Sku) &&
        Asin.IsMatch(m.Asin??"") && m.PackQuantity is >0 and <=100000 &&
        m.PackQuantity==decimal.Round(m.PackQuantity,3) &&
        (m.MaxUnitPriceCents is null or >=1 and <=100000000);
}
public sealed record ProcurementNeed(string Sku,string Name,string Unit,decimal Required,
    decimal OnHand,decimal OnOrder,decimal Shortfall,decimal NetToOrder,
    string? Asin,decimal? PackQuantity,int? PacksToBuy,
    long? CatalogUnitCostCents,long? EstimatedPurchaseCents,string[] Blocks);
public sealed record ProcurementPreview(string Mode,bool CheckoutEnabled,bool OffersVerified,
    bool SnapshotComplete,int ActivePaidJobs,int CatalogItems,long? EstimatedMaterialsCents,
    ProcurementNeed[] Lines,string[] Warnings);

public static class ProcurementPlanner
{
    private static JsonElement P(JsonElement j,string k)=>
        j.ValueKind==JsonValueKind.Object && j.TryGetProperty(k,out var x)?x:default;
    private static JsonElement[] A(JsonElement j)=>
        j.ValueKind==JsonValueKind.Array?j.EnumerateArray().ToArray():[];
    private static string S(JsonElement j,string k)=>
        P(j,k).ValueKind==JsonValueKind.String?P(j,k).GetString()??"":"";
    private static bool B(JsonElement j,string k)=>P(j,k).ValueKind==JsonValueKind.True;
    private static decimal D(JsonElement j,string k)
    {
        var v=P(j,k);
        if(v.ValueKind==JsonValueKind.Number&&v.TryGetDecimal(out var n))return n;
        if(v.ValueKind==JsonValueKind.String&&decimal.TryParse(v.GetString(),
            NumberStyles.Number,CultureInfo.InvariantCulture,out n))return n;
        return 0;
    }
    private static long? C(JsonElement j,string k)
    {
        var v=P(j,k);
        return v.ValueKind==JsonValueKind.Number&&v.TryGetInt64(out var n)&&n>=0?n:null;
    }
    private static string K(JsonElement j)=>D(j,"shop_id")+":"+D(j,"receipt_id")+":"+D(j,"transaction_id");
    private static string R(JsonElement j)=>D(j,"shop_id")+":"+D(j,"receipt_id");

    public static ProcurementPreview Build(JsonElement snapshot,JsonElement linkData)
    {
        var parts=A(P(snapshot,"parts"));var jobs=A(P(snapshot,"jobs"));
        var plans=A(P(snapshot,"plans"));var lines=A(P(snapshot,"lines"));
        var receipts=A(P(snapshot,"receipts"));var purchases=A(P(snapshot,"purchases"));
        var links=A(linkData).ToDictionary(m=>S(m,"sku"),StringComparer.Ordinal);
        var paid=receipts.Where(r=>B(r,"is_paid")&&!B(r,"is_canceled")&&
            !B(r,"has_refunds")&&(S(r,"etsy_status") is "paid" or "completed"))
            .Select(R).ToHashSet();
        var active=jobs.Where(j=>(S(j,"status") is "awaiting_review" or "in_progress")&&
            paid.Contains(R(j))).Select(K).ToHashSet();
        var planned=plans.Where(p=>(S(p,"status") is "draft" or "reviewed")&&
            active.Contains(K(p))).Select(K).ToHashSet();
        var required=new Dictionary<string,decimal>(StringComparer.Ordinal);
        foreach(var l in lines.Where(l=>planned.Contains(K(l))))
            required[S(l,"sku")]=required.GetValueOrDefault(S(l,"sku"))+D(l,"quantity_required");
        var complete=parts.Length<300&&jobs.Length<300&&plans.Length<300&&
            lines.Length<1000&&receipts.Length<300&&purchases.Length<300;
        var outLines=new List<ProcurementNeed>();
        foreach(var part in parts)
        {
            var sku=S(part,"sku");var needed=required.GetValueOrDefault(sku);
            if(needed<=0)continue;
            var onHand=Math.Max(0,D(part,"on_hand"));
            var incoming=purchases.Where(x=>S(x,"sku")==sku&&
                (S(x,"status") is "ordered" or "partially_received"))
                .Sum(x=>Math.Max(0,D(x,"quantity_ordered")-D(x,"quantity_received")));
            var shortBy=Math.Max(0,needed-onHand);
            if(shortBy==0)continue;
            var net=Math.Max(0,shortBy-incoming);
            var map=links.GetValueOrDefault(sku);
            var activeMap=B(map,"enabled");
            var pack=activeMap?D(map,"pack_quantity"):0;
            var cap=activeMap?C(map,"max_unit_price_cents"):null;
            var cost=C(part,"unit_cost_cents");
            var packs=pack>0&&net>0?decimal.Ceiling(net/pack):0;
            var blocked=new List<string>();
            if(!complete)blocked.Add("INCOMPLETE_PAGINATION");
            if(!activeMap)blocked.Add("UNMAPPED_ASIN");
            if(pack<=0)blocked.Add("PACK_SIZE_MISSING");
            if(cost is null)blocked.Add("CATALOG_COST_MISSING");
            if(cap is null)blocked.Add("MAX_PRICE_NOT_SET");
            if(cap.HasValue&&cost.HasValue&&cost>cap)blocked.Add("CATALOG_ABOVE_CAP");
            blocked.Add("LIVE_AMAZON_OFFER_UNVERIFIED");
            blocked.Add("BUYING_ACCOUNT_NOT_AUTHORIZED");
            blocked.Add("SPENDING_APPROVAL_NOT_CONFIGURED");
            long? estimate=null;
            if(cost.HasValue&&packs>0&&packs<=10000&&pack>0)
            {
                var amount=decimal.Ceiling(packs*pack*cost.Value);
                if(amount<=long.MaxValue)estimate=(long)amount;
            }
            outLines.Add(new ProcurementNeed(sku,S(part,"name"),S(part,"unit"),
                needed,onHand,incoming,shortBy,net,activeMap?S(map,"asin"):null,
                pack>0?pack:null,packs>0&&packs<=10000?(int)packs:null,
                cost,estimate,blocked.ToArray()));
        }
        var missing=required.Keys.Except(parts.Select(p=>S(p,"sku"))).Any();
        var warnings=new List<string>{
            "Simulation only: no Amazon connection, checkout or payment.",
            "Catalog prices are manually entered, not real-time Amazon offers.",
            "Reconcile open supplier orders before buying parts."
        };
        if(missing||!complete)warnings.Add("Incomplete source snapshot; never purchase from this result.");
        if(planned.Count==0)warnings.Add("No eligible paid Etsy job with an M3 bill of materials.");
        return new ProcurementPreview("simulation",false,false,complete&&!missing,
            planned.Count,parts.Length,
            outLines.All(x=>x.EstimatedPurchaseCents.HasValue||x.NetToOrder==0)
                ? outLines.Sum(x=>x.EstimatedPurchaseCents??0):null,
            outLines.OrderBy(x=>x.Sku,StringComparer.Ordinal).ToArray(),warnings.ToArray());
    }
}

public sealed class ProcurementRepository(HttpClient client,DesignPersistenceOptions opts)
{
    private async Task<JsonElement> Request(HttpMethod method,string path,object? body,CancellationToken ct)
    {
        using var req=new HttpRequestMessage(method,
            new Uri(new Uri(opts.ProjectUrl.TrimEnd('/')+"/"),"rest/v1/"+path));
        req.Headers.TryAddWithoutValidation("apikey",opts.SecretKey);
        if(opts.SecretKey.StartsWith("eyJ",StringComparison.Ordinal))
            req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",opts.SecretKey);
        if(body is not null)req.Content=new StringContent(JsonSerializer.Serialize(body),
            Encoding.UTF8,"application/json");
        using var response=await client.SendAsync(req,ct);
        if(!response.IsSuccessStatusCode)throw new HttpRequestException("M6 database error",null,response.StatusCode);
        await using var stream=await response.Content.ReadAsStreamAsync(ct);
        using var doc=await JsonDocument.ParseAsync(stream,cancellationToken:ct);
        return doc.RootElement.Clone();
    }
    public Task<JsonElement> Mappings(CancellationToken ct)=>Request(HttpMethod.Get,
        "m6_amazon_mappings?select=sku,asin,pack_quantity,max_unit_price_cents,enabled&order=sku.asc&limit=300",null,ct);
    public Task<JsonElement> Save(AmazonMappingDraft x,CancellationToken ct)=>Request(HttpMethod.Post,
        "rpc/m6_save_amazon_mapping",new{p_sku=x.Sku,p_asin=x.Asin,
            p_pack_quantity=x.PackQuantity,p_max_unit_price_cents=x.MaxUnitPriceCents,
            p_enabled=x.Enabled},ct);
}

public static class ProcurementEndpoints
{
    private static bool Allowed(HttpContext ctx,EtsyConnectionOptions opts)=>
        opts.AdminSetupKey.Length>=32&&
        ctx.Request.Headers.TryGetValue("X-Starkeepsake-Admin-Key",out var key)&&
        key.Count==1&&EtsyOAuthProtocol.SecureEquals(key.ToString(),opts.AdminSetupKey);
    private static void Harden(HttpContext ctx)
    {
        ctx.Response.Headers.CacheControl="no-store";
        ctx.Response.Headers["X-Content-Type-Options"]="nosniff";
    }
    public static void MapProcurementEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/admin/procurement/preview",async (HttpContext ctx,
          EtsyConnectionOptions auth,DesignPersistenceOptions opts,
          EtsyProductionClient etsy,MaterialPlanningRepository m3,ProcurementRepository repo)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth))return Results.Unauthorized();
            if(!opts.IsConfigured||!auth.IsConfigured)return Results.StatusCode(503);
            try
            {
                var shop=await etsy.AuthorizedShopAsync(ctx.RequestAborted);
                var data=JsonSerializer.SerializeToElement(await m3.GetAsync(shop.ShopId,ctx.RequestAborted));
                var links=await repo.Mappings(ctx.RequestAborted);
                return Results.Ok(new {preview=ProcurementPlanner.Build(data,links),mappings=links});
            }catch(Exception ex) when(ex is HttpRequestException or JsonException or InvalidOperationException)
            {return Results.Problem("M6 preview unavailable; M3/M6 migration or Etsy connection missing.",statusCode:503);}
        }).RequireRateLimiting("production-admin");
        app.MapPost("/api/admin/procurement/mapping",async (HttpContext ctx,
          EtsyConnectionOptions auth,DesignPersistenceOptions opts,
          ProcurementRepository repo,AmazonMappingDraft input)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth))return Results.Unauthorized();
            if(!opts.IsConfigured)return Results.StatusCode(503);
            if(!AmazonMappingValidation.Valid(input))return Results.BadRequest("Invalid product mapping.");
            try{return Results.Ok(await repo.Save(input,ctx.RequestAborted));}
            catch(HttpRequestException){return Results.Problem("Mapping rejected; check M3 SKU.",statusCode:409);}
        }).RequireRateLimiting("production-admin");
        app.MapGet("/api/admin/procurement/catalog/status",(HttpContext ctx,
            EtsyConnectionOptions auth,AmazonBusinessCatalogClient amazon)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth))return Results.Unauthorized();
            return Results.Ok(amazon.Readiness());
        }).RequireRateLimiting("production-admin");

        // Explicit owner request only. No periodic provider polling or writes to M3.
        app.MapPost("/api/admin/procurement/catalog/quotes/refresh",async (
            HttpContext ctx,EtsyConnectionOptions auth,DesignPersistenceOptions opts,
            ProcurementRepository repo,AmazonBusinessCatalogClient amazon)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth))return Results.Unauthorized();
            if(!opts.IsConfigured)return Results.StatusCode(503);
            if(!amazon.Readiness().Configured)return Results.Json(
                new {code="CATALOG_NOT_CONFIGURED"},statusCode:503);
            try
            {
                var mappings=AmazonCatalogParser.ParseMappings(
                    await repo.Mappings(ctx.RequestAborted));
                var quotes=await amazon.Refresh(mappings,ctx.RequestAborted);
                return Results.Ok(quotes);
            }
            catch(AmazonCatalogException e)
            {
                var rate=e.Code is "CATALOG_REFRESH_COOLDOWN" or "PROVIDER_RATE_LIMITED";
                return Results.Json(new {code=e.Code},
                    statusCode:rate?429:503);
            }
            catch(Exception e) when(e is HttpRequestException or JsonException)
            {
                return Results.Json(new {code="CATALOG_READ_UNAVAILABLE"},statusCode:503);
            }
        }).RequireRateLimiting("production-sync");
        // Intentionally NO Amazon order-placement, approval or spending API.
    }
}
