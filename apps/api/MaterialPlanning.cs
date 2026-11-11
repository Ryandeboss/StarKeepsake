using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StarKeepsake.Api;

// M3 is an owner-only planning tool, never a purchase engine or a stock reservation.
public static class MaterialValidation
{
    private static readonly Regex Sku = new("^[A-Z0-9][A-Z0-9_-]{1,39}$", RegexOptions.Compiled);
    private static readonly Regex Recipe = new("^[a-z0-9][a-z0-9_-]{2,49}$", RegexOptions.Compiled);
    public static bool ValidSku(string? sku) => sku is not null && Sku.IsMatch(sku);
    public static bool ValidRecipe(string? code) => code is not null && Recipe.IsMatch(code);
    public static bool ValidMoney(long? cents) => cents is null or >= 0 and <= 100000000;
    public static bool ValidMaterial(MaterialDraft item) =>
        ValidSku(item.Sku) && item.Name.Trim().Length is >= 2 and <= 120 &&
        item.Category is "frame" or "photo" or "lighting" or "electronics" or "mounting" or "packaging" or "consumable" or "other" &&
        item.Unit is "each" or "ft" or "m" or "sheet" or "ml" &&
        ValidMoney(item.UnitCostCents) &&
        item.ReorderAt is >= 0 and <= 100000 &&
        (item.SupplierName?.Length ?? 0) <= 120 && (item.Notes?.Length ?? 0) <= 500 &&
        (string.IsNullOrWhiteSpace(item.SupplierUrl) ||
          (item.SupplierUrl.Length <= 500 &&
           Uri.TryCreate(item.SupplierUrl, UriKind.Absolute, out var url) &&
           url.Scheme == Uri.UriSchemeHttps &&
           url.UserInfo.Length == 0 && url.Port == 443));
    public static bool ValidRecipeDraft(RecipeDraft recipe) =>
        ValidRecipe(recipe.RecipeCode) && recipe.Name.Trim().Length is >= 3 and <= 120 &&
        recipe.Finish is "any" or "walnut" or "oak" or "ebony" &&
        recipe.Lines is { Length: >= 1 and <= 60 } &&
        recipe.Lines.Select(x => x.Sku).Distinct().Count() == recipe.Lines.Length &&
        recipe.Lines.All(x => ValidSku(x.Sku) && x.QuantityPerFrame is > 0 and <= 10000 &&
          x.WastePercent is >= 0 and <= 100 &&
          x.QuantityPerFrame == decimal.Round(x.QuantityPerFrame,3));
}
public sealed record MaterialDraft(
    string Sku, string Name, string Category, string Unit, long? UnitCostCents,
    decimal ReorderAt, string? SupplierName, string? SupplierUrl, string? Notes);
public sealed record RecipeLineDraft(string Sku, decimal QuantityPerFrame, decimal WastePercent);
public sealed record RecipeDraft(string RecipeCode,string Name,string Finish,RecipeLineDraft[] Lines);
public sealed record StockDraft(string Sku,decimal Delta,string Reason,Guid MovementId);
public sealed record JobBOMDraft(long ShopId,long ReceiptId,long TransactionId,string RecipeCode);
public sealed record SupplierPurchaseDraft(Guid PurchaseId,string Sku,decimal Quantity,
  string SupplierReference,long? UnitCostCents);
public sealed record SupplierReceiptDraft(Guid PurchaseId,Guid ReceiptId,decimal Quantity);
public sealed record JobAllocationDraft(long ShopId,long ReceiptId,long TransactionId,
  string Sku,decimal Quantity);
public static class ProcurementValidation {
  public static bool ValidQty(decimal qty,bool allowZero=false) =>
    qty>=0 && (allowZero || qty>0) && qty<=100000m && qty==decimal.Round(qty,3);
  public static bool ValidSupplierPurchase(SupplierPurchaseDraft x) =>
    x.PurchaseId!=Guid.Empty && MaterialValidation.ValidSku(x.Sku) &&
    ValidQty(x.Quantity) && !string.IsNullOrWhiteSpace(x.SupplierReference) &&
    x.SupplierReference.Trim().Length is >=3 and <=120 &&
    MaterialValidation.ValidMoney(x.UnitCostCents);
}

