import { projectObserverStar } from './skyImmersiveData.ts'

// An original geographic *impression* of each city, not a measured skyline,
// precise viewing bearing, night photograph, or promise of landmark visibility.
export const OBSERVER_SCENES = {
  chicago: { title: 'Chicago lakefront', terrain: 'lake', landmark: 'Willis Tower', seed: 11 },
  london: { title: 'London and the Thames', terrain: 'river', landmark: 'Elizabeth Tower', seed: 23 },
  tokyo: { title: 'Tokyo skyline', terrain: 'mountains', landmark: 'Tokyo Skytree', seed: 37 },
  sydney: { title: 'Sydney Harbour', terrain: 'harbour', landmark: 'Harbour Bridge and Opera House', seed: 41 },
  capetown: { title: 'Cape Town foothills', terrain: 'mountains', landmark: 'Table Mountain', seed: 53 },
  rio: { title: 'Rio de Janeiro bay', terrain: 'harbour', landmark: 'Sugarloaf Mountain', seed: 67 },
  reykjavik: { title: 'Reykjavík coast', terrain: 'coast', landmark: 'Hallgrímskirkja', seed: 71 },
  mumbai: { title: 'Mumbai waterfront', terrain: 'coast', landmark: 'Gateway of India', seed: 83 },
} as const

export type SceneId = keyof typeof OBSERVER_SCENES
export function getObserverScene(id: string) {
  return OBSERVER_SCENES[id as SceneId] ?? OBSERVER_SCENES.chicago
}

/** Same altitude/azimuth projection as the real calculated sky. */
export function observerHorizonY(heading: number, pitch: number, fov: number): number {
  return projectObserverStar(heading, 0, heading, pitch, fov).y
}
