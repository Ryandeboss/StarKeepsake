/** The browser detector's positive-sky threshold matches its UI indicator. */
export type SkyPlacement = 'above' | 'within'
export function recommendedSkyPlacement(skyPercent: number): SkyPlacement {
  return Number.isFinite(skyPercent) && skyPercent >= 3 ? 'within' : 'above'
}