public sealed class MaterialPlanningRepository(HttpClient client, DesignPersistenceOptions options)
{
    private async Task<JsonElement> RequestAsync(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method,
            new Uri(new Uri(options.ProjectUrl.TrimEnd('/') + "/"), "rest/v1/" + path));
        request.Headers.TryAddWithoutValidation("apikey", options.SecretKey);
        if (options.SecretKey.StartsWith("eyJ",StringComparison.Ordinal))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer",options.SecretKey);
        if (body is not null)
            request.Content = new StringContent(JsonSerializer.Serialize(body),Encoding.UTF8,"application/json");
        using var response = await client.SendAsync(request,ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException("Material planning database request failed.",null,response.StatusCode);
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var data = await JsonDocument.ParseAsync(stream,cancellationToken:ct);
        return data.RootElement.Clone();
    }
    private Task<JsonElement> ListAsync(string table,string select,string order,CancellationToken ct) =>
        RequestAsync(HttpMethod.Get,table+"?select="+select+"&order="+order+"&limit=300",null,ct);

    public async Task<object> GetAsync(long shopId,CancellationToken ct)
    {
        var shop=shopId.ToString(CultureInfo.InvariantCulture);
        var parts=await ListAsync("materials","sku,name,category,unit,unit_cost_cents,on_hand,reorder_at,supplier_name,supplier_url,notes,updated_at","sku.asc",ct);
        var recipes=await ListAsync("material_recipes","recipe_code,name,finish,updated_at","recipe_code.asc",ct);
        var recipeLines=await ListAsync("material_recipe_lines","recipe_code,sku,quantity_per_frame,waste_percent","recipe_code.asc",ct);
        var plans=await RequestAsync(HttpMethod.Get,"job_material_plans?shop_id=eq."+shop+
            "&select=shop_id,receipt_id,transaction_id,recipe_code,finish,status,created_at"+
            "&order=created_at.desc&limit=300",null,ct);
        var lines=await RequestAsync(HttpMethod.Get,"job_material_lines?shop_id=eq."+shop+
            "&select=shop_id,receipt_id,transaction_id,sku,name_snapshot,unit_snapshot,quantity_required,unit_cost_cents_snapshot"+
            "&order=receipt_id.desc&limit=1000",null,ct);
        var jobs=await RequestAsync(HttpMethod.Get,"production_jobs?shop_id=eq."+shop+
            "&select=shop_id,receipt_id,transaction_id,design_id,status&order=created_at.desc&limit=300",null,ct);
        var purchases=await ListAsync("material_purchases",
          "purchase_id,sku,quantity_ordered,quantity_received,supplier_reference,unit_cost_cents_snapshot,status,created_at,updated_at",
          "created_at.desc",ct);
        var allocations=await RequestAsync(HttpMethod.Get,"material_allocations?shop_id=eq."+shop+
          "&select=shop_id,receipt_id,transaction_id,sku,quantity_allocated,updated_at&limit=1000",
          null,ct);
        return new {shopId,parts,recipes,recipeLines,plans,lines,jobs,purchases,allocations};
    }
    public Task<JsonElement> SaveMaterialAsync(MaterialDraft item,CancellationToken ct) =>
        RequestAsync(HttpMethod.Post,"rpc/m3_save_material",new {p_material=new {
            sku=item.Sku,name=item.Name,category=item.Category,unit=item.Unit,
            unit_cost_cents=item.UnitCostCents,reorder_at=item.ReorderAt,
            supplier_name=item.SupplierName,supplier_url=item.SupplierUrl,notes=item.Notes}},ct);
    public Task<JsonElement> SaveRecipeAsync(RecipeDraft item,CancellationToken ct) =>
        RequestAsync(HttpMethod.Post,"rpc/m3_save_recipe",new {
            p_recipe_code=item.RecipeCode,p_name=item.Name,p_finish=item.Finish,
            p_lines=item.Lines.Select(x=>new {sku=x.Sku,
                quantity_per_frame=x.QuantityPerFrame,waste_percent=x.WastePercent})},ct);
    public Task<JsonElement> AdjustStockAsync(StockDraft item,CancellationToken ct) =>
        RequestAsync(HttpMethod.Post,"rpc/m3_adjust_stock",new {
            p_sku=item.Sku,p_delta=item.Delta,p_reason=item.Reason,
            p_movement_id=item.MovementId},ct);
    public Task<JsonElement> PreparePlanAsync(JobBOMDraft item,CancellationToken ct) =>
        RequestAsync(HttpMethod.Post,"rpc/m3_prepare_job_plan",new {
            p_shop_id=item.ShopId,p_receipt_id=item.ReceiptId,
            p_transaction_id=item.TransactionId,p_recipe_code=item.RecipeCode},ct);
    public Task<JsonElement> LogSupplierPurchaseAsync(SupplierPurchaseDraft x,CancellationToken ct) =>
        RequestAsync(HttpMethod.Post,"rpc/m3_log_supplier_purchase",new {
            p_purchase_id=x.PurchaseId,p_sku=x.Sku,p_qty=x.Quantity,
            p_reference=x.SupplierReference,p_unit_cost_cents=x.UnitCostCents},ct);
    public Task<JsonElement> ReceivePurchaseAsync(SupplierReceiptDraft x,CancellationToken ct) =>
        RequestAsync(HttpMethod.Post,"rpc/m3_receive_supplier_purchase",new {
            p_purchase_id=x.PurchaseId,p_receipt_id=x.ReceiptId,p_qty=x.Quantity},ct);
    public Task<JsonElement> AllocateJobAsync(JobAllocationDraft x,CancellationToken ct) =>
        RequestAsync(HttpMethod.Post,"rpc/m3_allocate_job_material",new {
            p_shop_id=x.ShopId,p_receipt_id=x.ReceiptId,p_transaction_id=x.TransactionId,
            p_sku=x.Sku,p_qty=x.Quantity},ct);
}

