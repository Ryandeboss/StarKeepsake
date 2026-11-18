using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace StarKeepsake.Api;

// All Etsy calls are server-side with the previously authorized transactions_r scope.
public sealed class EtsyProductionClient(
    HttpClient http, EtsyConnectionOptions options, EtsyTokenProvider tokenProvider)
{
    private async Task<EtsyStoredConnection> GetConnectionAsync(CancellationToken ct)
    {
        var token = await tokenProvider.GetValidAsync(ct);
        if (token is null || token.ShopId < 1 ||
            !string.Equals(token.ShopName, options.ExpectedShopName,
                StringComparison.OrdinalIgnoreCase) ||
            !token.Scope.Split(' ', StringSplitOptions.RemoveEmptyEntries).Contains("transactions_r"))
            throw new InvalidOperationException("The expected Etsy shop is not authorized for order reading.");
        return token;
    }

    public Task<EtsyStoredConnection> AuthorizedShopAsync(CancellationToken ct) =>
        GetConnectionAsync(ct);

    private async Task<JsonElement> GetJsonAsync(
        EtsyStoredConnection token, string path, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation("x-api-key",
            options.Keystring + ":" + options.SharedSecret);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException("Etsy order read failed.", null, response.StatusCode);
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var parsed = await JsonDocument.ParseAsync(stream,
            new JsonDocumentOptions {MaxDepth = 64}, ct);
        return parsed.RootElement.Clone();
    }

    public async Task<long[]> RecentReceiptIdsAsync(
        EtsyStoredConnection token, int limit, CancellationToken ct)
    {
        if (limit is < 1 or > 25) throw new ArgumentOutOfRangeException(nameof(limit));
        var path = "v3/application/shops/" +
            token.ShopId.ToString(CultureInfo.InvariantCulture) +
            "/receipts?limit=" + limit.ToString(CultureInfo.InvariantCulture) +
            "&offset=0&sort_on=updated&sort_order=desc";
        var data = await GetJsonAsync(token, path, ct);
        var results = EtsyProductionParser.Field(data, "results");
        if (results is null || results.Value.ValueKind != JsonValueKind.Array)
            throw new InvalidDataException("Etsy receipts list format changed.");
        return results.Value.EnumerateArray()
            .Select(r => EtsyProductionParser.Long(r, "receipt_id") ??
                throw new InvalidDataException("Missing Etsy receipt ID."))
            .Where(id => id > 0).Distinct().Take(limit).ToArray();
    }

    public async Task<(JsonElement Receipt, JsonElement Transactions)> GetFullReceiptAsync(
        EtsyStoredConnection token, long receiptId, CancellationToken ct)
    {
        if (receiptId < 1) throw new ArgumentOutOfRangeException(nameof(receiptId));
        var root = "v3/application/shops/" +
            token.ShopId.ToString(CultureInfo.InvariantCulture) + "/receipts/" +
            receiptId.ToString(CultureInfo.InvariantCulture);
        var receipt = await GetJsonAsync(token, root, ct);
        if (EtsyProductionParser.Long(receipt, "receipt_id") != receiptId)
            throw new InvalidDataException("Etsy receipt identity mismatch.");
        var transactions = await GetJsonAsync(token, root + "/transactions", ct);
        return (receipt, transactions);
    }
}

public static class PaidJobFilePolicy
{
    public static string? MatchedDesign(JsonElement receipt,JsonElement item,JsonElement job)
    {
        static bool Yes(JsonElement row,string key) =>
            row.TryGetProperty(key,out var value) && value.ValueKind==JsonValueKind.True;
        static string? Str(JsonElement row,string key) =>
            row.TryGetProperty(key,out var value) && value.ValueKind==JsonValueKind.String
                ?value.GetString():null;
        if(!Yes(receipt,"is_paid") || Yes(receipt,"is_canceled") ||
           Yes(receipt,"has_refunds") ||
           Str(receipt,"etsy_status") is not ("paid" or "completed"))return null;
        if(Str(item,"match_state")!="matched" ||
           !item.TryGetProperty("quantity",out var qty) ||
           qty.ValueKind!=JsonValueKind.Number ||
           !qty.TryGetInt32(out var count) || count!=1)return null;
        var id=Str(item,"design_id");
        if(!DesignSecurity.ValidId(id) || Str(job,"design_id")!=id ||
           Str(job,"status") is not ("awaiting_review" or "in_progress" or "hold" or "complete"))
            return null;
        return id;
    }
}

