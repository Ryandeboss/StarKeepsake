using System.Text.Json;
using StarKeepsake.Api;
static void Check(bool x,string label){if(!x)throw new Exception(label);Console.WriteLine("PASS "+label);}
Check(AmazonMappingValidation.Valid(new AmazonMappingDraft("FRAME-WALNUT","B001ABC123",2,12000,true)),
 "valid ASIN and unit cap");
Check(!AmazonMappingValidation.Valid(new AmazonMappingDraft("FRAME-WALNUT","invalid",2,12000,true)),
 "invalid ASIN rejected");
Check(!AmazonMappingValidation.Valid(new AmazonMappingDraft("FRAME-WALNUT","B001ABC123",0,12000,true)),
 "zero-pack rejection");
Check(!AmazonMappingValidation.Valid(new AmazonMappingDraft("FRAME-WALNUT","B001ABC123",1,-1,true)),
 "negative cap rejected");
using var input=JsonDocument.Parse("""
{"parts":[{"sku":"FRAME-WALNUT","name":"Walnut frame","unit":"each","unit_cost_cents":11000,"on_hand":1}],
"jobs":[{"shop_id":1,"receipt_id":10,"transaction_id":100,"status":"awaiting_review"},
{"shop_id":1,"receipt_id":11,"transaction_id":101,"status":"awaiting_review"},
{"shop_id":1,"receipt_id":12,"transaction_id":102,"status":"hold"}],
"receipts":[{"shop_id":1,"receipt_id":10,"is_paid":true,"is_canceled":false,"has_refunds":false,"etsy_status":"paid"},
{"shop_id":1,"receipt_id":11,"is_paid":false,"is_canceled":false,"has_refunds":false,"etsy_status":"open"},
{"shop_id":1,"receipt_id":12,"is_paid":true,"is_canceled":true,"has_refunds":false,"etsy_status":"canceled"}],
"plans":[{"shop_id":1,"receipt_id":10,"transaction_id":100,"status":"draft"},
{"shop_id":1,"receipt_id":11,"transaction_id":101,"status":"draft"},
{"shop_id":1,"receipt_id":12,"transaction_id":102,"status":"draft"}],
"lines":[{"shop_id":1,"receipt_id":10,"transaction_id":100,"sku":"FRAME-WALNUT","quantity_required":5},
{"shop_id":1,"receipt_id":11,"transaction_id":101,"sku":"FRAME-WALNUT","quantity_required":99},
{"shop_id":1,"receipt_id":12,"transaction_id":102,"sku":"FRAME-WALNUT","quantity_required":999}],
"purchases":[{"sku":"FRAME-WALNUT","status":"partially_received","quantity_ordered":2,"quantity_received":1}],
"allocations":[{"shop_id":1,"receipt_id":10,"transaction_id":100,"sku":"FRAME-WALNUT","quantity_allocated":1}]}
""");
using var map=JsonDocument.Parse("""
[{"sku":"FRAME-WALNUT","asin":"B001ABC123","pack_quantity":2,
"max_unit_price_cents":12000,"enabled":true}]
""");
var plan=ProcurementPlanner.Build(input.RootElement,map.RootElement);
Check(plan.ActivePaidJobs==1,"paid jobs counted; unpaid/refunded/held excluded");
Check(plan.Lines.Length==1,"one shortage SKU");
var line=plan.Lines[0];
Check(line.Required==5&&line.OnHand==1&&line.OnOrder==1,"demand and physical/incoming separated");
Check(line.Shortfall==4&&line.NetToOrder==3,"subtract open orders to avoid double buying");
Check(line.PacksToBuy==2&&line.PackQuantity==2,"pack quantities round up");
Check(line.EstimatedPurchaseCents==44000,"only M3 catalog price estimate");
Check(line.Blocks.Contains("LIVE_AMAZON_OFFER_UNVERIFIED")&&
      line.Blocks.Contains("BUYING_ACCOUNT_NOT_AUTHORIZED"),"live checkout blocked");
Check(!plan.CheckoutEnabled&&!plan.OffersVerified&&plan.Mode=="simulation",
    "no order action allowed");
using var noMap=JsonDocument.Parse("[]");
var missing=ProcurementPlanner.Build(input.RootElement,noMap.RootElement);
Check(missing.Lines[0].Blocks.Contains("UNMAPPED_ASIN"),"unmapped items blocked");
Check(missing.EstimatedMaterialsCents==null,"unknown pack prevents invented quote");
using var noOrders=JsonDocument.Parse("""
{"parts":[],"jobs":[],"plans":[],"lines":[],"purchases":[],"receipts":[]}
""");
Check(ProcurementPlanner.Build(noOrders.RootElement,noMap.RootElement).Lines.Length==0,
 "no unpaid/unplanned purchasing");