public static class MaterialPlanningEndpoints
{
    private static bool Allowed(HttpContext ctx,EtsyConnectionOptions opts) =>
        opts.AdminSetupKey.Length >= 32 &&
        ctx.Request.Headers.TryGetValue("X-Starkeepsake-Admin-Key",out var key) &&
        key.Count==1 && EtsyOAuthProtocol.SecureEquals(key.ToString(),opts.AdminSetupKey);
    private static void Harden(HttpContext ctx)
    {
        ctx.Response.Headers.CacheControl="no-store";
        ctx.Response.Headers["X-Content-Type-Options"]="nosniff";
        ctx.Response.Headers["Referrer-Policy"]="no-referrer";
    }
    public static void MapMaterialPlanningEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/admin/materials",async (HttpContext ctx,EtsyConnectionOptions auth,
            DesignPersistenceOptions options,EtsyProductionClient etsy,MaterialPlanningRepository db)=>{
            Harden(ctx);
            if (!Allowed(ctx,auth)) return Results.Unauthorized();
            if (!options.IsConfigured || !auth.IsConfigured) return Results.StatusCode(503);
            try { var shop=await etsy.AuthorizedShopAsync(ctx.RequestAborted);
                return Results.Ok(await db.GetAsync(shop.ShopId,ctx.RequestAborted)); }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException)
            { return Results.Problem("Could not load private materials.",statusCode:503); }
        }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/materials/catalog",async (HttpContext ctx,EtsyConnectionOptions auth,
            DesignPersistenceOptions options,MaterialPlanningRepository db,MaterialDraft input)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth)) return Results.Unauthorized();
            if(!options.IsConfigured) return Results.StatusCode(503);
            if(input is null || !MaterialValidation.ValidMaterial(input)) return Results.BadRequest("Invalid material fields.");
            try {return Results.Ok(await db.SaveMaterialAsync(input,ctx.RequestAborted));}
            catch(HttpRequestException) {return Results.Problem("Material save rejected. Confirm SKU and existing unit.",statusCode:409);}
        }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/materials/recipes",async (HttpContext ctx,EtsyConnectionOptions auth,
            DesignPersistenceOptions options,MaterialPlanningRepository db,RecipeDraft input)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth)) return Results.Unauthorized();
            if(!options.IsConfigured) return Results.StatusCode(503);
            if(input is null || !MaterialValidation.ValidRecipeDraft(input)) return Results.BadRequest("Invalid recipe fields.");
            try {return Results.Ok(await db.SaveRecipeAsync(input,ctx.RequestAborted));}
            catch(HttpRequestException) {return Results.Problem("Recipe rejected. Check that every SKU exists.",statusCode:409);}
        }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/materials/stock",async (HttpContext ctx,EtsyConnectionOptions auth,
            DesignPersistenceOptions options,MaterialPlanningRepository db,StockDraft input)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth)) return Results.Unauthorized();
            if(!options.IsConfigured) return Results.StatusCode(503);
            if(input is null || !MaterialValidation.ValidSku(input.Sku) || input.MovementId==Guid.Empty ||
                input.Delta==0 || Math.Abs(input.Delta)>100000 ||
                input.Delta!=decimal.Round(input.Delta,3) || input.Reason?.Trim().Length is < 3 or > 200)
                return Results.BadRequest("Invalid stock adjustment.");
            try {return Results.Ok(await db.AdjustStockAsync(input,ctx.RequestAborted));}
            catch(HttpRequestException) {return Results.Problem("Stock adjustment rejected. Check availability.",statusCode:409);}
        }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/materials/plan",async (HttpContext ctx,EtsyConnectionOptions auth,
            DesignPersistenceOptions options,EtsyProductionClient etsy,MaterialPlanningRepository db,JobBOMDraft input)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth)) return Results.Unauthorized();
            if(!options.IsConfigured || !auth.IsConfigured) return Results.StatusCode(503);
            if(input is null || input.ShopId<=0 || input.ReceiptId<=0 || input.TransactionId<=0 ||
                !MaterialValidation.ValidRecipe(input.RecipeCode)) return Results.BadRequest("Invalid job or recipe.");
            try {
                var token=await etsy.AuthorizedShopAsync(ctx.RequestAborted);
                if(token.ShopId!=input.ShopId) return Results.Unauthorized();
                return Results.Ok(await db.PreparePlanAsync(input,ctx.RequestAborted));
            } catch(Exception ex) when (ex is HttpRequestException or InvalidOperationException) {
                return Results.Problem("BOM not prepared. Verify paid job and matching saved-design finish.",statusCode:409);
            }
        }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/materials/purchases",async (HttpContext ctx,
          EtsyConnectionOptions auth,DesignPersistenceOptions options,
          MaterialPlanningRepository db,SupplierPurchaseDraft input)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth))return Results.Unauthorized();
            if(!options.IsConfigured)return Results.StatusCode(503);
            if(input is null || !ProcurementValidation.ValidSupplierPurchase(input))
              return Results.BadRequest("Invalid supplier purchase record.");
            try{return Results.Ok(await db.LogSupplierPurchaseAsync(input,ctx.RequestAborted));}
            catch(HttpRequestException){return Results.Problem("Supplier log rejected.",statusCode:409);}
        }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/materials/receipts",async (HttpContext ctx,
          EtsyConnectionOptions auth,DesignPersistenceOptions options,
          MaterialPlanningRepository db,SupplierReceiptDraft input)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth))return Results.Unauthorized();
            if(!options.IsConfigured)return Results.StatusCode(503);
            if(input is null||input.PurchaseId==Guid.Empty||input.ReceiptId==Guid.Empty||
              !ProcurementValidation.ValidQty(input.Quantity))
              return Results.BadRequest("Invalid supplier receipt.");
            try{return Results.Ok(await db.ReceivePurchaseAsync(input,ctx.RequestAborted));}
            catch(HttpRequestException){return Results.Problem("Receipt rejected: missing purchase, over-delivery or duplicate ID.",statusCode:409);}
        }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/materials/allocations",async (HttpContext ctx,
          EtsyConnectionOptions auth,DesignPersistenceOptions options,EtsyProductionClient etsy,
          MaterialPlanningRepository db,JobAllocationDraft input)=>{
            Harden(ctx);
            if(!Allowed(ctx,auth))return Results.Unauthorized();
            if(!options.IsConfigured || !auth.IsConfigured)return Results.StatusCode(503);
            if(input is null||input.ShopId<=0||input.ReceiptId<=0||input.TransactionId<=0||
              !MaterialValidation.ValidSku(input.Sku)||!ProcurementValidation.ValidQty(input.Quantity,true))
              return Results.BadRequest("Invalid job allocation.");
            try{
              var shop=await etsy.AuthorizedShopAsync(ctx.RequestAborted);
              if(shop.ShopId!=input.ShopId)return Results.Unauthorized();
              return Results.Ok(await db.AllocateJobAsync(input,ctx.RequestAborted));
            }catch(Exception ex) when(ex is HttpRequestException or InvalidOperationException){
              return Results.Problem("Allocation rejected: verify paid job, BOM and free stock.",statusCode:409);
            }
        }).RequireRateLimiting("production-admin");
    }
}
