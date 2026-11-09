using System.Text.Json;
using StarKeepsake.Api;

static void Check(bool okay, string message)
{
    if (!okay) throw new Exception("FAIL: " + message);
    Console.WriteLine("PASS: " + message);
}

var ids = Enumerable.Range(0, 300).Select(_ => DesignSecurity.NewId()).ToArray();
Check(ids.All(DesignSecurity.ValidId), "IDs use public SKU-safe format");
Check(ids.Distinct().Count() == ids.Length, "random IDs have no collisions in test batch");
Check(!DesignSecurity.ValidId("SK-not-safe/../../"), "path traversal rejected");
var accessKey = DesignSecurity.NewAccessKey();
var hash = DesignSecurity.HashKey(accessKey);
Check(accessKey.Length == 43 && hash.Length == 32, "private access key has 256-bit entropy");
Check(DesignSecurity.MatchesKey(accessKey, hash), "private key matches its hash");
Check(!DesignSecurity.MatchesKey(DesignSecurity.NewAccessKey(), hash),
    "wrong access key cannot read customer designs");
Check(!DesignSecurity.MatchesKey("", hash), "missing access key rejected");

Check(DesignSecurity.IsImage(new byte[]{137,80,78,71,13,10,26,10,1}, "image/png"),
    "PNG header accepted");
Check(DesignSecurity.IsImage(new byte[]{0xff,0xd8,0xff,0x00}, "image/jpeg"),
    "JPG header accepted");
Check(DesignSecurity.IsImage(
    System.Text.Encoding.ASCII.GetBytes("RIFF0000WEBPVP8 "), "image/webp"),
    "WebP header accepted");
Check(!DesignSecurity.IsImage(System.Text.Encoding.UTF8.GetBytes("<svg></svg>"),
    "image/png"), "content type spoofing rejected");

var spec = JsonSerializer.Serialize(new {
    schemaVersion="1.5", designId="design-placeholder",
    moment=new {date="2026-11-09",location=new {displayName="Chicago"}},
    astronomy=new {catalog="hipparcos"},
    stars=Array.Empty<object>(),
    photo=new {assetId="local-photo"}
});
var above = JsonSerializer.Serialize(new {layout="above",finish="oak"});
var within = JsonSerializer.Serialize(new {layout="within",finish="walnut"});
Check(DesignSecurity.ValidDesignJson(spec, above, false), "complete sky and above-photo design accepted");
Check(!DesignSecurity.ValidDesignJson(spec, within, false), "within-photo design needs foreground");
Check(DesignSecurity.ValidDesignJson(spec, within, true), "prepared foreground permits within-photo design");
Check(!DesignSecurity.ValidDesignJson(spec.Replace("1.5", "1.2"), above, false),
    "unknown schema version rejected");
Check(!DesignSecurity.ValidDesignJson("{}", above, false),
    "incomplete design rejected");

var options = new DesignPersistenceOptions {
    SqlConnectionString = "Server=tcp:test.database.windows.net;Database=test;",
    StorageConnectionString = "UseDevelopmentStorage=true",
    StorageContainerName = "starkeepsake-artwork"
};
Check(options.IsConfigured, "configured SQL + private artwork storage");
options.SqlConnectionString = "";
Check(!options.IsConfigured, "missing SQL fails closed");
Console.WriteLine("All M1 design contract tests passed.");
