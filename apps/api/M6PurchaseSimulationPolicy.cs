using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace StarKeepsake.Api;

// M6.3 safeguards ONLY FOR SIMULATED PROCUREMENT.
// A reviewed simulation is never a purchase order, approval to spend or
// an Amazon Ordering API request.
public sealed record SimulationLimits(long PerOrderCapCents,long DailyCapCents);
public sealed record SimulationLine(
    string Sku,string Asin,int Packs,decimal PartsPerPack,
    decimal AdditionalParts,long CatalogEstimateCents);
public sealed record SimulationAssessment(
    string Mode,bool SimulationOnly,bool ReadyForActualCheckout,
    bool CanSaveDraft,bool CanReviewSimulation,long? EstimatedSubtotalCents,
    long PerOrderCapCents,long DailyCapCents,long AlreadyReviewedTodayCents,
    string[] Blocks,string[] LiveOrderingBlocks,SimulationLine[] Lines,string[] JobKeys);

public static class SimulationPolicy
{
    public static bool ValidLimits(SimulationLimits? limits)=>
        limits is not null && limits.PerOrderCapCents is >=1 and <=100000000 &&
        limits.DailyCapCents is >=1 and <=100000000;
    public static SimulationAssessment Evaluate(
        ProcurementPreview plan,SimulationLimits limits,long reviewedTodayCents=0)
    {
        if(!ValidLimits(limits))throw new ArgumentOutOfRangeException(nameof(limits));
        if(reviewedTodayCents<0)throw new ArgumentOutOfRangeException(nameof(reviewedTodayCents));
        var blocking=new List<string>();
        if(!plan.SnapshotComplete)blocking.Add("SOURCE_PAGINATION_OR_BOM_INCOMPLETE");
        if(plan.ActivePaidJobs<=0)blocking.Add("NO_VERIFIED_PAID_JOBS");
        var shortage=plan.Lines.Where(x=>x.NetToOrder>0)
            .OrderBy(x=>x.Sku,StringComparer.Ordinal).ToArray();
        if(shortage.Length==0)blocking.Add("NO_INCREMENTAL_SHORTAGES");
        if(shortage.Length>20)blocking.Add("SIMULATION_LINE_LIMIT");
        var lines=new List<SimulationLine>();
        foreach(var x in shortage)
        {
            if(x.Asin is null||x.Asin.Length!=10)
                blocking.Add("ASIN_NOT_MAPPED:"+x.Sku);
            if(x.PackQuantity is null||x.PackQuantity<=0||
               x.PacksToBuy is null||x.PacksToBuy<=0||x.PacksToBuy>10000)
                blocking.Add("PACK_NOT_VERIFIED:"+x.Sku);
            if(x.EstimatedPurchaseCents is null||x.EstimatedPurchaseCents<=0)
                blocking.Add("CATALOG_COST_UNKNOWN:"+x.Sku);
            if(x.Blocks.Contains("MAX_PRICE_NOT_SET")||x.Blocks.Contains("CATALOG_ABOVE_CAP"))
                blocking.Add("MAPPED_PRICE_CAP_INVALID:"+x.Sku);
            if(x.Asin is string asin && asin.Length==10 &&
               x.PackQuantity is decimal pack && pack>0 &&
               x.PacksToBuy is int packs && packs>0 && packs<=10000 &&
               x.EstimatedPurchaseCents is long cents && cents>0 && cents<=100000000)
            {
                lines.Add(new SimulationLine(x.Sku,asin,packs,pack,
                    x.NetToOrder,cents));
            }
        }
        long? total=null;
        if(shortage.Length>0&&shortage.Length==lines.Count)
        {
            try{total=lines.Aggregate(0L,(sum,x)=>checked(sum+x.CatalogEstimateCents));}
            catch(OverflowException){blocking.Add("TOTAL_OVERFLOW");}
        }
        if(total is not null)
        {
            if(total>limits.PerOrderCapCents)blocking.Add("PER_ORDER_CAP_EXCEEDED");
            if(total>limits.DailyCapCents-reviewedTodayCents)
                blocking.Add("SIMULATED_DAILY_CAP_EXCEEDED");
        }
        var liveBlocks=new[]{
            "AMAZON_ORDERING_NOT_IMPLEMENTED",
            "NO_LIVE_CART_TOTAL_OR_TAXES",
            "NO_VERIFIED_SUPPLIER_PACK_OR_OFFER",
            "NO_CHARGED_PAYMENT_METHOD_OR_VENDOR_AUTHORIZATION",
            "SIMULATED_REVIEW_IS_NOT_PURCHASE_AUTHORIZATION"
        };
        var canSave=blocking.Count==0 && lines.Count>0 && total is >0 and <=100000000;
        return new SimulationAssessment("simulation_only",true,false,
            canSave,canSave,total,limits.PerOrderCapCents,limits.DailyCapCents,
            reviewedTodayCents,blocking.ToArray(),liveBlocks,lines.ToArray(),
            plan.ActiveJobKeys?.OrderBy(x=>x,StringComparer.Ordinal).ToArray()??[]);
    }
    public static string Fingerprint(
        long shopId,SimulationAssessment assessment)
    {
        if(shopId<=0||!assessment.CanSaveDraft||assessment.EstimatedSubtotalCents is null)
            throw new InvalidOperationException("Cannot fingerprint an incomplete simulation");
        // Canonical fields only: no customer PII, design metadata or API keys.
        var normalized=JsonSerializer.Serialize(new{
            shopId,amount=assessment.EstimatedSubtotalCents.Value,
            perOrder=assessment.PerOrderCapCents,
            daily=assessment.DailyCapCents,
            jobs=assessment.JobKeys.OrderBy(x=>x,StringComparer.Ordinal),
            lines=assessment.Lines.OrderBy(x=>x.Sku,StringComparer.Ordinal)
        });
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(normalized)));
    }
    public static object[] SnapshotLines(SimulationAssessment assessment)=>
        assessment.Lines.Select(x=>(object)new{
            sku=x.Sku,asin=x.Asin,packs=x.Packs,
            partsPerPack=x.PartsPerPack,additionalParts=x.AdditionalParts,
            estimatedCents=x.CatalogEstimateCents
        }).ToArray();
}
