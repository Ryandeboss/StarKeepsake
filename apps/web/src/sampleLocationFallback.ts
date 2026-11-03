import type { LocationCandidate } from './api'
import type { DesignSpec } from './designSpec'

/** Preview-only city fallback while Azure Maps is not configured in staging.
 * Arbitrary-address search still requires a server-side Azure Maps key. */
export type SampleLocation = LocationCandidate & { timeZoneId: string }
export const SAMPLE_LOCATIONS: readonly SampleLocation[] = [
  { displayName: 'Chicago, Illinois', formattedAddress: 'Chicago, IL, United States',
    latitude: 41.8781, longitude: -87.6298, timeZoneId: 'America/Chicago', confidence: 'High' },
  { displayName: 'New York City', formattedAddress: 'New York, NY, United States',
    latitude: 40.7128, longitude: -74.006, timeZoneId: 'America/New_York', confidence: 'High' },
  { displayName: 'Los Angeles', formattedAddress: 'Los Angeles, CA, United States',
    latitude: 34.0522, longitude: -118.2437, timeZoneId: 'America/Los_Angeles', confidence: 'High' },
  { displayName: 'London', formattedAddress: 'London, United Kingdom',
    latitude: 51.5074, longitude: -0.1278, timeZoneId: 'Europe/London', confidence: 'High' },
  { displayName: 'Paris', formattedAddress: 'Paris, France',
    latitude: 48.8566, longitude: 2.3522, timeZoneId: 'Europe/Paris', confidence: 'High' },
  { displayName: 'Tokyo', formattedAddress: 'Tokyo, Japan',
    latitude: 35.6762, longitude: 139.6503, timeZoneId: 'Asia/Tokyo', confidence: 'High' },
  { displayName: 'Sydney', formattedAddress: 'Sydney, Australia',
    latitude: -33.8688, longitude: 151.2093, timeZoneId: 'Australia/Sydney', confidence: 'High' },
  { displayName: 'Cape Town', formattedAddress: 'Cape Town, South Africa',
    latitude: -33.9249, longitude: 18.4241, timeZoneId: 'Africa/Johannesburg', confidence: 'High' },
] as const

export function isSampleLocation(location: LocationCandidate): location is SampleLocation {
  return 'timeZoneId' in location && typeof location.timeZoneId === 'string' &&
    SAMPLE_LOCATIONS.some(item =>
      item.latitude === location.latitude && item.longitude === location.longitude &&
      item.timeZoneId === (location as SampleLocation).timeZoneId)
}

function localParts(at: Date, timeZoneId: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZoneId, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(at).map(p => [p.type, p.value]))
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
  }
}

/** Resolve a trusted sample city's wall-clock time, handling DST gaps/folds.
 * This never approximates a custom location's time zone. */
export function resolveSampleMoment(
  date: string, time: string | null, exactTimeUnknown: boolean,
  location: SampleLocation,
): DesignSpec['moment'] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Choose a valid calendar date.')
  const [year,month,day] = date.split('-').map(Number)
  const dayStart = Date.UTC(year,month-1,day)
  if (year < 1850 || year > 2149 || !Number.isFinite(dayStart) ||
    new Date(dayStart).toISOString().slice(0,10) !== date) {
    throw Error('Choose a valid date between 1850 and 2149.')
  }
  const locationInfo: NonNullable<DesignSpec['moment']['location']> = {
    query: location.displayName, displayName: location.displayName,
    formattedAddress: location.formattedAddress,
    latitude: location.latitude, longitude: location.longitude,
    timeZoneId: location.timeZoneId, confidence: 'High',
  }
  if (exactTimeUnknown) return {
    date, time: null, exactTimeUnknown: true, location: locationInfo,
    localDateTime: null, utcDateTime: null,
  }
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw Error('Choose a valid local time.')
  }
  const [hour,minute] = time.split(':').map(Number)
  const naiveUtc = Date.UTC(year,month-1,day,hour,minute)
  const offsets = new Set<number>()
  for (const delta of [-36,0,36]) {
    const probe = naiveUtc + delta * 3600000
    const p = localParts(new Date(probe), location.timeZoneId)
    const representedLocal = Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)
    offsets.add(representedLocal - probe)
  }
  const matches = Array.from(offsets).map(offset => naiveUtc - offset).filter(candidate => {
    const p = localParts(new Date(candidate), location.timeZoneId)
    return p.year === year && p.month === month && p.day === day &&
      p.hour === hour && p.minute === minute && p.second === 0
  })
  if (!matches.length) throw Error('This local time does not exist due to daylight saving. Try another time.')
  if (matches.length > 1) throw Error('This local time occurs twice due to daylight saving. Choose a different time.')
  return {
    date, time, exactTimeUnknown: false,
    location: locationInfo, localDateTime: date + 'T' + time + ':00',
    utcDateTime: new Date(matches[0]).toISOString(),
  }
}