public sealed class EtsyProductionRepository(
    HttpClient http, DesignPersistenceOptions options)
{
    private HttpRequestMessage NewRequest(HttpMethod method, string path)
    {
        var baseUrl = options.ProjectUrl.TrimEnd('/') + "/";
        var req = new HttpRequestMessage(method, new Uri(new Uri(baseUrl), path));
        req.Headers.TryAddWithoutValidation("apikey", options.SecretKey);
        if (options.SecretKey.StartsWith("eyJ", StringComparison.Ordinal))
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.SecretKey);
        return req;
    }

    private async Task<JsonElement> SendJsonAsync(
        HttpMethod method, string path, object? payload, CancellationToken ct)
    {
        using var request = NewRequest(method, path);
        if (payload is not null)
            request.Content = new StringContent(JsonSerializer.Serialize(payload),
                Encoding.UTF8, "application/json");
        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException("Production database request failed.", null, response.StatusCode);
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return document.RootElement.Clone();
    }

    public Task<JsonElement> IngestAsync(object receipt, object[] items,
        string? webhookId, string? eventType, CancellationToken ct)
        => SendJsonAsync(HttpMethod.Post, "rest/v1/rpc/m2_ingest_etsy_receipt", new {
            p_receipt = receipt, p_items = items,
            p_webhook_id = webhookId, p_event_type = eventType
        }, ct);

    public async Task<string?> FindVerifiedPaidJobDesignAsync(
        long shopId,long receiptId,long transactionId,CancellationToken ct)
    {
        if(shopId<1 || receiptId<1 || transactionId<1)return null;
        var prefix="shop_id=eq."+shopId.ToString(CultureInfo.InvariantCulture)+
            "&receipt_id=eq."+receiptId.ToString(CultureInfo.InvariantCulture);
        var txn=transactionId.ToString(CultureInfo.InvariantCulture);
        var receipts=await SendJsonAsync(HttpMethod.Get,
            "rest/v1/etsy_receipts?"+prefix+
            "&select=is_paid,is_canceled,has_refunds,etsy_status&limit=1",null,ct);
        if(receipts.ValueKind!=JsonValueKind.Array || receipts.GetArrayLength()!=1)return null;
        var items=await SendJsonAsync(HttpMethod.Get,
            "rest/v1/etsy_order_items?"+prefix+"&transaction_id=eq."+txn+
            "&select=design_id,match_state,quantity&limit=1",null,ct);
        if(items.ValueKind!=JsonValueKind.Array || items.GetArrayLength()!=1)return null;
        var jobs=await SendJsonAsync(HttpMethod.Get,
            "rest/v1/production_jobs?"+prefix+"&transaction_id=eq."+txn+
            "&select=design_id,status&limit=1",null,ct);
        if(jobs.ValueKind!=JsonValueKind.Array || jobs.GetArrayLength()!=1)return null;
        return PaidJobFilePolicy.MatchedDesign(receipts[0],items[0],jobs[0]);
    }

    // Only server-authorized, minimized data is exposed to the admin dashboard.
    public async Task<object> DashboardAsync(long shopId, CancellationToken ct)
    {
        var shop = shopId.ToString(CultureInfo.InvariantCulture);
        var receipts = await SendJsonAsync(HttpMethod.Get,
            "rest/v1/etsy_receipts?shop_id=eq." + shop +
            "&select=shop_id,receipt_id,etsy_status,is_paid,is_canceled,has_refunds," +
            "grandtotal_amount,grandtotal_divisor,currency_code,created_at_etsy,last_synced_at" +
            "&order=last_synced_at.desc&limit=100", null, ct);
        var items = await SendJsonAsync(HttpMethod.Get,
            "rest/v1/etsy_order_items?shop_id=eq." + shop +
            "&select=shop_id,receipt_id,transaction_id,listing_id,title,quantity,design_id,match_state" +
            "&order=last_synced_at.desc&limit=300", null, ct);
        var jobs = await SendJsonAsync(HttpMethod.Get,
            "rest/v1/production_jobs?shop_id=eq." + shop +
            "&select=shop_id,receipt_id,transaction_id,design_id,status,created_at,updated_at" +
            "&order=created_at.desc&limit=300", null, ct);
        return new { shopId, receipts, items, jobs, maxReceipts = 100, maxItems = 300 };
    }
}

