using System.Net.Http.Headers;
using System.Text.Json;

namespace StarKeepsake.Api;

public sealed record FramePriceQuote(string Id,string Label,decimal DepthInches,
    long PriceCents,string Currency,string Mode,string Revision,string? UpdatedAtUtc);

public static class FramePricePolicy
{
    // Owner policy default, not yet a verified selling price:
    // $125 labor + $35 overhead; allow 12% fees and 25% margin.
    public static long RetailCents(decimal materialCents)
    {
        if(materialCents<0||materialCents>100000000)
            throw new ArgumentOutOfRangeException(nameof(materialCents));
        return checked((long)(decimal.Ceiling(((materialCents+16000m)/.63m)/500m)*500m));
    }
}

public sealed class FramePricingService(HttpClient http,DesignPersistenceOptions options)
{
    private static readonly FramePriceQuote[] Planning=[
        new("walnut","Two-tone walnut",2.5m,79900,"USD","planning","prototype-budget-v1",null),
        new("ebony","Matte black",3.5m,89900,"USD","planning","prototype-budget-v1",null)
    ];
    private async Task<JsonElement> ReadAsync(string query,CancellationToken ct)
    {
        using var request=new HttpRequestMessage(HttpMethod.Get,
            new Uri(new Uri(options.ProjectUrl.TrimEnd('/')+"/"),"rest/v1/"+query));
        request.Headers.TryAddWithoutValidation("apikey",options.SecretKey);
        if(options.SecretKey.StartsWith("eyJ",StringComparison.Ordinal))
            request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",options.SecretKey);
        using var response=await http.SendAsync(request,ct);
        response.EnsureSuccessStatusCode();
        await using var stream=await response.Content.ReadAsStreamAsync(ct);
        using var json=await JsonDocument.ParseAsync(stream,cancellationToken:ct);
        if(json.RootElement.ValueKind!=JsonValueKind.Array)throw new JsonException();
        return json.RootElement.Clone();
    }
    public async Task<FramePriceQuote[]> QuotesAsync(CancellationToken ct)
    {
        if(!options.IsConfigured)return Planning;
        try{
            // Fixed private DB URLs only: never scrape vendor sites or expose unit costs.
            var items=await ReadAsync("materials?select=sku,unit_cost_cents,updated_at&limit=300",ct);
            var recipes=await ReadAsync("material_recipes?select=recipe_code,updated_at&limit=300",ct);
            var lines=await ReadAsync("material_recipe_lines?select=recipe_code,sku,quantity_per_frame,waste_percent&limit=500",ct);
            var price=new Dictionary<string,decimal>();
            var updated=new Dictionary<string,string?>();
            foreach(var item in items.EnumerateArray()){
                var sku=item.GetProperty("sku").GetString();
                var cost=item.GetProperty("unit_cost_cents");
                if(sku is null||cost.ValueKind!=JsonValueKind.Number)continue;
                price[sku]=cost.GetDecimal();
                updated[sku]=item.GetProperty("updated_at").GetString();
            }
            var result=new List<FramePriceQuote>();
            foreach(var defaultQuote in Planning){
                var recipeCode="starkeepsake-11x14-"+defaultQuote.Id;
                var hasRecipe=recipes.EnumerateArray().Any(r=>r.GetProperty("recipe_code").GetString()==recipeCode);
                var recipeLines=lines.EnumerateArray().Where(x=>x.GetProperty("recipe_code").GetString()==recipeCode).ToArray();
                if(!hasRecipe||recipeLines.Length==0){result.Add(defaultQuote);continue;}
                decimal total=0;var complete=true;var dates=new List<string>();
                foreach(var line in recipeLines){
                    var sku=line.GetProperty("sku").GetString()??"";
                    if(!price.TryGetValue(sku,out var unitCost)){complete=false;break;}
                    var qty=line.GetProperty("quantity_per_frame").GetDecimal();
                    var waste=line.GetProperty("waste_percent").GetDecimal();
                    if(qty<=0||waste<0||waste>100){complete=false;break;}
                    total+=(decimal.Ceiling(qty*(1+waste/100m)*1000m)/1000m)*unitCost;
                    if(updated.GetValueOrDefault(sku) is string d)dates.Add(d);
                }
                if(!complete){result.Add(defaultQuote);continue;}
                var recipeUpdated=recipes.EnumerateArray().First(x=>
                    x.GetProperty("recipe_code").GetString()==recipeCode);
                if(recipeUpdated.TryGetProperty("updated_at",out var recipeTime)
                    &&recipeTime.ValueKind==JsonValueKind.String)
                    dates.Add(recipeTime.GetString()!);
                var revision=dates.OrderBy(x=>x,StringComparer.Ordinal).LastOrDefault()??"catalog-v1";
                result.Add(defaultQuote with {PriceCents=FramePricePolicy.RetailCents(total),
                    Mode="catalog",Revision=revision,UpdatedAtUtc=revision=="catalog-v1"?null:revision});
            }
            return result.ToArray();
        }catch(Exception ex) when(ex is HttpRequestException or JsonException or InvalidOperationException
            or OverflowException or ArgumentOutOfRangeException or FormatException){
            return Planning;
        }
    }
}
