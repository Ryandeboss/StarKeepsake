# M4 Location + Moment

M4 resolves the customer's memory into astronomy-ready location/time metadata without calculating stars yet.

## Flow

1. The customer enters a date and either a local time or marks the exact time as unknown.
2. The customer searches for a city, address, landmark, or venue.
3. The ASP.NET API calls Azure Maps Geocoding and returns concrete candidate locations.
4. The customer selects the intended location.
5. The API calls Azure Maps Timezone for that latitude/longitude.
6. If an exact local time is known, the API converts the wall-clock time to UTC using the returned IANA time zone.
7. The frontend stores only the resolved result in the canonical DesignSpec.

## Canonical moment rules

- Free-form location text is not sufficient for astronomy.
- Latitude and longitude come from the selected Azure Maps result.
- The IANA time zone ID is stored with the selected location.
- `localDateTime` is stored without an offset because the IANA zone is stored separately.
- `utcDateTime` is the canonical instant used by later astronomy work.
- If `exactTimeUnknown` is true, M4 leaves `time`, `localDateTime`, and `utcDateTime` null. M5 must choose an explicit astronomy policy rather than silently inventing a time.
- DST spring-forward gaps are rejected.
- DST fall-back ambiguous times are rejected for now so the customer does not receive a silently incorrect sky.

## API

- `GET /api/locations/search?q=...`
- `POST /api/moments/resolve`

Azure Maps credentials stay in the API Container App as an Azure secret. The browser never receives the subscription key.

## M4 non-goals

- Star catalog lookup
- Sky projection
- Constellation calculation
- Persistence
- Order IDs or Etsy personalization codes
