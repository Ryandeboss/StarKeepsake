export type ChapterIndex = 0 | 1 | 2 | 3 | 4
export type NavigationStage = 'welcome' | 'detecting' | 'choice' | 'refine' | 'moment' | 'preview' | 'home'
export type ChapterState = {
  hasPhoto: boolean
  hasDimensions: boolean
  detectionReady: boolean
  placement: 'above' | 'within'
  hasForeground: boolean
  skyCurrent: boolean
}
export type ChapterDestination = { stage: NavigationStage; notice: string | null }

/** Show any chapter on demand; if its inputs are incomplete, show the nearest
 * useful prerequisite instead of an empty sky or a misleading finished order. */
export function chapterDestination(index: ChapterIndex, state: ChapterState): ChapterDestination {
  if (index === 0) return {stage:'welcome',notice:null}
  if (!state.hasPhoto) return {stage:'welcome',notice:'Choose a photograph first to unlock the workshop.'}
  if (!state.hasDimensions) return {stage:'detecting',notice:'Your photo is still preparing. You can replace it now.'}
  if (!state.detectionReady) return {stage:'detecting',notice:'First, let us check the photograph for sky.'}
  if (index === 1) return {stage:'choice',notice:null}
  if (state.placement === 'within' && !state.hasForeground) {
    return {stage:'refine',notice:'Save your polished horizon first; then you can jump to any later chapter.'}
  }
  if (index === 2) return {stage:'moment',notice:null}
  if (!state.skyCurrent) {
    return {stage:'moment',notice:'Confirm the date, time and location, then reveal your night before continuing.'}
  }
  return {stage:index === 3 ? 'preview' : 'home',notice:null}
}
