using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StarKeepsake.Api;

// Only Etsy-verified, non-PII fields travel to our production database.
public static class EtsyProductionParser
{
    private static readonly Regex DesignIdPattern = new(
        @"^SK-[0-9A-F]{16}$", RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex PersonalizationPattern = new(
        @"^\s*(?:(?:Design\s*ID)\s*[:#-]\s*)?(SK-[0-9A-F]{16})\s*$",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string? String(JsonElement value, string field)
    {
        if (value.ValueKind != JsonValueKind.Object ||
            !value.TryGetProperty(field, out var item) ||
            item.ValueKind != JsonValueKind.String) return null;
        return item.GetString();
    }
    public static long? Long(JsonElement value, string field)
    {
        if (value.ValueKind != JsonValueKind.Object ||
            !value.TryGetProperty(field, out var item) ||
            item.ValueKind != JsonValueKind.Number ||
            !item.TryGetInt64(out var number)) return null;
        return number;
    }
    public static bool? Bool(JsonElement value, string field)
    {
        if (value.ValueKind != JsonValueKind.Object ||
            !value.TryGetProperty(field, out var item)) return null;
        return item.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null
        };
    }
    public static JsonElement? Field(JsonElement value, string field)
    {
        if (value.ValueKind == JsonValueKind.Object &&
            value.TryGetProperty(field, out var child)) return child;
        return null;
    }
    public static DateTimeOffset? UtcFromUnix(JsonElement value, string field)
    {
        var unix = Long(value, field);
        if (!unix.HasValue || unix <= 0) return null;
        try { return DateTimeOffset.FromUnixTimeSeconds(unix.Value); }
        catch (ArgumentOutOfRangeException) { return null; }
    }

    public static (string State, string? DesignId) Personalization(JsonElement transaction)
    {
        var choices = Field(transaction, "variations");
        if (choices is null || choices.Value.ValueKind != JsonValueKind.Array)
            return ("missing", null);

        var personalized = choices.Value.EnumerateArray().Where(v =>
            Long(v, "property_id") == 54).ToArray();
        if (personalized.Length == 0) return ("missing", null);
        if (personalized.Length > 1) return ("ambiguous", null);

        var raw = String(personalized[0], "formatted_value");
        if (string.IsNullOrWhiteSpace(raw) || raw.Length > 128 ||
            raw.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return ("invalid", null);
        var match = PersonalizationPattern.Match(raw);
        if (!match.Success) return ("invalid", null);

        var id = match.Groups[1].Value.ToUpperInvariant();
        return DesignIdPattern.IsMatch(id) ? ("candidate", id) : ("invalid", null);
    }

    public static object ParseReceipt(long shopId, long receiptId, JsonElement receipt)
    {
        if (shopId < 1 || receiptId < 1 ||
            Long(receipt, "receipt_id") != receiptId)
            throw new InvalidDataException("Unexpected Etsy receipt identity.");

        var status = String(receipt, "status");
        var isPaid = Bool(receipt, "is_paid");
        if (status is null || status.Length > 80 || !isPaid.HasValue)
            throw new InvalidDataException("Etsy receipt has no verified payment status.");

        var canceled = status.Equals("canceled", StringComparison.OrdinalIgnoreCase) ||
            Bool(receipt, "was_canceled") == true;
        var refunds = Field(receipt, "refunds");
        var hasRefunds = (refunds is { ValueKind: JsonValueKind.Array } &&
            refunds.Value.GetArrayLength() > 0) ||
            status is "fully refunded" or "partially refunded";
        var money = Field(receipt, "grandtotal");
        long? totalAmount = null;
        int? divisor = null;
        string? currency = null;
        if (money is { ValueKind: JsonValueKind.Object })
        {
            totalAmount = Long(money.Value, "amount");
            var denominator = Long(money.Value, "divisor");
            if (denominator is > 0 and <= 1000000)
                divisor = (int)denominator.Value;
            currency = String(money.Value, "currency_code");
            if (currency is not null && !Regex.IsMatch(currency, "^[A-Z]{3}$"))
                currency = null;
        }

        return new
        {
            shop_id = shopId,
            receipt_id = receiptId,
            etsy_status = status,
            is_paid = isPaid.Value,
            is_canceled = canceled,
            has_refunds = hasRefunds,
            grandtotal_amount = totalAmount,
            grandtotal_divisor = divisor,
            currency_code = currency,
            created_at_etsy = (UtcFromUnix(receipt, "created_timestamp") ??
                UtcFromUnix(receipt, "create_timestamp"))?.ToString("O", CultureInfo.InvariantCulture),
            updated_at_etsy = (UtcFromUnix(receipt, "updated_timestamp") ??
                UtcFromUnix(receipt, "update_timestamp"))?.ToString("O", CultureInfo.InvariantCulture)
        };
    }

    public static object[] ParseTransactions(JsonElement transactions)
    {
        var records = transactions.ValueKind == JsonValueKind.Array ? transactions :
            Field(transactions, "results") ?? default;
        if (records.ValueKind != JsonValueKind.Array ||
            records.GetArrayLength() > 100)
            throw new InvalidDataException("Unexpected Etsy transaction list.");

        var ids = new HashSet<long>();
        var output = new List<object>();
        foreach (var transaction in records.EnumerateArray())
        {
            var id = Long(transaction, "transaction_id");
            var quantity = Long(transaction, "quantity");
            if (!id.HasValue || id < 1 || !ids.Add(id.Value) ||
                !quantity.HasValue || quantity is < 1 or > 1000)
                throw new InvalidDataException("Invalid or repeated Etsy transaction.");

            var (state, designId) = Personalization(transaction);
            var title = String(transaction, "title") ?? "Untitled";
            output.Add(new
            {
                transaction_id = id.Value,
                listing_id = Long(transaction, "listing_id"),
                title = title.Length > 180 ? title[..180] : title,
                quantity = (int)quantity.Value,
                reference_state = state,
                candidate_design_id = designId
            });
        }
        return output.ToArray();
    }
}

// Etsy signs the exact bytes, not a re-serialized JSON payload.
public static class EtsyWebhookVerifier
{
    public static bool Verify(string? secret, string? id, string? timestamp,
        string? signature, ReadOnlySpan<byte> rawBody, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(secret) || !secret.StartsWith("whsec_", StringComparison.Ordinal) ||
            id is null || id.Length is < 1 or > 128 ||
            timestamp is null || timestamp.Length > 20 ||
            signature is null || signature.Length > 1024 ||
            rawBody.Length is 0 or > 16 * 1024 ||
            !long.TryParse(timestamp, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds))
            return false;

        DateTimeOffset signedAt;
        try { signedAt = DateTimeOffset.FromUnixTimeSeconds(seconds); }
        catch (ArgumentOutOfRangeException) { return false; }
        if (Math.Abs((now - signedAt).TotalSeconds) > 300) return false;
        byte[] key;
        try { key = Convert.FromBase64String(secret[6..]); }
        catch (FormatException) { return false; }
        if (key.Length < 16) return false;

        var prefix = System.Text.Encoding.UTF8.GetBytes(id + "." + timestamp + ".");
        var signed = new byte[prefix.Length + rawBody.Length];
        prefix.CopyTo(signed, 0);
        rawBody.CopyTo(signed.AsSpan(prefix.Length));
        var expected = System.Security.Cryptography.HMACSHA256.HashData(key, signed);
        var expectedBase64 = Convert.ToBase64String(expected);
        // Etsy may send multiple versioned signatures separated by a space.
        foreach (var candidate in signature.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            var value = candidate.StartsWith("v1,", StringComparison.Ordinal) ? candidate[3..] : candidate;
            if (value.Length == expectedBase64.Length &&
                System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                    System.Text.Encoding.ASCII.GetBytes(value),
                    System.Text.Encoding.ASCII.GetBytes(expectedBase64)))
                return true;
        }
        return false;
    }

