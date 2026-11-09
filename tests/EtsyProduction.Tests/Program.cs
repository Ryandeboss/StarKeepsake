using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using StarKeepsake.Api;

static void Check(bool success, string name)
{
    if (!success) throw new Exception("FAIL " + name);
    Console.WriteLine("PASS " + name);
}
static JsonElement Parse(string input) => JsonDocument.Parse(input).RootElement.Clone();

const string design = "SK-0123456789ABCDEF";
var withId = Parse("""
    {"transaction_id":11,"listing_id":22,"quantity":1,"title":"Night sky frame",
     "variations":[{"property_id":42,"formatted_value":"Walnut"},
                   {"property_id":54,"formatted_name":"Your design reference","formatted_value":"Design ID: SK-0123456789ABCDEF"}]}
    """);
var (state, id) = EtsyProductionParser.Personalization(withId);
Check(state == "candidate" && id == design, "Exact Design ID from property_id 54");
Check(EtsyProductionParser.Personalization(Parse("""
    {"variations":[{"property_id":54,"formatted_value":"SK-0123456789ABCDEF"}]}
    """)).DesignId == design, "Bare personalization design reference");
Check(EtsyProductionParser.Personalization(Parse("""
    {"variations":[{"property_id":3,"formatted_value":"SK-0123456789ABCDEF"}]}
    """)).State == "missing", "Do not infer design ID from ordinary SKU variation");
Check(EtsyProductionParser.Personalization(Parse("""
    {"variations":[{"property_id":54,"formatted_value":"SK-0123456789ABCDEF"},
                   {"property_id":54,"formatted_value":"SK-2222222222222222"}]}
    """)).State == "ambiguous", "Multiple personalization entries require review");
Check(EtsyProductionParser.Personalization(Parse("""
    {"variations":[{"property_id":54,"formatted_value":"https://example.com/photo.jpg"}]}
    """)).State == "invalid", "File URL cannot become a design ID");
Check(EtsyProductionParser.Personalization(Parse("""
    {"variations":[{"property_id":54,"formatted_value":"SK-../customer"}]}
    """)).State == "invalid", "Reject invalid or path-like Design ID");

var transactionResult = EtsyProductionParser.ParseTransactions(Parse("""
    {"count":1,"results":[
      {"transaction_id":11,"listing_id":22,"quantity":1,"title":"Night sky frame",
       "variations":[{"property_id":54,"formatted_value":"SK-0123456789ABCDEF"}]}
    ]}
    """));
var transactionJson = JsonSerializer.SerializeToElement(transactionResult);
Check(transactionJson.GetArrayLength() == 1 &&
    transactionJson[0].GetProperty("candidate_design_id").GetString() == design,
    "Validated transaction transfers only its design reference");
Check(!transactionJson[0].TryGetProperty("buyer_email", out _),
    "No buyer personal information persisted in sanitized transaction");

var receipt = Parse("""
    {"receipt_id":101,"status":"paid","is_paid":true,
     "grandtotal":{"amount":14995,"divisor":100,"currency_code":"USD"},
     "created_timestamp":1794240000,
     "buyer_email":"PRIVATE-NO-STORE","name":"PRIVATE-NO-STORE",
     "message_from_buyer":"PRIVATE-NO-STORE",
     "refunds":[]}
    """);
var minimum = JsonSerializer.SerializeToElement(
    EtsyProductionParser.ParseReceipt(202, 101, receipt));
Check(minimum.GetProperty("is_paid").GetBoolean() &&
    minimum.GetProperty("grandtotal_amount").GetInt64() == 14995 &&
    minimum.GetProperty("grandtotal_divisor").GetInt32() == 100,
    "Paid receipt retains Etsy Money amount and divisor");
Check(!minimum.TryGetProperty("buyer_email", out _) &&
    !minimum.TryGetProperty("name", out _) &&
    !minimum.TryGetProperty("message_from_buyer", out _),
    "PII is excluded from the order record");
try { EtsyProductionParser.ParseReceipt(202, 102, receipt); throw new Exception("wrong receipt accepted"); }
catch (InvalidDataException) { Console.WriteLine("PASS Incorrect Etsy receipt identity rejected"); }
var refunded = Parse("""
    {"receipt_id":101,"status":"partially refunded","is_paid":true,
     "refunds":[{"refund_id":10}],"grandtotal":{"amount":14995,"divisor":100,"currency_code":"USD"}}
    """);
Check(JsonSerializer.SerializeToElement(EtsyProductionParser.ParseReceipt(202,101,refunded))
    .GetProperty("has_refunds").GetBoolean(), "Refunds flagged for review");

const string eventBody = """{"event_type":"order.paid","resource_url":"https://api.etsy.com/v3/application/shops/202/receipts/101","shop_id":"202"}""";
var webhookSecretBytes = RandomNumberGenerator.GetBytes(32);
var webhookSecret = "whsec_" + Convert.ToBase64String(webhookSecretBytes);
var now = DateTimeOffset.UtcNow;
var timestamp = now.ToUnixTimeSeconds().ToString();
var webhookId = "msg_0123";
var signedText = webhookId + "." + timestamp + "." + eventBody;
var signature = "v1," + Convert.ToBase64String(HMACSHA256.HashData(webhookSecretBytes,
    Encoding.UTF8.GetBytes(signedText)));
Check(EtsyWebhookVerifier.Verify(webhookSecret,webhookId,timestamp,signature,
    Encoding.UTF8.GetBytes(eventBody),now), "Etsy HMAC-SHA256 with v1 signature accepted");
Check(!EtsyWebhookVerifier.Verify(webhookSecret,webhookId,timestamp,signature,
    Encoding.UTF8.GetBytes(eventBody.Replace("order.paid","order.canceled")),now),
    "Altered webhook body rejected");
Check(!EtsyWebhookVerifier.Verify(webhookSecret,webhookId,timestamp,signature,
    Encoding.UTF8.GetBytes(eventBody),now.AddMinutes(10)),
    "Stale webhook rejected");
Check(EtsyWebhookVerifier.TryExtractReceipt(Parse(eventBody),202,
    out var extracted,out var eventType) &&
    extracted==101 && eventType=="order.paid",
    "Webhook resource verified against linked Etsy shop");
Check(!EtsyWebhookVerifier.TryExtractReceipt(Parse(eventBody),203,
    out _,out _), "Foreign Etsy shop rejected");
Check(!EtsyWebhookVerifier.TryExtractReceipt(Parse(
    """{"event_type":"order.paid","resource_url":"https://evil.com/v3/application/shops/202/receipts/101","shop_id":"202"}"""),202,
    out _,out _), "Arbitrary webhook resource URL rejected");
Console.WriteLine("All M2 Etsy production contract tests passed.");
