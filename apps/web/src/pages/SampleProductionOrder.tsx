import {useState} from 'react'
import {MAKER_STEPS} from '../manufacturingJobPlan'
import {DEFAULT_PRINT_SETTINGS, PRINT_VARIANTS, printSpecification}
  from '../manufacturingPrint'
import './SampleProductionOrder.css'

/** Example work order only. It deliberately cannot be matched to a saved SK ID,
 * paid Etsy receipt, M3 inventory, real checklist or shipping transaction. */
const SAMPLE_DESIGN_ID='SK-DEMO-NOT-REAL'
const PHYSICAL_STARS=18
const DRIVER_COUNT=Math.ceil(PHYSICAL_STARS/24)
const CONNECTOR_GROUPS=Math.ceil(PHYSICAL_STARS/12)
const printMaster=PRINT_VARIANTS.find(variant=>variant.id==='bleed_1_4')!
const printSpec=printSpecification(279.4,355.6,{
  ...DEFAULT_PRINT_SETTINGS,bleedIn:printMaster.bleedIn
})
type PartGroup='buy'|'pack'|'bulk'|'make'
const groups:{id:PartGroup;label:string;hint:string}[]=[
  {id:'buy',label:'Buy for this order',hint:'Custom items for this exact customer'},
  {id:'pack',label:'Pull from pack stock',hint:'Controllers, LEDs and packaged components'},
  {id:'bulk',label:'Use bulk materials',hint:'Cut or measure from shared stock'},
  {id:'make',label:'Make for this order',hint:'Assemble and fabricate to the saved star map'},
]
const parts:{group:PartGroup;name:string;quantity:string;next:string}[]=[
  {group:'buy',name:'Matte-black 11×14 shadow-box frame',quantity:'1',next:'Confirm purchased Etsy finish and correct frame depth'},
  {group:'buy',name:'Professional satin/luster photo print',quantity:'1',next:'Confirm lab bleed requirements and approve proof'},
  {group:'pack',name:'Warm-white individual star LEDs',quantity:String(PHYSICAL_STARS),
    next:'Verify LED3FWAW specification and stock'},
  {group:'pack',name:'Raspberry Pi Pico W',quantity:'1',next:'Verify board and customer firmware'},
  {group:'pack',name:'TLC5947 24-channel LED driver',quantity:String(DRIVER_COUNT),
    next:'Validate circuit, power and channel mapping'},
  {group:'pack',name:'12-channel harness connector groups',quantity:String(CONNECTOR_GROUPS),
    next:'Approve connector SKU and pinout'},
  {group:'pack',name:'Power supply, fuse and protection',quantity:'1 set',
    next:'Electrical approval and correct listed adapter pending'},
  {group:'pack',name:'Packaging and care insert',quantity:'1 set',
    next:'Confirm protection and instructions'},
  {group:'bulk',name:'3 mm black SINTRA panel',quantity:'1 panel',next:'Check cut size and mechanical drilling proof'},
  {group:'bulk',name:'Photo mounting film',quantity:'Panel area + waste',next:'Measure material and test adhesion'},
  {group:'bulk',name:'PETG, wire, heat-shrink and adhesives',quantity:'To measure',
    next:'Measure approved 18-light layout and test compatibility'},
  {group:'bulk',name:'Warm accent strip and diffuser',quantity:'To measure',
    next:'Check hidden routing and optical/thermal proof'},
  {group:'make',name:'Numbered StarPods',quantity:String(PHYSICAL_STARS),
    next:'Print and test each light holder'},
  {group:'make',name:'Numbered 18-channel wiring harness',quantity:'1 assembly',
    next:'Map each physical star to its driver channel'},
  {group:'make',name:'Electronics carrier / rear service cover',quantity:'1 set',
    next:'Fit hardware to chosen shadow-box frame'},
  {group:'make',name:'Draft 1:1 star drilling template',quantity:'1 file',
    next:'Only if exact frozen star geometry passes validation'},
]
const blocks=[
  'Confirm the actual frame finish matches Etsy',
  'Approve the print and physical alignment before drilling',
  'Verify stock, supplier parts and electrical design',
]
const makerFiles=[
  {label:'Original photograph',name:'Original customer upload in private saved design'},
  {label:'Exact printed artwork',name:'print-artwork-exact-11x14.png'},
  {label:'Physical LED coordinates',name:'physical-star-map.csv'},
  {label:'1:1 drilling reference (conditional)',name:'drill-template-1to1-DRAFT.svg'},
  {label:'Design specifications',name:'order.json + manufacturing-job-plan.json'},
  {label:'Parts / engineering reference',name:'candidate-parts.csv'},
  {label:'23-step work checklist',name:'assembly-checklist.json'},
  {label:'Source photo quality check',name:'photo-quality-report.json'},
]