public sealed class EtsyProductionService(
    EtsyProductionClient etsy, EtsyProductionRepository db)
{
    // Prevent overlapping admin syncs on the same container replica.
    // The SQL UPSERTs and atomic RPC also safely handle multiple replicas.
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task<JsonElement> SyncOneAsync(
        EtsyStoredConnection token, long receiptId, string? webhookId,
        string? eventType, CancellationToken ct)
    {
        var (receipt, transactions) = await etsy.GetFullReceiptAsync(token, receiptId, ct);
        var minimalReceipt = EtsyProductionParser.ParseReceipt(token.ShopId, receiptId, receipt);
        var minimalItems = EtsyProductionParser.ParseTransactions(transactions);
        await Gate.WaitAsync(ct);
        try { return await db.IngestAsync(minimalReceipt, minimalItems, webhookId, eventType, ct); }
        finally { Gate.Release(); }
    }

    public async Task<object> SyncRecentAsync(int limit, CancellationToken ct)
    {
        var token = await etsy.AuthorizedShopAsync(ct);
        var ids = await etsy.RecentReceiptIdsAsync(token, limit, ct);
        var outcomes = new List<JsonElement>();
        foreach (var id in ids)
            outcomes.Add(await SyncOneAsync(token, id, null, null, ct));
        return new {
            shopId = token.ShopId,
            scanned = ids.Length,
            paidVerified = outcomes.Count(x =>
                EtsyProductionParser.Bool(x, "payment_verified") == true),
            productionJobs = outcomes.Sum(x =>
                EtsyProductionParser.Long(x, "production_jobs") ?? 0),
            needsReview = outcomes.Sum(x =>
                EtsyProductionParser.Long(x, "needs_review_items") ?? 0),
            syncedAtUtc = DateTimeOffset.UtcNow
        };
    }
}

