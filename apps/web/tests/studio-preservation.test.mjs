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
test('Chapter 05 keeps frame finishes and quote metadata but displays no price or extra sales heading', () => {
  assert.match(studio, /frameQuoteFor\(frameQuotes,finish\)/)
  const chapter5=studio.split('CHAPTER 05 / BRING YOUR NIGHT HOME')[1]
  assert.match(chapter5,/Two-tone walnut/)
  assert.match(chapter5,/Matte black/)
  assert.doesNotMatch(chapter5,/Make it|at-frame-quote|at-frame-option-price|Refresh estimate|Price on request|PRICE ESTIMATE|moneyUsd/)
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

const ownerFiles=file('../src/pages/OwnerProductionFiles.tsx')
const paidApi=file('../../api/EtsyProduction.cs')
test('paid-only owner files are linked to authenticated job and three variants',()=>{
  assert.match(dashboard,/OwnerProductionFiles/)
  assert.match(ownerFiles,/createCustomerPacket/)
  assert.match(ownerFiles,/PRINT_VARIANTS\.map/)
  assert.match(ownerFiles,/X-Starkeepsake-Admin-Key/)
  assert.match(paidApi,/FindVerifiedPaidJobDesignAsync/)
  assert.match(paidApi,/PaidJobFilePolicy\.MatchedDesign/)
  assert.match(paidApi,/Results\.Unauthorized\(\)/)
})

const trialPage=file('../src/pages/TrialOrderLab.tsx')
const trialFixture=file('../src/trialOrderFixture.ts')
const trialApp=file('../src/App.tsx')
test('guided trial has prefilled workshop and read-only, explicitly simulated Etsy job',()=>{
  assert.match(trialApp,/window\.location\.pathname === '\/trial-order'/)
  assert.match(studio,/trialPhotoMode/)
  assert.match(studio,/loadTrialSample/)
  assert.match(studio,/isSampleLocation\(selected\)/)
  assert.match(trialFixture,/TRIAL-NO-ETSY-PAYMENT/)
  assert.match(trialPage,/SIMULATION · NO PAYMENT/)
  assert.match(trialPage,/createCustomerPacket/)
  assert.match(trialPage,/generateAstronomy/)
  assert.match(trialPage,/selectVisiblePhysicalStars/)
  assert.match(trialPage,/PRINT_VARIANTS\.map/)
  assert.match(trialPage,/\/api\/admin\/production\/orders/)
  assert.match(trialPage,/downloadReport/)
  assert.doesNotMatch(trialPage,/saveCustomerDesign|\/api\/admin\/production\/sync|\/api\/webhooks\/etsy\/orders/)
})

const qualityModule=file('../src/photoPrintQuality.ts')
const qualityPacket=file('../src/customerOrder.ts')
const qualityOwner=file('../src/pages/OwnerProductionFiles.tsx')
test('source-photo quality preflight follows the actual customer and admin packet',()=>{
  assert.match(studio,/getFrameLayout\('11x14'\)/)
  assert.match(studio,/framePresetId:'11x14'/)
  assert.doesNotMatch(studio,/PhotoQualityPanel|photoQuality|qualityAcceptedKey|qualityKey/)
  assert.match(qualityPacket,/assessPhotoPrintQuality/)
  assert.match(qualityModule,/needsOwnerReview/)
  assert.match(qualityPacket,/photo-quality-report\.json/)
  assert.match(qualityPacket,/manifest\.manufacturing\.photoQuality=quality/)
  assert.match(qualityOwner,/PRINT HOLD — owner review required/)
})

const makerPlanSource=file('../src/manufacturingJobPlan.ts')
const ownerMakerSource=file('../src/pages/OwnerManufacturingPlan.tsx')
test('paid Etsy jobs load design-specific N-star procurement and engineering preview',()=>{
  assert.match(dashboard,/materials={materials}/)
  assert.match(qualityOwner,/OwnerManufacturingPlan/)
  assert.match(ownerMakerSource,/makerDrillTemplateSvg/)
  assert.match(ownerMakerSource,/makerPartsCsv/)
  assert.match(ownerMakerSource,/M3 global on hand/)
  assert.match(makerPlanSource,/Math\.ceil\(n\/24\)/)
  assert.match(makerPlanSource,/Math\.ceil\(n\/12\)/)
  assert.match(qualityPacket,/manufacturing-job-plan\.json/)
  assert.match(qualityPacket,/candidate-parts\.csv/)
  assert.match(qualityPacket,/drill-template-1to1-DRAFT\.svg/)
  assert.doesNotMatch(studio,/DEVELOPMENT CAPACITY · UNVERIFIED FOR MANUFACTURING/)
  assert.doesNotMatch(studio,/<option value={48}>|<option value={72}>/)
  assert.match(studio,/Up to 24 illuminated stars per keepsake/)
  assert.match(file('../src/physicalStarView.ts'),
    /Math\.min\(DEFAULT_MAX_PHYSICAL_STARS,backendMax\)/)
})

// The customer landing page should stay clean even for /?trial=1.
// Sample injection is automatic on a fresh trial workshop, not a hero CTA.
const landingCss=file('../src/pages/ExperiencePage.css')
test('landing hero omits trial controls and navigation uses balanced centered tracks',()=>{
  assert.doesNotMatch(studio,/className="at-trial-sample"/)
  assert.doesNotMatch(studio,/Use prepared trial photo and example date\/place/)
  assert.match(studio,/if\(trialPhotoMode&&!trialSampleStarted\.current\)/)
  assert.match(studio,/if\(!draft\)/)
  assert.match(landingCss,/grid-template-columns:minmax\(190px,1fr\) minmax\(0,920px\) minmax\(190px,1fr\)/)
  assert.match(landingCss,/\.at-header::after/)
  assert.match(landingCss,/\.at-header \.at-steps\{[\s\S]*?grid-column:2;grid-row:1/)
  assert.match(landingCss,/@media \(max-width:1080px\)/)
})

const observatoryCss=file('../src/pages/ExperiencePage.css')
test('Chapter 04 observatory is a streamlined dashboard, without removing sky controls',()=>{
  const chapter4=studio.split("stage==='preview'&&")[1].split("stage==='home'&&")[0]
  assert.match(chapter4,/at-observatory-heading/)
  assert.match(chapter4,/at-preview-grid/)
  assert.match(chapter4,/aria-label="Interactive sky and photograph"/)
  assert.match(chapter4,/SkyWorkshopPreview/)
  assert.match(chapter4,/SkyWorkshopOrientation/)
  assert.match(chapter4,/at-observatory-perspective/)
  assert.match(chapter4,/at-observatory-quick-controls/)
  assert.match(chapter4,/at-observatory-disclosure/)
  assert.match(chapter4,/Change date or location/)
  assert.match(chapter4,/Change photo composition/)
  assert.match(chapter4,/Refine the horizon again/)
  assert.match(chapter4,/Choose another photograph/)
  assert.match(chapter4,/onChange=\{e=>setSkyPercent\(Number\(e\.target\.value\)\)\}/)
  assert.match(chapter4,/setAtmosphericGlow\(event\.target\.checked\)/)
  assert.match(chapter4,/setSkyTone\(value\)/)
  assert.match(chapter4,/See my keepsake in a room/)
  assert.doesNotMatch(chapter4,/className="at-finish-chapter"/)
  assert.match(observatoryCss,/grid-template-columns:minmax\(0,1fr\) minmax\(300px,338px\)/)
  assert.match(observatoryCss,/@media\(max-width:620px\)/)
})

test('Chapter 05 places room choices in the right-hand card instead of facts', () => {
  const chapter5=studio.split('CHAPTER 05 / BRING YOUR NIGHT HOME')[1]
  const left=chapter5.split('<aside className="at-home-right">')[0]
  const right=chapter5.split('<aside className="at-home-right">')[1]
  assert.doesNotMatch(left,/Choose your room/)
  assert.match(right,/className="at-home-choice at-home-room"/)
  assert.match(right,/Choose your room/)
  assert.match(right,/ROOM_OPTIONS\.map\(choice=>/)
  assert.doesNotMatch(right,/className="at-home-facts"/)
  assert.match(landingCss,/\.at-home-spec \.at-home-choice-list\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
})

test('Chapter 05 only shows the full light picker for more than 24 print-safe stars', () => {
  const chapter5=studio.split('CHAPTER 05 / BRING YOUR NIGHT HOME')[1]
  assert.match(chapter5,/physicalView&&physicalView\.physicalSelection\.eligibleStars>24&&\s*<section className="at-physical-choices"/)
  assert.match(chapter5,/physicalView\.physicalSelection\.eligibleStars===0/)
  assert.match(chapter5,/physicalView\.physicalSelection\.eligibleStars<=24&&\s*design\.physicalStarOverrides\?\.mode==='manual'/)
  assert.match(chapter5,/Restore automatic star selection/)
  assert.match(chapter5,/at-home-star-edit-preview/)
  assert.match(chapter5,/onTogglePhysicalStar=\{togglePhysicalLight\}/)
})


const horizonPolish=file('../src/components/SkyMaskEditor.tsx')
test('no photo detail panel appears anywhere in the customer workshop',()=>{
  const chapter2=studio.split("stage==='choice'&&")[1].split("stage==='refine'&&")[0]
  const chapter5=studio.split("stage==='home'&&")[1].split('</main>')[0]
  assert.doesNotMatch(chapter2,/PhotoQualityPanel|at-horizon-quality|PHOTO DETAIL/)
  assert.doesNotMatch(chapter5,/PhotoQualityPanel|at-photo-preflight|PRINT QUALITY CHECK/)
  assert.doesNotMatch(horizonPolish,/PhotoQualityPanel|sky-mask-quality|photoQuality|PHOTO DETAIL/)
  assert.doesNotMatch(studio,/qualityAcceptedKey|qualityKey|Review and acknowledge the photo-quality warning/)
})
test('removing customer UI retains non-blocking Etsy packet and private maker quality review',()=>{
  const orderFunction=studio.split('async function buildOrderPacket()')[1].split('if(!draftReady)')[0]
  assert.doesNotMatch(orderFunction,/qualityAcceptedKey|needsOwnerReview|qualityKey/)
  assert.match(orderFunction,/createCustomerPacket/)
  assert.match(orderFunction,/freezeManufacturingPacket/)
  assert.match(qualityPacket,/assessPhotoPrintQuality/)
  assert.match(qualityPacket,/photo-quality-report\.json/)
  assert.match(qualityPacket,/manifest\.manufacturing\.photoQuality=quality/)
  assert.match(qualityOwner,/PRINT HOLD — owner review required/)
})

test('owner has a paid-only purchased Design ID table with matching maker files',()=>{
  assert.match(dashboard,/Purchased Design IDs/)
  assert.match(dashboard,/purchasedDesigns=useMemo/)
  assert.match(dashboard,/receiptStatus\(r\)==='Paid'/)
  assert.match(dashboard,/x\.match_state==='matched'&&x\.quantity===1&&x\.design_id===job\.design_id/)
  assert.match(dashboard,/Open order &amp; maker files/)
  assert.match(dashboard,/No matched paid designs yet/)
})

test('Chapter 05 moves both physical frame finish choices into the Your night framed card',()=>{
  const chapter5=studio.split('CHAPTER 05 / BRING YOUR NIGHT HOME')[1]
  const left=chapter5.split('<aside className="at-home-right">')[0]
  const right=chapter5.split('<aside className="at-home-right">')[1]
  const spec=right.split('<div className="at-customer-order">')[0]
  assert.doesNotMatch(left,/Find your frame finish|at-home-wood-options/)
  assert.match(spec,/Your night, <em>framed\.<\/em>/)
  assert.match(spec,/Choose your room/)
  assert.match(spec,/Choose your frame finish/)
  assert.match(spec,/WOOD_OPTIONS\.filter/)
  assert.match(spec,/setFinish\(choice.id\);setRoom\(choice.scene\)/)
  assert.doesNotMatch(right,/Make it <em>yours|at-frame-quote|at-frame-option-price|Refresh estimate/)
})
test('preparing Etsy order animates stages without offering checkout before private archive',()=>{
  const orderFunction=studio.split('async function buildOrderPacket()')[1].split('if(!draftReady)')[0]
  assert.match(orderFunction,/setOrderPreparingStep\('save'\)/)
  assert.match(orderFunction,/setOrderPreparingStep\('render'\)/)
  assert.match(orderFunction,/setOrderPreparingStep\('archive'\)/)
  assert.match(orderFunction,/await freezeManufacturingPacket\(receipt,packet\)/)
  assert.match(orderFunction,/setPreparedOrder\(\{key,packet\}\)/)
  assert.match(studio,/at-order-preparing-orbit/)
  assert.match(studio,/at-order-preparing-track/)
  assert.match(landingCss,/@media\(prefers-reduced-motion:reduce\)/)
})
const sample=file('../src/pages/SampleProductionOrder.tsx')
test('owner preview is clearly fictional, read-only, and separate from paid data',()=>{
  assert.match(dashboard,/<SampleProductionOrder \/>/)
  assert.match(sample,/SIMULATION ONLY · NO PAYMENT · NO DATABASE RECORD/)
  assert.match(sample,/SAMPLE_DESIGN_ID='SK-DEMO-NOT-REAL'/)
  assert.match(sample,/PHYSICAL_STARS=18/)
  assert.match(sample,/Math\.ceil\(PHYSICAL_STARS\/24\)/)
  assert.match(sample,/Math\.ceil\(PHYSICAL_STARS\/12\)/)
  assert.match(sample,/MAKER_STEPS\.length/)
  assert.match(sample,/PRINT_VARIANTS\.map/)
  assert.match(sample,/No Etsy API request, database write/)
  assert.doesNotMatch(sample,/fetch\(|api\(|createCustomerPacket\(|saveCustomerDesign\(/)
  assert.doesNotMatch(dashboard.split('const purchasedDesigns=useMemo')[1].split('},\[data\]')[0],/SAMPLE_DESIGN_ID|SampleProductionOrder/)
})