export function SampleProductionOrder(){
  const [open,setOpen]=useState(false)
  return <section className="production-data spo-panel"
    aria-label="Read-only sample production order">
    <div className="production-actions spo-launch">
      <div>
        <p className="production-eyebrow">WORKBENCH PREVIEW · DEMONSTRATION</p>
        <h2>See a sample customer work order</h2>
        <p>A cleaner walkthrough of what to review and build when a real Etsy
          payment matches a saved design.</p>
      </div>
      <button type="button" className="production-ghost"
        aria-expanded={open} aria-controls="spo-sample-body"
        onClick={()=>setOpen(value=>!value)}>
        {open?'Close example':'Preview example work order'}
      </button>
    </div>
    {open&&<div id="spo-sample-body" className="spo-content"
      role="region" aria-label="Example only — no real Etsy order">
      <div className="spo-demo-banner" role="note">
        <strong>SIMULATION ONLY · NO PAYMENT · NO DATABASE RECORD</strong>
        <span>Sample numbers and example tasks only. Real Etsy orders, inventory,
          customer photos and checklists are unchanged.</span>
      </div>
      <div className="spo-status" aria-label="Example production status and next action">
        <span className="spo-status-label">PRODUCTION STATUS · EXAMPLE</span>
        <h3>On hold — check parts and print proof</h3>
        <p><strong>Next action:</strong> Confirm the Etsy frame finish, then approve the
          customer's print proof. Do not start drilling or assembly yet.</p>
        <ul className="spo-blockers">
          {blocks.map(block=><li key={block}>{block}</li>)}
        </ul>
      </div>

      <section className="spo-section" aria-label="Customer design">
        <div className="spo-section-header"><span>01</span>
          <div><h4>What the customer bought</h4>
            <p>The essential details at a glance</p></div>
        </div>
        <div className="spo-product">
          <div className="spo-preview" aria-label="Artwork preview unavailable for this fictional example">
            <div className="spo-preview-frame" aria-hidden="true">
              <div className="spo-preview-night">✦</div>
              <div className="spo-preview-photo">CUSTOMER PHOTO</div>
            </div>
            <strong>Example layout only</strong>
            <small>This is not a customer's actual photo or calculated sky.
              Real artwork is kept in the private maker files.</small>
          </div>
          <dl className="spo-facts">
            <div><dt>Design ID</dt><dd><code>{SAMPLE_DESIGN_ID}</code></dd></div>
            <div><dt>Etsy order</dt><dd>#DEMO-1001 · illustrative</dd></div>
            <div><dt>Payment</dt><dd>Example: paid &amp; matched · $799.00</dd></div>
            <div><dt>Frame</dt><dd>Matte black · 11×14 in</dd></div>
            <div><dt>Physical stars</dt><dd>{PHYSICAL_STARS} illuminated LEDs</dd></div>
            <div><dt>Night</dt><dd>June 14, 2025 · 9:00 PM</dd></div>
            <div><dt>Location</dt><dd>Chicago, Illinois, USA</dd></div>
            <div><dt>Composition</dt><dd>Stars above photograph</dd></div>
            <div><dt>Inscription</dt><dd>“Our forever night”</dd></div>
          </dl>
        </div>
      </section>

      <section className="spo-section" aria-label="Files needed to make the order">
        <div className="spo-section-header"><span>02</span>
          <div><h4>Files you'll need</h4><p>Know what to print and where to find the rest</p></div>
        </div>
        <div className="spo-primary-file">
          <span>START WITH THIS PRINT MASTER · LAB APPROVAL REQUIRED</span>
          <strong>{printMaster.artwork}</strong>
          <p>{printSpec.documentSizeIn.width} × {printSpec.documentSizeIn.height} in
            including {printSpec.bleedIn}-in bleed on every edge ·
            {' '}{printSpec.dpi} DPI · {printSpec.documentPixels.width} ×
            {' '}{printSpec.documentPixels.height} pixels</p>
          <small>Visible trim: 11 × 14 inches, portrait. Confirm that your print
            shop accepts ¼-inch bleed before selecting this variant.
            Real files are downloaded from the verified paid order's
            <b> Owner manufacturing files</b> section.</small>
        </div>
        <details className="spo-disclosure">
          <summary>See alternative print sizes and other maker files</summary>
          <div className="spo-file-list">
            {PRINT_VARIANTS.map(variant=><div key={variant.id}>
              <strong>{variant.label} · 300 DPI</strong>
              <code>{variant.artwork}</code>
              <small>One matching print spec and trim/safe-area guide</small>
            </div>)}
            {makerFiles.map(item=><div key={item.label}>
              <strong>{item.label}</strong><code>{item.name}</code>
            </div>)}
          </div>
          <p>These are file references, not working demo downloads.
            Real owner downloads require a verified paid match.</p>
        </details>
      </section>

      <section className="spo-section" aria-label="Part requirements and readiness">
        <div className="spo-section-header"><span>03</span>
          <div><h4>Parts needed for this frame</h4>
            <p>Counts change with the saved number of illuminated stars</p></div>
        </div>
        <div className="spo-counts">
          <div><strong>{PHYSICAL_STARS}</strong><small>LEDs</small></div>
          <div><strong>{PHYSICAL_STARS}</strong><small>StarPods</small></div>
          <div><strong>{DRIVER_COUNT}</strong><small>LED driver</small></div>
          <div><strong>{CONNECTOR_GROUPS}</strong><small>Harness groups</small></div>
        </div>
        <div className="spo-readiness">
          <strong>Parts readiness: not verified</strong>
          <p>Sample orders are not connected to inventory. On-hand amounts,
            supplier purchases, deliveries and allocations must be checked in
            the real paid job. Unknown stock is <b>not</b> the same as zero stock.</p>
        </div>
        <div className="spo-part-groups">
          {groups.map(group=><details key={group.id} className="spo-parts-group"
            open={group.id==='buy'}>
            <summary><span><strong>{group.label}</strong><small>{group.hint}</small></span>
              <span>{parts.filter(p=>p.group===group.id).length} items</span></summary>
            <div className="spo-parts-list">
              {parts.filter(p=>p.group===group.id).map(part=><div key={part.name}>
                <div><strong>{part.name}</strong><small>{part.next}</small></div>
                <div className="spo-part-qty"><strong>{part.quantity}</strong>
                  <small>Stock: unknown</small></div>
              </div>)}
            </div>
          </details>)}
        </div>
        <small className="spo-muted">This is a shortened example BOM.
          The real per-design maker plan includes every additional power, wiring,
          hardware, accent-light and packaging item, with unverified items held
          for review. It uses the finalized saved N-star list, not a new selection.</small>
      </section>

      <section className="spo-section" aria-label="Order-specific build steps">
        <div className="spo-section-header"><span>04</span>
          <div><h4>Build it and track your progress</h4>
            <p>Pick up where you left off in a real paid order</p></div>
        </div>
        <div className="spo-build-summary">
          <div><strong>0 / {MAKER_STEPS.length} steps</strong><small>Example only · not started</small></div>
          <div className="spo-empty-progress" aria-label="Example checklist 0 percent complete"/>
        </div>
        <div className="spo-workbench-next">
          <strong>First tasks on your real checklist</strong>
          <ol>{MAKER_STEPS.slice(0,4).map(step=><li key={step.id}>{step.title}</li>)}</ol>
        </div>
        <p className="spo-muted">Specific build: {PHYSICAL_STARS} numbered LED channels,
          {' '}{DRIVER_COUNT} TLC5947 board, {CONNECTOR_GROUPS} connector groups,
          portrait print and a matte-black frame. Actual star coordinates, HIP IDs,
          aperture sizes and brightness mapping come from the saved maker packet;
          unresolved calibration stays on hold.</p>
        <details className="spo-disclosure">
          <summary>View all {MAKER_STEPS.length} actual manufacturing checklist steps</summary>
          <ol className="spo-full-steps">{MAKER_STEPS.map(step=>
            <li key={step.id}>{step.title}</li>)}</ol>
          <p>This example cannot be checked off. The real order checklist
            saves progress privately to the server, including after a refresh.</p>
        </details>
      </section>

      <div className="spo-last-stages">
        <section className="spo-section" aria-label="Quality assurance">
          <div className="spo-section-header"><span>05</span>
            <div><h4>Quality check</h4><p>Not started in this example</p></div></div>
          <p>Inspect all LED channels, twinkle, light leaks, heat, star placement,
            print alignment, glazing and frame hardware. Record rework and
            inspection photos in the real workflow when supported.</p>
          <small className="spo-muted">No QA pass, notes or QC photos are
            recorded by this demo. Dedicated job-level QA notes/photo uploads
            are not yet established in this viewer.</small>
        </section>
        <section className="spo-section" aria-label="Shipping readiness">
          <div className="spo-section-header"><span>06</span>
            <div><h4>Shipping</h4><p>Not ready to ship</p></div></div>
          <p>Before shipping, verify the correct frame, passing QA, included
            power adapter and care card, protected corners/face and final photos.</p>
          <small className="spo-muted">This example has no real shipping
            action or tracking. No "Ready to ship" or "Shipped" state is written.</small>
        </section>
      </div>
      <details className="spo-disclosure spo-advanced">
        <summary>Advanced manufacturing details</summary>
        <p>Real paid orders also contain the original and optional processed
          customer images, saved camera projection, HIP identifiers, exact print
          X/Y values, aperture and electrical calibration holds, source/catalog
          versions, private archive and transaction metadata.</p>
        <p>This example intentionally does not invent physical star coordinates,
          inventory quantities, suppliers, progress, QC approvals or API IDs.</p>
      </details>
      <p className="spo-footer">No Etsy API request, database write, private
        design access, stock update, payment or production job is made by this preview.</p>
    </div>}
  </section>
}
