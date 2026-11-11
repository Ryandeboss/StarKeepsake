using StarKeepsake.Api;
static void Check(bool value,string name){if(!value)throw new Exception(name);Console.WriteLine("PASS "+name);}
Check(MaterialValidation.ValidSku("WOOD-WALNUT"),"uppercase material SKU");
Check(!MaterialValidation.ValidSku("../SECRET"),"path-like SKU rejected");
Check(!MaterialValidation.ValidSku("wood-walnut"),"lowercase SKU rejected");
Check(MaterialValidation.ValidMoney(null)&&MaterialValidation.ValidMoney(0)&&!MaterialValidation.ValidMoney(-1),"unknown and nonnegative costs");
var part=new MaterialDraft("WOOD-WALNUT","Walnut frame rail","frame","ft",null,2,"Example","https://example.com/rails",null);
Check(MaterialValidation.ValidMaterial(part),"unknown cost allowed (no invented price)");
Check(!MaterialValidation.ValidMaterial(part with{SupplierUrl="http://example.com/rails"}),"supplier URL requires HTTPS");
Check(!MaterialValidation.ValidMaterial(part with{UnitCostCents=-50}),"negative pricing rejected");
var recipe=new RecipeDraft("walnut-standard","Walnut standard frame","walnut",[
 new RecipeLineDraft("WOOD-WALNUT",4,10)]);
Check(MaterialValidation.ValidRecipeDraft(recipe),"valid per-finish recipe");
Check(!MaterialValidation.ValidRecipeDraft(recipe with{Lines=[
 new RecipeLineDraft("WOOD-WALNUT",4,0),new RecipeLineDraft("WOOD-WALNUT",5,0)]}),"duplicate SKU in one recipe rejected");
Check(!MaterialValidation.ValidRecipeDraft(recipe with{Finish="mahogany"}),"unsupported finish rejected");
Check(!MaterialValidation.ValidRecipeDraft(recipe with{Lines=[new RecipeLineDraft("WOOD-WALNUT",0,10)]}),
"zero quantity rejected");
Console.WriteLine("M3 materials validation tests passed.");

Check(ProcurementValidation.ValidQty(1.125m),"fractional received quantities allowed");
Check(!ProcurementValidation.ValidQty(0),"zero not allowed for purchase receipts");
Check(ProcurementValidation.ValidQty(0,true),"zero allows stock release");
Check(!ProcurementValidation.ValidQty(1.0005m),"precision limited to three decimals");
Check(ProcurementValidation.ValidSupplierPurchase(
  new SupplierPurchaseDraft(Guid.NewGuid(),"FRAME-WALNUT",1,"ORDER-001",12345)),"valid supplier record");
Check(!ProcurementValidation.ValidSupplierPurchase(
  new SupplierPurchaseDraft(Guid.Empty,"FRAME-WALNUT",1,"ORDER-001",12345)),"reject empty purchase ID");
