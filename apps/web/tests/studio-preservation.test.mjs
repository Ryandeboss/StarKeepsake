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
