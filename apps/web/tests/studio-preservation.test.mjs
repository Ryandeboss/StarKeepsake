import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
const file = (name) => readFileSync(new URL(name, import.meta.url), 'utf8')
const studio = file('../src/pages/ExperiencePage.tsx')
const dashboard = file('../src/pages/ProductionDashboardPage.tsx')
test('Chapter 02 keeps the specific Change photograph control from studio UX', () => {
  assert.match(studio, /className="at-detection-change-photo"/)
  assert.match(studio, /onClick=\{openPhotoReplacement\}/)
})
test('local draft, sky editing and guided chapter navigation survive M3 merge', () => {
  assert.match(studio, /readLocalWorkshopDraft/)
  assert.match(studio, /SkyMaskEditor/)
  assert.match(studio, /chapterDestination/)
})
test('M3 customer finish quotes and price revision exist alongside UX', () => {
  assert.match(studio, /frameQuoteFor\(frameQuotes,finish\)/)
  assert.match(studio, /Refresh estimate/)
  assert.match(studio, /Two-tone walnut/)
  assert.match(studio, /Matte black/)
})
test('Production dashboard keeps saved-design section and M3 materials panel', () => {
  assert.match(dashboard, /Recently saved designs/)
  assert.match(dashboard, /<MaterialsPanel adminKey=\{key\} \/>/)
})

test('Chapter 05 owns physical light editing and the showroom visualizes selected LEDs', () => {
  const chapter4=studio.split('CHAPTER 04 / THE OBSERVATORY WORKSHOP')[1].split('CHAPTER 05 / BRING YOUR NIGHT HOME')[0]
  const chapter5=studio.split('CHAPTER 05 / BRING YOUR NIGHT HOME')[1]
  assert.doesNotMatch(chapter4,/className="at-physical-choices"/)
  assert.match(chapter5,/className="at-physical-choices"/)
  assert.match(chapter5,/className="at-home-star-edit-preview"/)
  assert.ok(chapter5.includes('editingPhysicalStars={true}'))
  assert.ok(chapter5.includes('stars={!physicalInspector||physicalOnly?(activeDesign.physicalStars??[]):design.stars}'))
  assert.ok(chapter5.includes('Restore automatic LED selection'))
  assert.ok(chapter5.includes('No stars currently qualify for an LED'))
})
test('a newly calculated sky clears stale manual HIP selections', () => {
  assert.ok(studio.includes('physicalStarOverrides:undefined,moment,astronomy:calculated.calculation'))
})

test('Chapter 05 restore choices displays live selected count and replayable success feedback', () => {
  assert.match(studio,/setPhysicalRestoreId\(id=>id\+1\)/)
  assert.match(studio,/key=\{physicalRestoreId\} className="at-auto-restored" role="status"/)
  assert.match(studio,/Automatic choices restored\./)
  assert.match(studio,/physicalView\.physicalStars\.length\} physical lights selected/)
  assert.match(studio,/setPhysicalRestoreId\(0\)/)
  const chapter5=studio.split('CHAPTER 05 / BRING YOUR NIGHT HOME')[1]
  assert.match(chapter5,/Restore automatic choices/)
  assert.equal((chapter5.match(/className="at-auto-restored"/g)||[]).length,2)
})
