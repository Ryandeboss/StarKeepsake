using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace StarKeepsake.Api;

// M6.3: owner-only persistence for a SIMULATION ledger, not actual purchases.
// Service-role RPCs are private. This code deliberately does not reference
// AmazonBusinessCatalogClient or implement any outbound supplier order.
public sealed class M6SimulationRepository(HttpClient http,DesignPersistenceOptions options)
{
    private async Task<JsonElement> Request(HttpMethod method,string relative,object? body,CancellationToken ct)
    {
        using var req=new HttpRequestMessage(method,
            new Uri(new Uri(options.ProjectUrl.TrimEnd('/')+"/"),"rest/v1/"+relative));
        req.Headers.TryAddWithoutValidation("apikey",options.SecretKey);
        if(options.SecretKey.StartsWith("eyJ",StringComparison.Ordinal))
            req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",options.SecretKey);
        if(body is not null)
            req.Content=new StringContent(JsonSerializer.Serialize(body),Encoding.UTF8,"application/json");
        using var response=await http.SendAsync(req,ct);
        if(!response.IsSuccessStatusCode)
            throw new HttpRequestException("M6 simulated procurement database rejected a request",
                null,response.StatusCode);
        await using var stream=await response.Content.ReadAsStreamAsync(ct);
        using var doc=await JsonDocument.ParseAsync(stream,cancellationToken:ct);
        return doc.RootElement.Clone();
    }
    public Task<JsonElement> List(long shopId,CancellationToken ct)=>
        Request(HttpMethod.Get,"m6_purchase_simulations?shop_id=eq."+
            shopId.ToString(CultureInfo.InvariantCulture)+
            "&select=simulation_id,status,estimated_subtotal_cents,per_order_cap_cents,"+
            "daily_cap_cents,blockers,created_at,reviewed_at,voided_at"+
            "&order=created_at.desc&limit=100",null,ct);
    public async Task<long> ReviewedToday(CancellationToken ct)
    {
        var since=Uri.EscapeDataString(DateTime.UtcNow.Date.ToString(
            "yyyy-MM-ddTHH:mm:ssZ",CultureInfo.InvariantCulture));
        var rows=await Request(HttpMethod.Get,
            "m6_purchase_simulations?status=eq.simulated_reviewed&reviewed_at=gte."+
            since+"&select=estimated_subtotal_cents&limit=300",
            null,ct);
        if(rows.ValueKind!=JsonValueKind.Array||rows.GetArrayLength()>=300)
            throw new InvalidOperationException("Simulated daily budget history incomplete");
        long subtotal=0;
        foreach(var row in rows.EnumerateArray())
            subtotal=checked(subtotal+row.GetProperty("estimated_subtotal_cents").GetInt64());
        return subtotal;
    }
    public Task<JsonElement> Save(long shop,SimulationAssessment assessment,CancellationToken ct)=>
        Request(HttpMethod.Post,"rpc/m6_save_purchase_simulation",new {
            p_id=Guid.NewGuid(),p_shop_id=shop,
            p_fingerprint=SimulationPolicy.Fingerprint(shop,assessment),
            p_snapshot=SimulationPolicy.SnapshotLines(assessment),
            p_estimated_cents=assessment.EstimatedSubtotalCents,
            p_per_order_cap=assessment.PerOrderCapCents,
            p_daily_cap=assessment.DailyCapCents,
            p_blockers=assessment.LiveOrderingBlocks
        },ct);
    public Task<JsonElement> Review(Guid id,CancellationToken ct)=>
        Request(HttpMethod.Post,"rpc/m6_review_purchase_simulation",new{p_id=id},ct);
    public Task<JsonElement> Void(Guid id,CancellationToken ct)=>
        Request(HttpMethod.Post,"rpc/m6_void_purchase_simulation",new{p_id=id},ct);
}
public sealed record SimulatedReviewConfirmation(bool AcknowledgeSimulationOnly);
public static class M6SimulationEndpoints
{
    private static bool Owner(HttpContext ctx,EtsyConnectionOptions auth)=>
        auth.AdminSetupKey.Length>=32 &&
        ctx.Request.Headers.TryGetValue("X-Starkeepsake-Admin-Key",out var key) &&
        key.Count==1 && EtsyOAuthProtocol.SecureEquals(key.ToString(),auth.AdminSetupKey);
    private static void Harden(HttpContext ctx)
    {
        ctx.Response.Headers.CacheControl="no-store";
        ctx.Response.Headers["X-Content-Type-Options"]="nosniff";
    }
    private static async Task<(long shop,SimulationAssessment result)> Evaluate(
        HttpContext ctx,EtsyProductionClient etsy,MaterialPlanningRepository m3,
        ProcurementRepository mappings,M6SimulationRepository ledger,SimulationLimits limits)
    {
        var shop=(await etsy.AuthorizedShopAsync(ctx.RequestAborted)).ShopId;
        var snapshot=JsonSerializer.SerializeToElement(await m3.GetAsync(shop,ctx.RequestAborted));
        var productMappings=await mappings.Mappings(ctx.RequestAborted);
        var plan=ProcurementPlanner.Build(snapshot,productMappings);
        var prior=await ledger.ReviewedToday(ctx.RequestAborted);
        return (shop,SimulationPolicy.Evaluate(plan,limits,prior));
    }
    private static bool Available(DesignPersistenceOptions db,EtsyConnectionOptions auth)=>
        db.IsConfigured&&auth.IsConfigured;
    public static void MapM6SimulationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/admin/procurement/simulations/evaluate",
            async (HttpContext ctx,EtsyConnectionOptions auth,DesignPersistenceOptions db,
                EtsyProductionClient etsy,MaterialPlanningRepository m3,
                ProcurementRepository mappings,M6SimulationRepository store,
                SimulationLimits limits)=>{
                Harden(ctx);
                if(!Owner(ctx,auth))return Results.Unauthorized();
                if(!Available(db,auth))return Results.StatusCode(503);
                if(!SimulationPolicy.ValidLimits(limits))
                    return Results.BadRequest("Invalid hypothetical spending limits.");
                try {
                    var (_,assessment)=await Evaluate(ctx,etsy,m3,mappings,store,limits);
                    return Results.Ok(assessment);
                }catch(Exception e) when(e is HttpRequestException or JsonException
                    or InvalidOperationException or OverflowException){
                    return Results.Problem("Unable to safely evaluate the M6 simulation.",statusCode:503);
                }
            }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/procurement/simulations/save",
            async (HttpContext ctx,EtsyConnectionOptions auth,DesignPersistenceOptions db,
                EtsyProductionClient etsy,MaterialPlanningRepository m3,
                ProcurementRepository mappings,M6SimulationRepository store,
                SimulationLimits limits)=>{
                Harden(ctx);
                if(!Owner(ctx,auth))return Results.Unauthorized();
                if(!Available(db,auth))return Results.StatusCode(503);
                if(!SimulationPolicy.ValidLimits(limits))
                    return Results.BadRequest("Invalid hypothetical spending limits.");
                try {
                    var (shop,assessment)=await Evaluate(ctx,etsy,m3,mappings,store,limits);
                    if(!assessment.CanSaveDraft)
                        return Results.Conflict(new{
                            code="SIMULATION_BLOCKED",blocks=assessment.Blocks,
                            simulationOnly=true});
                    return Results.Ok(await store.Save(shop,assessment,ctx.RequestAborted));
                }catch(Exception e) when(e is HttpRequestException or JsonException
                    or InvalidOperationException or OverflowException){
                    return Results.Problem("Could not save simulated purchase intent.",statusCode:503);
                }
            }).RequireRateLimiting("production-sync");

        app.MapGet("/api/admin/procurement/simulations",async(
            HttpContext ctx,EtsyConnectionOptions auth,DesignPersistenceOptions db,
            EtsyProductionClient etsy,M6SimulationRepository store)=>{
                Harden(ctx);
                if(!Owner(ctx,auth))return Results.Unauthorized();
                if(!Available(db,auth))return Results.StatusCode(503);
                try {
                    var shop=(await etsy.AuthorizedShopAsync(ctx.RequestAborted)).ShopId;
                    return Results.Ok(new{simulations=await store.List(shop,ctx.RequestAborted),
                        simulationOnly=true,checkoutEnabled=false});
                }catch(Exception e)when(e is HttpRequestException or JsonException
                    or InvalidOperationException){
                    return Results.Problem("Simulated ledger unavailable.",statusCode:503);
                }
            }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/procurement/simulations/{id:guid}/review",async(
            Guid id,HttpContext ctx,EtsyConnectionOptions auth,DesignPersistenceOptions db,
            EtsyProductionClient etsy,M6SimulationRepository store,
            SimulatedReviewConfirmation confirmation)=>{
                Harden(ctx);
                if(!Owner(ctx,auth))return Results.Unauthorized();
                if(!Available(db,auth))return Results.StatusCode(503);
                if(confirmation is not {AcknowledgeSimulationOnly:true})
                    return Results.BadRequest("Explicit simulated-only acknowledgement required.");
                try {
                    var shop=(await etsy.AuthorizedShopAsync(ctx.RequestAborted)).ShopId;
                    // Reject foreign-shop intent before the service-role RPC.
                    var rows=await store.List(shop,ctx.RequestAborted);
                    if(!rows.EnumerateArray().Any(x=>x.GetProperty("simulation_id").GetGuid()==id))
                        return Results.NotFound();
                    return Results.Ok(await store.Review(id,ctx.RequestAborted));
                }catch(HttpRequestException){
                    return Results.Conflict(new{code="SIMULATED_REVIEW_REJECTED",simulationOnly=true});
                }
            }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/procurement/simulations/{id:guid}/void",async(
            Guid id,HttpContext ctx,EtsyConnectionOptions auth,DesignPersistenceOptions db,
            EtsyProductionClient etsy,M6SimulationRepository store)=>{
                Harden(ctx);
                if(!Owner(ctx,auth))return Results.Unauthorized();
                if(!Available(db,auth))return Results.StatusCode(503);
                try {
                    var shop=(await etsy.AuthorizedShopAsync(ctx.RequestAborted)).ShopId;
                    var rows=await store.List(shop,ctx.RequestAborted);
                    if(!rows.EnumerateArray().Any(x=>x.GetProperty("simulation_id").GetGuid()==id))
                        return Results.NotFound();
                    return Results.Ok(await store.Void(id,ctx.RequestAborted));
                }catch(HttpRequestException){
                    return Results.Conflict(new{code="SIMULATION_VOID_REJECTED",simulationOnly=true});
                }
            }).RequireRateLimiting("production-admin");
        // No provider API, no order request, no card, no customer delivery data.
    }
}
