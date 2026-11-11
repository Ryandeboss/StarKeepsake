using StarKeepsake.Api;
static void Check(bool yes,string name)
{
 if(!yes)throw new Exception("FAILED: "+name);
 Console.WriteLine("PASS "+name);
}
var line=new ProcurementNeed("LED-WW","Warm white LED emitter","each",
  5,1,1,4,3,"B001ABC123",2,2,11000,44000,
  ["LIVE_AMAZON_OFFER_UNVERIFIED","BUYING_ACCOUNT_NOT_AUTHORIZED",
    "SPENDING_APPROVAL_NOT_CONFIGURED"]);
var plan=new ProcurementPreview("simulation",false,false,true,1,1,44000,
    [line],["manual costs only"],["1:10:100"]);
var limits=new SimulationLimits(50000,100000);
Check(SimulationPolicy.ValidLimits(limits),"valid hypothetical USD budgets");
Check(!SimulationPolicy.ValidLimits(new SimulationLimits(0,100000)),
    "zero cap rejected");
Check(!SimulationPolicy.ValidLimits(new SimulationLimits(100,0)),
    "zero daily cap rejected");
var evaluation=SimulationPolicy.Evaluate(plan,limits);
Check(evaluation.CanSaveDraft&&evaluation.CanReviewSimulation,
    "eligible paid BOM can create simulated proposal");
Check(evaluation.SimulationOnly&&!evaluation.ReadyForActualCheckout&&
    evaluation.LiveOrderingBlocks.Contains("AMAZON_ORDERING_NOT_IMPLEMENTED"),
    "simulation never authorizes supplier checkout");
Check(evaluation.Lines.Length==1&&evaluation.Lines[0].Packs==2&&
    evaluation.Lines[0].AdditionalParts==3,
    "pack calculations preserve M3 incoming stock deduction");
Check(evaluation.EstimatedSubtotalCents==44000&&
    evaluation.PerOrderCapCents==50000,
    "manual M3 estimate and explicit cap retained");
var id=SimulationPolicy.Fingerprint(1,evaluation);
Check(id.Length==64&&id.All(x=>char.IsAsciiHexDigit(x)),
    "stable SHA256 fingerprint");
Check(id==SimulationPolicy.Fingerprint(1,SimulationPolicy.Evaluate(plan,limits)),
    "retry uses identical idempotency fingerprint");
var anotherJob=plan with {ActiveJobKeys=["1:10:101"]};
Check(id!=SimulationPolicy.Fingerprint(1,SimulationPolicy.Evaluate(anotherJob,limits)),
    "new job identity cannot reuse original purchase simulation");
Check(id!=SimulationPolicy.Fingerprint(1,SimulationPolicy.Evaluate(plan,
    new SimulationLimits(55000,100000))),
    "new spending policy cannot reuse original fingerprint");
Check(!SimulationPolicy.Evaluate(plan,new SimulationLimits(40000,100000)).CanSaveDraft,
    "over per-order limit blocked");
Check(SimulationPolicy.Evaluate(plan,new SimulationLimits(40000,100000))
    .Blocks.Contains("PER_ORDER_CAP_EXCEEDED"),"per-order overrun reason");
Check(SimulationPolicy.Evaluate(plan,limits,70000).Blocks.Contains(
    "SIMULATED_DAILY_CAP_EXCEEDED"),"previous simulated daily reviews count");
Check(!SimulationPolicy.Evaluate(plan,limits,70000).CanReviewSimulation,
    "daily cap prevents simulated review");
Check(!SimulationPolicy.Evaluate(plan with {SnapshotComplete=false},limits).CanSaveDraft,
    "truncated data cannot produce simulation");
Check(!SimulationPolicy.Evaluate(plan with {ActivePaidJobs=0},limits).CanSaveDraft,
    "unpaid or missing Etsy jobs cannot produce simulation");
Check(!SimulationPolicy.Evaluate(plan with {Lines=[line with {Asin=null}]},limits)
    .CanSaveDraft,"unmapped ASIN cannot produce simulation");
Check(!SimulationPolicy.Evaluate(plan with {
    Lines=[line with {EstimatedPurchaseCents=null}]
},limits).CanSaveDraft,"unknown manual material cost cannot produce simulation");
Check(!SimulationPolicy.Evaluate(plan with {
    Lines=[line with {Blocks=["MAX_PRICE_NOT_SET"]}]
},limits).CanSaveDraft,"missing owner cost ceiling blocks simulation");
var snapshot=SimulationPolicy.SnapshotLines(evaluation);
var json=System.Text.Json.JsonSerializer.Serialize(snapshot);
Check(json.Contains("\"sku\":\"LED-WW\"")&&json.Contains("\"packs\":2")&&
    json.Contains("\"estimatedCents\":44000"),"snapshot only captures parts and costs");
Check(!json.Contains("buyer",StringComparison.OrdinalIgnoreCase)&&
    !json.Contains("payment",StringComparison.OrdinalIgnoreCase),
    "no customer or payment details in ledger");
Console.WriteLine("M6.3 simulation tests complete: NO vendor network activity.");