public static class EtsyProductionEndpoints
{
    public static void MapEtsyProductionEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/admin/production/orders", async (
            HttpContext context, EtsyConnectionOptions opts,
            DesignPersistenceOptions designOptions, EtsyProductionClient etsy,
            EtsyProductionRepository db) =>
        {
            NoStore(context);
            if (!Authorized(context, opts)) return Results.Unauthorized();
            if (!opts.IsConfigured || !designOptions.IsConfigured)
                return Results.StatusCode(503);
            try {
                var connection = await etsy.AuthorizedShopAsync(context.RequestAborted);
                return Results.Ok(await db.DashboardAsync(connection.ShopId, context.RequestAborted));
            }
            catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException or
                JsonException or InvalidDataException)
            { return Results.Problem("Unable to load production orders.", statusCode: 503); }
        }).RequireRateLimiting("production-admin");

        app.MapGet("/api/admin/production/jobs/{receiptId:long}/{transactionId:long}/design",
            async (long receiptId,long transactionId,HttpContext context,
                EtsyConnectionOptions opts,DesignPersistenceOptions designOptions,
                EtsyProductionClient etsy,EtsyProductionRepository db,DesignRepository designs) =>
        {
            NoStore(context);
            if(!Authorized(context,opts))return Results.Unauthorized();
            if(!opts.IsConfigured || !designOptions.IsConfigured)return Results.StatusCode(503);
            try
            {
                var shop=await etsy.AuthorizedShopAsync(context.RequestAborted);
                var id=await db.FindVerifiedPaidJobDesignAsync(
                    shop.ShopId,receiptId,transactionId,context.RequestAborted);
                if(id is null)return Results.NotFound();
                var saved=await designs.FindAsync(id,context.RequestAborted);
                if(saved is null)return Results.NotFound();
                return Results.Ok(new {
                    designId=saved.DesignId,
                    design=JsonSerializer.Deserialize<JsonElement>(saved.DesignJson),
                    preferences=JsonSerializer.Deserialize<JsonElement>(saved.PreferencesJson),
                    hasPreparedForeground=saved.ForegroundMime is not null
                });
            }
            catch(Exception ex) when(ex is HttpRequestException or InvalidOperationException
                or JsonException or InvalidDataException or FormatException)
            {return Results.Problem("Owner design lookup is unavailable.",statusCode:503);}
        }).RequireRateLimiting("production-admin");

        app.MapGet("/api/admin/production/jobs/{receiptId:long}/{transactionId:long}/assets/{type}",
            async (long receiptId,long transactionId,string type,HttpContext context,
                EtsyConnectionOptions opts,DesignPersistenceOptions designOptions,
                EtsyProductionClient etsy,EtsyProductionRepository db,DesignRepository designs) =>
        {
            NoStore(context);
            if(!Authorized(context,opts))return Results.Unauthorized();
            if(!opts.IsConfigured || !designOptions.IsConfigured)return Results.StatusCode(503);
            if(type!="original" && type!="foreground")return Results.NotFound();
            try
            {
                var shop=await etsy.AuthorizedShopAsync(context.RequestAborted);
                var id=await db.FindVerifiedPaidJobDesignAsync(
                    shop.ShopId,receiptId,transactionId,context.RequestAborted);
                if(id is null)return Results.NotFound();
                var saved=await designs.FindAsync(id,context.RequestAborted);
                if(saved is null || (type=="foreground" && saved.ForegroundMime is null))
                    return Results.NotFound();
                var data=await designs.DownloadAssetAsync(id,type,context.RequestAborted);
                var mime=type=="foreground"?saved.ForegroundMime!:saved.OriginalMime;
                if(!DesignSecurity.IsImage(data,mime))return Results.NotFound();
                return Results.File(data,mime);
            }
            catch(FileNotFoundException){return Results.NotFound();}
            catch(Exception ex) when(ex is HttpRequestException or InvalidOperationException
                or JsonException or InvalidDataException or FormatException)
            {return Results.Problem("Owner design asset is unavailable.",statusCode:503);}
        }).RequireRateLimiting("production-admin");

        app.MapPost("/api/admin/production/sync", async (
            HttpContext context, EtsyConnectionOptions opts,
            DesignPersistenceOptions designOptions, EtsyProductionService service,
            int? limit) =>
        {
            NoStore(context);
            if (!Authorized(context, opts)) return Results.Unauthorized();
            if (!opts.IsConfigured || !designOptions.IsConfigured)
                return Results.StatusCode(503);
            var safeLimit = limit ?? 10;
            if (safeLimit is < 1 or > 25)
                return Results.BadRequest("Sync limit must be 1 to 25 latest receipts.");
            try { return Results.Ok(await service.SyncRecentAsync(safeLimit, context.RequestAborted)); }
            catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException or
                JsonException or InvalidDataException)
            { return Results.Problem("Etsy order sync failed. No unverified jobs were created.",
                statusCode: 503); }
        }).RequireRateLimiting("production-sync");

        app.MapPost("/api/webhooks/etsy/orders", async (
            HttpContext context, EtsyConnectionOptions opts,
            DesignPersistenceOptions designOptions,
            EtsyProductionClient etsy, EtsyProductionService service) =>
        {
            NoStore(context);
            if (!opts.IsConfigured || !designOptions.IsConfigured ||
                string.IsNullOrWhiteSpace(opts.WebhookSigningSecret))
                return Results.StatusCode(503);

            if (context.Request.ContentLength is > 16 * 1024)
                return Results.StatusCode(413);
            byte[] raw;
            try {
                using var memory = new MemoryStream();
                var buffer = new byte[4096];
                int count;
                while ((count = await context.Request.Body.ReadAsync(
                    buffer.AsMemory(), context.RequestAborted)) > 0)
                {
                    if (memory.Length + count > 16 * 1024) return Results.StatusCode(413);
                    memory.Write(buffer, 0, count);
                }
                raw = memory.ToArray();
            }
            catch (IOException) { return Results.BadRequest(); }

            var webhookId = context.Request.Headers["webhook-id"].ToString();
            var timestamp = context.Request.Headers["webhook-timestamp"].ToString();
            var signature = context.Request.Headers["webhook-signature"].ToString();
            if (!EtsyWebhookVerifier.Verify(opts.WebhookSigningSecret,
                webhookId, timestamp, signature, raw, DateTimeOffset.UtcNow))
                return Results.Unauthorized();

            try {
                using var parsed = JsonDocument.Parse(raw);
                var connection = await etsy.AuthorizedShopAsync(context.RequestAborted);
                if (!EtsyWebhookVerifier.TryExtractReceipt(parsed.RootElement,
                    connection.ShopId, out var receiptId, out var eventType))
                    return Results.BadRequest("Unsupported Etsy order webhook.");
                // Never fetch the webhook-supplied URL. Construct the trusted Etsy path
                // from the validated numeric receipt ID and the OAuth shop ID.
                await service.SyncOneAsync(connection, receiptId, webhookId, eventType,
                    context.RequestAborted);
                return Results.Accepted();
            }
            catch (JsonException) { return Results.BadRequest("Invalid Etsy webhook payload."); }
            catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException or
                InvalidDataException)
            { return Results.Problem("Etsy webhook processing is temporarily unavailable.",
                statusCode: 503); }
        }).RequireRateLimiting("production-webhook");
    }

    private static bool Authorized(HttpContext context, EtsyConnectionOptions options)
    {
        var provided = context.Request.Headers["X-Starkeepsake-Admin-Key"].ToString();
        return !string.IsNullOrWhiteSpace(provided) &&
               options.AdminSetupKey.Length >= 32 &&
               EtsyOAuthProtocol.SecureEquals(provided, options.AdminSetupKey);
    }

    private static void NoStore(HttpContext context)
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
    }
}