    public static bool TryExtractReceipt(
        JsonElement payload, long expectedShopId, out long receiptId, out string eventType)
    {
        receiptId = 0;
        eventType = EtsyProductionParser.String(payload, "event_type") ?? "";
        if (eventType is not ("order.paid" or "order.canceled" or
                             "order.shipped" or "order.delivered"))
            return false;

        // Etsy webhooks may use numeric or string shop_id.
        var shop = EtsyProductionParser.Long(payload, "shop_id");
        if (!shop.HasValue && long.TryParse(EtsyProductionParser.String(payload, "shop_id"),
            NumberStyles.None, CultureInfo.InvariantCulture, out var parsed))
            shop = parsed;
        if (shop != expectedShopId || expectedShopId <= 0) return false;
        var url = EtsyProductionParser.String(payload, "resource_url");
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            uri.Scheme != "https" || uri.Host != "api.etsy.com" ||
            uri.Query.Length > 0 || uri.Fragment.Length > 0 ||
            uri.UserInfo.Length > 0 || uri.Port != 443)
            return false;
        var regex = Regex.Match(uri.AbsolutePath,
            @"^/v3/application/shops/([0-9]+)/receipts/([0-9]+)$",
            RegexOptions.CultureInvariant);
        return regex.Success &&
            long.TryParse(regex.Groups[1].Value, out var urlShopId) &&
            urlShopId == expectedShopId &&
            long.TryParse(regex.Groups[2].Value, out receiptId) &&
            receiptId > 0;
    }
}
