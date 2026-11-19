import {useState} from 'react'
import {MAKER_STEPS} from '../manufacturingJobPlan'
import {PRINT_VARIANTS} from '../manufacturingPrint'
import './SampleProductionOrder.css'

/** Read-only demonstration only. NEVER insert a sample into paid receipts, production
 * jobs, saved designs, M3 stock, analytics or Etsy. No requests or mutations. */
const SAMPLE_DESIGN_ID='SK-DEMO-NOT-REAL'
const PHYSICAL_STARS=18
const frame='Matte black · 11×14 shadow box'
const parts=[
  {group:'Buy',name:'11×14 matte-black shadow-box frame',count:'1 frame',review:'Confirm actual Etsy variation and supplier'},
  {group:'Buy',name:'Professional satin/luster print',count:'1 print',review:'Approve print proof and bleed'},
  {group:'Pack',name:'Lumimax LED3FWAW warm-white LEDs',count:PHYSICAL_STARS+' LEDs',review:'Select correct part and verify stock'},
  {group:'Pack',name:'Raspberry Pi Pico W',count:'1 board',review:'Firmware/pinout still needs proof'},
  {group:'Pack',name:'TLC5947 24-channel driver',count:Math.ceil(PHYSICAL_STARS/24)+' board',review:'Electrical / channel calibration hold'},
  {group:'Pack',name:'Star harness connector groups',count:Math.ceil(PHYSICAL_STARS/12)+' groups',review:'Exact connectors and wiring unapproved'},
  {group:'Bulk',name:'Black SINTRA / expanded PVC 3 mm',count:'1 panel',review:'Measure, mechanically drill; never laser PVC'},
  {group:'Bulk',name:'Pressure-sensitive photo mounting film',count:'1 frame area + waste',review:'Adhesion proof required'},
  {group:'Make',name:'Black PETG StarPods',count:PHYSICAL_STARS+' holders',review:'Fit, depth and light leakage testing'},
  {group:'Make',name:'Numbered N-channel wiring harness',count:'1 assembly',review:'18 independently labeled outputs'},
]
const files=[
  {name:'Original photograph',file:'original-photo.jpg',detail:'Privately saved; not a thumbnail in the order register'},
  {name:'Order manifest',file:'order.json',detail:'Exact customer settings, star identities and Design ID'},
  {name:'Physical LED map',file:'physical-star-map.csv',detail:'All 18 HIP IDs, LED indices, magnitudes and print X/Y coordinates'},
  {name:'Candidate parts',file:'manufacturing-job-plan.json + candidate-parts.csv',
    detail:'Quantities from N=18, with supplier/engineering holds'},
  {name:'Build checklist',file:'assembly-checklist.json',
    detail:MAKER_STEPS.length+' stages, initially not started; real progress stored privately'},
  {name:'Drilling reference',file:'drill-template-1to1-DRAFT.svg',
    detail:'Only when actual geometry validates; NOT permission to drill'},
  {name:'Photo quality',file:'photo-quality-report.json',detail:'Internal review for print, never a buyer checkout warning'},
] as const

