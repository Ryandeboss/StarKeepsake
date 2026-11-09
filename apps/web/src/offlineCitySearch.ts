import type { LocationCandidate } from './api'

/** Locally cached GeoNames city index.
 * Sourced from geonames.org CC BY 4.0, via the
 * serdarsalim/Time-Zoner-Converter-Chrome-Extension export. This file is
 * fetched only on explicit Search when the configured Azure Maps API fails.
 * It does NOT contain streets, addresses or arbitrary landmarks.
 */
export type OfflineCity = LocationCandidate & {
  timeZoneId: string
  offlineSource: 'geonames'
}
type CityRow = [
  name: string,
  ascii: string,
  timeZoneId: string,
  countryCode: string,
  population: number,
  latitude: number,
  longitude: number,
]
type Dataset = { source: string; license: string; cities: CityRow[] }

let datasetRequest: Promise<Dataset> | null = null
function getCityData(): Promise<Dataset> {
  if (!datasetRequest) {
    datasetRequest = fetch('/data/cities15000.json', { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw Error('The city search database could not be loaded.')
        return response.json() as Promise<Dataset>
      }).then(data => {
        if (!Array.isArray(data.cities) || data.cities.length < 1000) {
          throw Error('The city search database is incomplete.')
        }
        return data
      }).catch(error => {
        datasetRequest = null
        throw error
      })
  }
  return datasetRequest
}

export function isOfflineCity(location: LocationCandidate): location is OfflineCity {
  return (location as OfflineCity).offlineSource === 'geonames' &&
    typeof (location as OfflineCity).timeZoneId === 'string'
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
}

const countryName = new Intl.DisplayNames(['en'], { type: 'region' })

/** Pure matcher kept testable without requesting a 2MB browser asset. */
export function matchCityRows(
  rows: readonly CityRow[], phrase: string, count = 8,
): OfflineCity[] {
  const parts = phrase.split(',').map(normalize)
  const query = parts[0]
  const countryHint = parts[1] || ''
  if (query.length < 2) return []
  const found: Array<{ score: number; city: OfflineCity }> = []
  for (const row of rows) {
    const [name, alternate, timeZoneId, countryCode, population, latitude, longitude] = row
    if (!name || !timeZoneId || !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)) continue
    const names = [normalize(name), normalize(alternate)].filter(Boolean)
    if (!names.some(n => n.includes(query))) continue
    const normalizedCountry = normalize(countryName.of(countryCode) || countryCode)
    const countryMatches = !countryHint ||
      normalize(countryCode) === countryHint || normalizedCountry.includes(countryHint)
    const rank = names.some(n => n === query) ? 10000
      : names.some(n => n.startsWith(query)) ? 5000 : 2000
    const score = rank + Math.log10(Math.max(1,population)) * 50 +
      (countryMatches && countryHint ? 30000 : 0)
    found.push({
      score,
      city: {
        displayName: name,
        formattedAddress: `${name}, ${countryName.of(countryCode) || countryCode} · ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
        latitude, longitude, confidence: 'High',
        timeZoneId, offlineSource: 'geonames',
      },
    })
  }
  found.sort((a,b) => b.score - a.score)
  return found.slice(0, Math.max(1,Math.min(20,count))).map(item=>item.city)
}

export async function searchOfflineCities(query: string): Promise<OfflineCity[]> {
  const dataset = await getCityData()
  return matchCityRows(dataset.cities, query)
}
