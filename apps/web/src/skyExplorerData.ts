export type ExplorerLocation = {
  id: string
  name: string
  latitude: number
  longitude: number
  subtitle: string
}

export const EXPLORER_LOCATIONS: readonly ExplorerLocation[] = [
  { id: 'chicago', name: 'Chicago', latitude: 41.8781, longitude: -87.6298, subtitle: 'United States' },
  { id: 'london', name: 'London', latitude: 51.5074, longitude: -0.1278, subtitle: 'United Kingdom' },
  { id: 'tokyo', name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, subtitle: 'Japan' },
  { id: 'sydney', name: 'Sydney', latitude: -33.8688, longitude: 151.2093, subtitle: 'Australia' },
  { id: 'capetown', name: 'Cape Town', latitude: -33.9249, longitude: 18.4241, subtitle: 'South Africa' },
  { id: 'rio', name: 'Rio de Janeiro', latitude: -22.9068, longitude: -43.1729, subtitle: 'Brazil' },
  { id: 'reykjavik', name: 'Reykjavík', latitude: 64.1466, longitude: -21.9426, subtitle: 'Iceland' },
  { id: 'mumbai', name: 'Mumbai', latitude: 19.0760, longitude: 72.8777, subtitle: 'India' },
]

export type GlobePoint = { x: number; y: number; visible: boolean; depth: number }

const radians = (degrees: number) => degrees * Math.PI / 180
export function orthographicProject(
  latitude: number,
  longitude: number,
  centerLatitude: number,
  centerLongitude: number,
): GlobePoint {
  const lat = radians(latitude)
  const longDiff = radians(longitude - centerLongitude)
  const central = radians(centerLatitude)
  const x = Math.cos(lat) * Math.sin(longDiff)
  const y = Math.cos(central) * Math.sin(lat) - Math.sin(central) * Math.cos(lat) * Math.cos(longDiff)
  const depth = Math.sin(central) * Math.sin(lat) + Math.cos(central) * Math.cos(lat) * Math.cos(longDiff)
  return { x, y, depth, visible: depth >= -1e-8 }
}
export function normalizedLongitude(lon: number): number {
  return ((lon + 180) % 360 + 360) % 360 - 180
}
export function clampLatitude(latitude: number): number {
  return Math.max(-82, Math.min(82, latitude))
}

// Coarse, intentionally illustrative silhouettes: geographic borders, distance
// and coastlines are NOT survey-quality. Locations use actual coordinates.
export const CONTINENT_SILHOUETTES: readonly (readonly [number, number][])[] = [
  [[-168,67],[-148,71],[-130,70],[-120,61],[-100,54],[-83,49],[-66,49],[-61,44],[-71,35],[-81,25],[-80,15],[-93,15],[-100,22],[-111,30],[-118,32],[-124,40],[-135,54],[-159,60]],
  [[-81,12],[-74,10],[-61,13],[-51,5],[-47,-2],[-38,-8],[-39,-17],[-48,-26],[-53,-35],[-68,-56],[-74,-48],[-70,-28],[-81,-5]],
  [[-13,36],[-17,24],[-17,15],[-9,3],[12,-2],[15,-12],[11,-24],[19,-35],[31,-33],[35,-19],[43,-12],[51,11],[42,15],[32,32],[9,37]],
  [[-10,35],[-10,44],[-1,51],[10,55],[17,60],[30,70],[55,70],[75,60],[100,56],[135,50],[158,56],[178,60],[177,48],[151,43],[141,34],[129,23],[114,21],[106,10],[98,3],[104,-8],[113,-10],[120,-1],[121,15],[106,20],[96,13],[89,7],[80,8],[74,18],[69,24],[56,26],[45,39],[28,39],[20,45],[12,42],[5,36]],
  [[112,-11],[126,-15],[137,-13],[153,-24],[151,-34],[140,-39],[126,-34],[114,-23]],
  [[-53,59],[-42,59],[-39,74],[-47,83],[-59,79]],
  [[43,-13],[50,-13],[50,-25],[45,-26]],
]