export function SampleProductionOrder(){
  const [open,setOpen]=useState(false)
  return <section className="production-data spo-panel"
    aria-label="Read-only sample production order">
    <div className="production-actions">
      <div>
        <p className="production-eyebrow">SEE HOW A FINISHED ORDER APPEARS</p>
        <h2>Example purchased design</h2>
        <p>Explore what a hypothetical Etsy-paid, matched StarKeepsake order would
          show in your workshop. This demonstration never creates an order.</p>
      </div>
      <button type="button" className="production-ghost" aria-expanded={open}
        onClick={()=>setOpen(value=>!value)}>
        {open?'Hide sample order':'Preview sample order'}
      </button>
    </div>
    {open&&<div className="spo-content" role="region"
      aria-label="Simulated order details — no real Etsy payment">
      <div className="spo-demo-banner">
        <strong>SIMULATION ONLY · NO PAYMENT · NO DATABASE RECORD</strong>
        <span>This is illustrative information. It does not count toward paid orders,
          does not affect stock, cannot download private customer files, and cannot
          start manufacturing.</span>
      </div>
      <div className="spo-heading">
        <div><span>ETSY RECEIPT · EXAMPLE #DEMO-1001</span>
          <h3>Personalized illuminated night sky frame</h3>
          <p>Customer order — example, not an actual Etsy transaction</p></div>
        <span className="spo-state">Example: paid &amp; matched</span>
      </div>
      <div className="spo-metrics">
        <div><small>Design ID</small><strong>{SAMPLE_DESIGN_ID}</strong>
          <small>Intentionally invalid / cannot match a real order</small></div>
        <div><small>Amount paid on Etsy</small><strong>$799.00</strong>
          <small>Hypothetical example only</small></div>
        <div><small>Quantity</small><strong>1 frame</strong><small>Single-unit matched item</small></div>
        <div><small>Production status</small><strong>Awaiting review</strong>
          <small>Manufacturing HOLD until physical approvals</small></div>
      </div>
      <div className="spo-sections">
        <section>
          <h4>Customer's saved design</h4>
          <dl className="spo-facts">
            <div><dt>Frame / finish</dt><dd>{frame}</dd></div>
            <div><dt>Composition</dt><dd>Stars above the photograph</dd></div>
            <div><dt>Moment</dt><dd>June 14, 2025 · 9:00 PM</dd></div>
            <div><dt>Place</dt><dd>Chicago, Illinois, USA</dd></div>
            <div><dt>Inscription</dt><dd>“Our forever night”</dd></div>
            <div><dt>Illuminated stars</dt><dd>{PHYSICAL_STARS} selected (maximum 24)</dd></div>
            <div><dt>Print size</dt><dd>11 × 14 in · portrait · 279.4 × 355.6 mm</dd></div>
            <div><dt>Photo</dt><dd>Private original retained, downloadable after verified paid match</dd></div>
          </dl>
          <p className="spo-fineprint">Real jobs use the exact saved calculated HIP star
            records and X/Y positions from the customer's chosen night and view.
            This example contains no fabricated astronomy or drill coordinates.</p>
        </section>
        <section>
          <h4>Workshop readiness</h4>
          <div className="spo-check">
            <div><span>Payment / ID match</span><strong>Example: verified</strong></div>
            <div><span>Private maker archive</span><strong>Available for real paid matches</strong></div>
            <div><span>LED driver / connector groups</span>
              <strong>{Math.ceil(PHYSICAL_STARS/24)} / {Math.ceil(PHYSICAL_STARS/12)}</strong></div>
            <div><span>Build checklist</span><strong>0 / {MAKER_STEPS.length} steps</strong></div>
            <div><span>Physical validation</span><strong>Not approved · HOLD</strong></div>
            <div><span>Supplier and stock verification</span><strong>Pending · HOLD</strong></div>
          </div>
          <p className="spo-fineprint">A genuine paid Etsy order is not an
            automatic authorization to purchase parts, drill, wire or ship.</p>
        </section>
      </div>
      <details className="spo-disclosure" open>
        <summary>Example per-order shopping / assembly quantities · N = {PHYSICAL_STARS}</summary>
        <p>These quantities follow the live candidate manufacturing-plan rules,
          not confirmed stock levels. Additional power, wiring, packaging,
          accent-light and safety items require separate review.</p>
        <div className="production-table-scroll">
          <table className="production-table">
            <thead><tr><th>GROUP</th><th>COMPONENT</th><th>QTY FOR THIS FRAME</th>
              <th>VALIDATION</th></tr></thead>
            <tbody>{parts.map(part=><tr key={part.name}>
              <td>{part.group}</td><td>{part.name}</td><td>{part.count}</td>
              <td>{part.review}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
      <details className="spo-disclosure">
        <summary>Example maker files · privately archived in a real order</summary>
        <p>The full frozen ZIP contains the exact original photo and print artwork;
          the admin overview does not presently show the customer's photo as a thumbnail.</p>
        <div className="spo-file-list">
          {files.map(file=><div key={file.file}>
            <strong>{file.name}</strong><code>{file.file}</code>
            <small>{file.detail}</small></div>)}
          {PRINT_VARIANTS.map(variant=><div key={variant.id}>
            <strong>{variant.label} · 300 DPI</strong><code>{variant.artwork}</code>
            <small>Includes matching print spec and trim/safe-area guide</small></div>)}
        </div>
      </details>
      <p className="spo-footer">No Etsy API request, database write, private
        design access, stock update, payment or production job is made by this preview.</p>
    </div>}
  </section>
}
