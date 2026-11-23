import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './ProductionDashboardPage.css'
import { MaterialsPanel } from './MaterialsPanel'
import { ProcurementPanel } from './ProcurementPanel'
import { ManualAmazonPurchasingPanel } from './ManualAmazonPurchasingPanel'
import type { MaterialSnapshot } from '../manualAmazonQueue'
import { materialsForProductionJob } from '../orderFulfillment'
import { OwnerProductionFiles } from './OwnerProductionFiles'
import {parseDesignLink} from '../savedDesign'
import type {LoadedDesign} from '../savedDesign'
import {buildManufacturingJobPlan} from '../manufacturingJobPlan'
import { SampleProductionOrder } from './SampleProductionOrder'

type Receipt = {
  shop_id: number
  receipt_id: number
  etsy_status: string
  is_paid: boolean
  is_canceled: boolean
  has_refunds: boolean
  grandtotal_amount: number | null
  grandtotal_divisor: number | null
  currency_code: string | null
  created_at_etsy: string | null
  last_synced_at: string
}
type Item = {
  shop_id: number
  receipt_id: number
  transaction_id: number
  listing_id: number | null
  title: string
  quantity: number
  design_id: string | null
  match_state: string
}
type Job = {
  shop_id: number
  receipt_id: number
  transaction_id: number
  design_id: string
  status: string
  created_at: string
}
type Dashboard = { shopId: number; receipts: Receipt[]; items: Item[]; jobs: Job[] }
type SavedDesignSummary = {
  designId: string
  createdAtUtc: string
  status: string
  layout: 'above'|'within'|'unknown'
  finish: string
  hasPreparedForeground: boolean
}
type Filter = 'all' | 'review' | 'ready' | 'canceled'
type SimulatedOrder={
  designId:string;createdAt:string;status:'SIMULATED_NOT_PAID';
  finish:string;layout:string;stars:number
}
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function money(receipt: Receipt) {
  const { grandtotal_amount: amount, grandtotal_divisor: divisor, currency_code: currency } = receipt
  if (amount === null || !divisor || !currency || !Number.isFinite(amount)) return '—'
  const value = amount / divisor
  if (!Number.isFinite(value)) return '—'
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value) }
  catch { return currency + ' ' + value.toFixed(2) }
}
function dateLabel(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}
function receiptStatus(receipt: Receipt) {
  if (receipt.is_canceled || receipt.etsy_status === 'canceled') return 'Canceled'
  if (receipt.has_refunds || receipt.etsy_status.includes('refund')) return 'Refund review'
  if (!receipt.is_paid || !['paid','completed'].includes(receipt.etsy_status)) return 'Not paid'
  return 'Paid'
}
function orderState(receipt: Receipt, items: Item[], jobs: Job[]) {
  const pay = receiptStatus(receipt)
  if (pay !== 'Paid') return pay
  const lines = items.filter(x => x.receipt_id === receipt.receipt_id)
  if (!lines.length || lines.some(x => x.match_state !== 'matched')) return 'Review design'
  const relatedJobs = jobs.filter(x => x.receipt_id === receipt.receipt_id)
  if (!relatedJobs.length) return 'Review design'
  if (relatedJobs.some(x => x.status === 'hold')) return 'On hold'
  if (relatedJobs.every(x => x.status === 'complete')) return 'Complete'
  return 'Ready for review'
}
function csvCell(value: string | number) {
  const text = String(value)
  // Prevent spreadsheet formula injection if titles are opened in Excel.
  const safe = /^[=+\-@\t\r]/.test(text) ? "'" + text : text
  return '"' + safe.replace(/"/g, '""') + '"'
}
async function api<T>(path: string, adminKey: string, method = 'GET'): Promise<T> {
  const response = await fetch(BASE + path, {
    method, headers: { 'X-Starkeepsake-Admin-Key': adminKey },
    cache: 'no-store',
  })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Incorrect admin key or expired access.')
    if (response.status === 429) throw new Error('Too many requests. Try again shortly.')
    throw new Error(method === 'POST'
      ? 'Etsy sync is temporarily unavailable. Check the API and Etsy connection.'
      : 'Could not load production orders. Check the API connection.')
  }
  return response.json() as Promise<T>
}
export function ProductionDashboardPage() {
  const [entry, setEntry] = useState('')
  const [key, setKey] = useState('') // Kept in memory only; never URLs, storage or logs.
  const [data, setData] = useState<Dashboard | null>(null)
  const [savedDesigns, setSavedDesigns] = useState<SavedDesignSummary[]>([])
  const [savedDesignsError, setSavedDesignsError] = useState('')
  const [testOrders,setTestOrders]=useState<SimulatedOrder[]>([])
  const [testError,setTestError]=useState('')
  const [testSelected,setTestSelected]=useState<string|null>(null)
  const [testDeleting,setTestDeleting]=useState<string|null>(null)
  const [testLink,setTestLink]=useState('')
  const [testCreating,setTestCreating]=useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [manualQueueVersion,setManualQueueVersion]=useState(0)
  const [materials,setMaterials]=useState<MaterialSnapshot|null>(null)
  const [materialsError,setMaterialsError]=useState('')
  const rows = useMemo(() => {
    if (!data) return []
    return data.receipts.map(receipt => ({
      receipt, items: data.items.filter(x => x.receipt_id === receipt.receipt_id),
      jobs: data.jobs.filter(x => x.receipt_id === receipt.receipt_id),
      state: orderState(receipt, data.items, data.jobs)
    })).filter(row => {
      if (filter === 'review') return ['Review design','Refund review','Not paid','On hold'].includes(row.state)
      if (filter === 'ready') return row.state === 'Ready for review'
      if (filter === 'canceled') return row.state === 'Canceled'
      return true
    })
  }, [data, filter])
  const selectedRow = rows.find(x => x.receipt.receipt_id === selected)
  // Purchase is only verified with a paid receipt, matching single-unit item
  // and corresponding owner-only production job. Never elevate an unpaid draft.
  const purchasedDesigns=useMemo(()=>{
    if(!data)return []
    return data.jobs.flatMap(job=>{
      const receipt=data.receipts.find(r=>r.shop_id===job.shop_id&&
        r.receipt_id===job.receipt_id&&receiptStatus(r)==='Paid')
      const item=data.items.find(x=>x.shop_id===job.shop_id&&
        x.receipt_id===job.receipt_id&&x.transaction_id===job.transaction_id&&
        x.match_state==='matched'&&x.quantity===1&&x.design_id===job.design_id)
      return receipt&&item?[{receipt,item,job}]:[]
    }).sort((a,b)=>(b.receipt.created_at_etsy??'').localeCompare(
      a.receipt.created_at_etsy??''))
  },[data])
  const paidDesignIds=useMemo(()=>new Set(purchasedDesigns.map(x=>x.job.design_id)),
    [purchasedDesigns])
  const testDesignIds=useMemo(()=>new Set(testOrders.map(x=>x.designId)),
    [testOrders])
  const paidCount = data?.receipts.filter(r => receiptStatus(r) === 'Paid').length ?? 0
  const reviewCount = data?.receipts.filter(r =>
    ['Review design','Refund review','Not paid','On hold'].includes(
      orderState(r, data.items, data.jobs))).length ?? 0

  async function load(adminKey: string) {
    const view = await api<Dashboard>('/api/admin/production/orders', adminKey)
    setData(view)
    // A drafts listing outage must not prevent the separate Etsy dashboard from opening.
    try {
      const drafts = await api<SavedDesignSummary[]>('/api/admin/designs', adminKey)
      setSavedDesigns(drafts)
      setSavedDesignsError('')
    } catch {
      setSavedDesigns([])
      setSavedDesignsError('Saved designs could not be loaded right now.')
    }
    // Owner-authenticated test orders live only in private Vercel Blob storage,
    // never as fake Etsy receipts, M3 demand, or real production jobs.
    try{
      const response=await fetch('/api/production/simulate',{cache:'no-store',
        headers:{'X-Starkeepsake-Admin-Key':adminKey}})
      if(!response.ok)throw Error('Private test-order storage returned HTTP '+response.status)
      const json=await response.json() as {orders:SimulatedOrder[]}
      setTestOrders(json.orders)
      setTestError('')
      const requested=new URLSearchParams(window.location.search).get('testDesign')
      if(requested&&json.orders.some(row=>row.designId===requested))
        setTestSelected(requested)
    }catch{
      setTestOrders([])
      setTestError('Test-order list unavailable right now. Real Etsy receipts remain separate.')
    }
    // Keep the order register available even when the inventory service is down.
    try {
      setMaterials(await api<MaterialSnapshot>('/api/admin/materials', adminKey))
      setMaterialsError('')
    } catch {
      setMaterials(null)
      setMaterialsError('Materials are temporarily unavailable. Verify parts in M3 before purchasing.')
    }
  }
  async function login(event: FormEvent) {
    event.preventDefault()
    if (!entry.trim()) return
    setBusy(true); setFailure(''); setMessage('')
    try {
      await load(entry)
      setKey(entry)
      setEntry('')
    } catch (error) { setFailure(error instanceof Error ? error.message : 'Could not sign in.') }
    finally { setBusy(false) }
  }
  // An owner opening the link from Chapter 05 should land ON the test work
  // order, not on an unrelated Etsy "no matched payment" table below.
  useEffect(()=>{
    if(!key||!testSelected)return
    document.getElementById('test-work-order')?.scrollIntoView({
      behavior:'smooth',block:'start'
    })
  },[key,testSelected,testOrders])

  async function refresh(sync: boolean) {
    if (!key) return
    setBusy(true); setFailure(''); setMessage('')
    try {
      if (sync) {
        const result = await api<{scanned:number;paidVerified:number;needsReview:number}>(
          '/api/admin/production/sync?limit=10', key, 'POST')
        setMessage('Checked ' + result.scanned + ' recent Etsy receipts; ' +
          result.paidVerified + ' confirmed paid. ' + result.needsReview +
          ' items need review. No manufacturing or purchase was triggered.')
      }
      await load(key)
      setManualQueueVersion(v=>v+1)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Request failed.'
      if (text.includes('admin key')) { setKey(''); setData(null) }
      setFailure(text)
    } finally { setBusy(false) }
  }
  async function createTestFromSavedLink(event:FormEvent){
    event.preventDefault()
    if(!key||testCreating)return
    setTestCreating(true);setTestError('')
    try{
      const link=new URL(testLink.trim())
      const privateRef=parseDesignLink(link.hash)
      if(!privateRef)throw Error('Paste the private reopening link from Chapter 05, including its hidden edit key.')
      const response=await fetch(BASE+'/api/designs/'+encodeURIComponent(privateRef.designId),{
        cache:'no-store',headers:{'X-Design-Access-Key':privateRef.accessKey}})
      if(!response.ok)throw Error('That private saved design could not be opened.')
      const saved=await response.json() as LoadedDesign
      if(saved.designId!==privateRef.designId)
        throw Error('Saved design and private link reference disagree.')
      const prepared=buildManufacturingJobPlan(
        {...saved.design,designId:saved.designId},saved.preferences)
      const submit=await fetch('/api/production/simulate',{
        method:'POST',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Starkeepsake-Admin-Key':key},
        body:JSON.stringify({
          ...privateRef,plan:{
            designId:prepared.designId,physicalCount:prepared.physicalCount,
            version:prepared.version,geometryValidated:prepared.geometryValidated,
            parts:prepared.parts.map(p=>({key:p.key,name:p.name,
              group:p.group,quantity:p.quantity,unit:p.unit,required:p.required}))
          },
        }),
      })
      if(!submit.ok){
        const failure=await submit.json().catch(()=>null) as {error?:string}|null
        throw Error(failure?.error||'Test creation failed (HTTP '+submit.status+').')
      }
      const created=await submit.json() as {order:{designId:string}}
      setTestLink('')
      await load(key)
      setTestSelected(created.order.designId)
      setSelected(null)
      setMessage('Internal test created from the exact saved design. No Etsy payment occurred.')
    }catch(error){setTestError(error instanceof Error?error.message:'Could not create this test.')}
    finally{setTestCreating(false)}
  }
  async function deleteTestOrder(designId:string){
    if(!key||testDeleting||!window.confirm(
      'Delete the simulated purchase and its TEST checklist for '+designId+
      '? The actual saved design and frozen manufacturing files will be preserved.'))return
    setTestDeleting(designId);setTestError('')
    try{
      const response=await fetch('/api/production/simulate?designId='+
        encodeURIComponent(designId),{method:'DELETE',cache:'no-store',
          headers:{'X-Starkeepsake-Admin-Key':key}})
      if(!response.ok)throw Error('Could not delete this test order (HTTP '+response.status+').')
      setTestOrders(orders=>orders.filter(row=>row.designId!==designId))
      setTestSelected(selected=>selected===designId?null:selected)
    }catch(e){setTestError(e instanceof Error?e.message:'Test deletion failed.')}
    finally{setTestDeleting(null)}
  }
  function downloadCsv() {
    if (!data) return
    const lines = [
      ['Etsy receipt','Created','Amount','Payment','Production','Transaction','Item','Quantity','Design ID','Match state'].join(','),
      ...data.receipts.flatMap(receipt => {
        const matches = data.items.filter(item => item.receipt_id === receipt.receipt_id)
        return (matches.length ? matches : [null]).map(item => [
          receipt.receipt_id, dateLabel(receipt.created_at_etsy), money(receipt),
          receiptStatus(receipt), orderState(receipt, data.items, data.jobs),
          item?.transaction_id ?? '', item?.title ?? '', item?.quantity ?? '',
          item?.design_id ?? '', item?.match_state ?? ''
        ].map(value => csvCell(value)).join(','))
      })
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'starkeepsake-etsy-production.csv'
    document.body.append(anchor); anchor.click(); anchor.remove()
    URL.revokeObjectURL(url)
  }

  return <main className="production-page">
    <div className="production-stars" aria-hidden="true" />
    <div className="production-container">
      <header className="production-header">
        <div><a className="production-back" href="/">← StarKeepsake</a>
          <p className="production-eyebrow">PRIVATE WORKSHOP / OPERATIONS</p>
          <h1>Production Studio</h1>
          <p className="production-subtitle">Verified Etsy orders, custom designs and manufacturing readiness.</p>
        </div>
        {key && <button type="button" className="production-ghost" onClick={() => {
          setKey(''); setData(null); setSavedDesigns([]); setMaterials(null); setSelected(null);
          setTestOrders([]);setTestSelected(null);setTestError('');
          setFailure(''); setSavedDesignsError(''); setMessage('')
        }}>Lock studio</button>}
      </header>
      {!key ? <section className="production-login">
        <div className="production-login-icon" aria-hidden="true">✦</div>
        <h2>Owner access</h2>
        <p>Enter your existing StarKeepsake Etsy admin setup key. It's held only in this browser tab's memory.</p>
        <form onSubmit={login}>
          <label htmlFor="admin-key">Admin setup key</label>
          <input id="admin-key" type="password" value={entry}
            onChange={event => setEntry(event.target.value)}
            autoComplete="off" required minLength={32} placeholder="Owner-only key" />
          <button className="production-primary" disabled={busy} type="submit">
            {busy ? 'Checking access…' : 'Open production studio'}
          </button>
        </form>
        {failure && <p className="production-error" role="alert">{failure}</p>}
        <small>Not your Etsy Shared Secret or Supabase key. No order is changed by signing in.</small>
      </section> : <>
        <section className="production-metrics" aria-label="Production overview">
          <article><span>Imported receipts</span><strong>{data?.receipts.length ?? '—'}</strong></article>
          <article><span>Paid receipts</span><strong>{paidCount}</strong></article>
          <article><span>Needs review</span><strong>{reviewCount}</strong></article>
          <article><span>Production jobs</span><strong>{data?.jobs.length ?? 0}</strong></article>
        </section>
        <section className="production-data production-tests" aria-label="Simulated purchases">
          <div className="production-actions">
            <div><p className="production-eyebrow">OWNER TESTING · NO ACTUAL CHARGE</p>
              <h2>Your simulated purchases</h2>
              <p>Build a real design on the customer site, select
                <b> Simulate Etsy Purchase</b> and review its exact files and parts here.
                These tests never enter Etsy sales, inventory demand or real fulfillment.</p>
            </div>
            <span className="production-test-badge">{testOrders.length} test orders</span>
          </div>
          <details className="production-test-new">
            <summary>Create a test from an existing saved design</summary>
            <p>Paste the private reopening link copied from the original customer
              workshop. The link proves access to this saved photograph and its
              frozen manufacturing packet. A bare SK Design ID cannot open private files.</p>
            <form onSubmit={event=>void createTestFromSavedLink(event)}>
              <label htmlFor="test-saved-design-link">Private saved-design reopening link</label>
              <input id="test-saved-design-link" type="password"
                autoComplete="off" value={testLink}
                onChange={e=>setTestLink(e.target.value)}
                placeholder="https://starkeepsake.vercel.app/#design=SK-…&key=…"
                required/>
              <button type="submit" className="production-primary" disabled={testCreating}>
                {testCreating?'Verifying frozen design…':'Create internal TEST order'}</button>
            </form>
            <small>Owner only. This link is cleared after use; it is not added
              to the browser URL or exported to the order register.</small>
          </details>
          {testError&&<p className="production-error" role="alert">{testError}</p>}
          {testOrders.length>0?<div className="production-table-scroll">
            <table className="production-table production-test-table">
              <thead><tr><th>DESIGN ID</th><th>CREATED</th><th>FRAME</th>
                <th>PHYSICAL STARS</th><th>STATUS</th><th>OPEN / REMOVE</th></tr></thead>
              <tbody>{testOrders.map(order=><tr key={order.designId}
                className={testSelected===order.designId?'production-active-row':''}>
                <td><strong>{order.designId}</strong></td>
                <td>{dateLabel(order.createdAt)}</td>
                <td>{order.finish==='ebony'?'Matte black':order.finish==='walnut'?
                  'Two-tone walnut':order.finish}</td>
                <td>{order.stars} LEDs</td>
                <td><span className="production-status production-test-label">
                  TEST · no payment</span></td>
                <td><div className="production-test-actions">
                  <button type="button" className="production-row-link" onClick={()=>{
                    setTestSelected(order.designId);setSelected(null)}}>
                    Open exact test work order</button>
                  <button type="button" className="production-test-delete"
                    disabled={testDeleting===order.designId}
                    onClick={()=>void deleteTestOrder(order.designId)}>
                    {testDeleting===order.designId?'Deleting…':'Delete test'}</button>
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>:<div className="production-empty">
            <h3>No simulated purchases yet</h3>
            <p>Finish a keepsake in <a href="/">the customer workshop</a>,
              then select <b>Simulate Etsy Purchase</b>. Only you can add
              test orders using your owner access key.</p>
          </div>}
          {testSelected&&testOrders.some(row=>row.designId===testSelected)&&
            <section className="production-test-workorder" id="test-work-order"
              aria-label="Exact saved design simulated work order">
              <div className="production-detail-heading">
                <div><p className="production-eyebrow">SIMULATED PURCHASE · NOT PAID</p>
                  <h2>Test work order · {testSelected}</h2>
                  <p>Review this actual saved design and its own manufacturing
                    requirements, as though it came from checkout. No real sales,
                    purchases or shipping are authorized.</p></div>
                <button type="button" className="production-ghost"
                  onClick={()=>setTestSelected(null)}>Close ×</button>
              </div>
              <div className="production-test-next">
                <strong>Next: inspect your real photograph, print files and star map</strong>
                <p>Confirm frame finish, supplier compatibility, print alignment and
                  electrical tests before declaring this design buildable.</p>
                {materialsError&&<small>{materialsError}</small>}
              </div>
              <OwnerProductionFiles key={testSelected} adminKey={key}
                receiptId={0} transactionId={0} designId={testSelected}
                simulated materials={materials}/>
            </section>}
        </section>
        <SampleProductionOrder />
        <section className="production-data production-purchased" aria-label="Verified purchased designs">
          <div className="production-actions">
            <div><h2>Purchased Design IDs</h2>
              <p>Paid Etsy orders linked to an exact saved design.
                Review every job before purchasing parts or beginning production.</p></div>
            <span className="production-design-count">{purchasedDesigns.length} verified</span>
          </div>
          {purchasedDesigns.length>0?<div className="production-table-scroll">
            <table className="production-table">
              <thead><tr><th>DESIGN ID</th><th>ETSY ORDER</th><th>PAID</th>
                <th>FRAME</th><th>JOB STATUS</th><th>DETAILS</th></tr></thead>
              <tbody>{purchasedDesigns.map(({receipt,job,item})=>{
                const design=savedDesigns.find(d=>d.designId===job.design_id)
                return <tr key={item.transaction_id}>
                  <td><strong>{job.design_id}</strong></td>
                  <td>#{receipt.receipt_id}</td><td>{money(receipt)}</td>
                  <td>{design?.finish==='walnut'?'Two-tone walnut':
                    design?.finish==='ebony'?'Matte black':'Verify finish'}</td>
                  <td><span className="production-status">{job.status==='hold'?
                    'On hold':job.status==='complete'?'Completed':'Paid · review before build'}</span></td>
                  <td><button type="button" className="production-row-link"
                    onClick={()=>{setFilter('all');setSelected(receipt.receipt_id)}}>
                    Open order &amp; maker files</button></td>
                </tr>
              })}</tbody>
            </table>
          </div>:<div className="production-empty">
            <h3>No matched paid designs yet</h3>
            <p>After a genuine Etsy payment, select <strong>Sync Etsy now</strong> below.
              Uploaded artwork without the text Design ID cannot be linked automatically.</p>
          </div>}
        </section>
        <section className="production-data production-designs" aria-label="Recent saved designs">
          <div className="production-actions">
            <div><h2>Recently saved designs</h2>
              <p>Latest 100 saved designs. A saved Design ID alone is not a purchase.
                Completed owner simulations appear as TEST orders; only verified Etsy
                receipts can be marked paid.</p></div>
            <span className="production-design-count">{savedDesigns.length} saved</span>
          </div>
          {savedDesignsError&&<p className="production-error" role="alert">{savedDesignsError}</p>}
          <div className="production-table-scroll">
            <table className="production-table">
              <thead><tr><th>DESIGN ID</th><th>SAVED</th><th>COMPOSITION</th><th>WOOD FINISH</th><th>STATUS</th></tr></thead>
              <tbody>{savedDesigns.map(item=><tr key={item.designId}>
                <td><strong>{item.designId}</strong></td>
                <td>{dateLabel(item.createdAtUtc)}</td>
                <td>{item.layout==='within'?'Stars woven into photo':item.layout==='above'?'Sky above photo':'Unknown'}</td>
                <td>{item.finish}</td>
                <td>{paidDesignIds.has(item.designId)
                  ?<span className="production-status">Paid Etsy order matched</span>
                  :testDesignIds.has(item.designId)
                    ?<span className="production-saved-test-state">
                      <span className="production-status production-test-label">
                        TEST ORDER · No Etsy payment required</span>
                      <button type="button" className="production-row-link"
                        onClick={()=>{setTestSelected(item.designId);setSelected(null)}}>
                        Open simulated work order</button>
                    </span>
                    :<span className="production-status">
                      Saved draft · Test purchase not yet registered
                    </span>}
                </td>
              </tr>)}</tbody>
            </table>
          </div>
          {!savedDesigns.length&&!savedDesignsError&&<div className="production-empty">
            <h3>No saved designs yet</h3>
            <p>Customer designs appear here after a successful private save; paid Etsy orders appear in the register below.</p>
          </div>}
          <p className="production-design-privacy">Only IDs and basic layout settings are shown.
            Photos and private reopening keys remain inaccessible from this list.</p>
        </section>
        <section className="production-data">
          <div className="production-actions">
            <div><h2>Etsy order register</h2><p>Latest 100 imported receipts; each sync checks the 10 most recently updated.</p></div>
            <div className="production-controls">
              <button type="button" disabled={busy} onClick={() => void refresh(false)}>Refresh</button>
              <button type="button" disabled={busy || !data} onClick={downloadCsv}>Export CSV</button>
              <button type="button" disabled={busy} className="production-primary"
                onClick={() => void refresh(true)}>{busy ? 'Working…' : 'Sync Etsy now'}</button>
            </div>
          </div>
          {failure && <p role="alert" className="production-error">{failure}</p>}
          {message && <p role="status" className="production-success">{message}</p>}
          <div className="production-filters" role="group" aria-label="Filter receipts">
            {([
              ['all', 'All'],['review', 'Needs review'],['ready', 'Ready'],['canceled', 'Canceled']
            ] as const).map(([id, label]) =>
              <button key={id} type="button" aria-pressed={filter === id}
                className={filter === id ? 'production-selected-filter' : ''}
                onClick={() => {setFilter(id);setSelected(null)}}>{label}</button>
            )}
          </div>
          <div className="production-table-scroll">
            <table className="production-table">
              <thead><tr><th>ETSY ORDER</th><th>CREATED</th><th>AMOUNT PAID</th>
                <th>PAYMENT</th><th>ITEMS</th><th>DESIGN</th><th>PRODUCTION</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.receipt.receipt_id}
                className={selected === row.receipt.receipt_id ? 'production-active-row' : ''}>
                <td><button type="button" className="production-row-link"
                  onClick={() => setSelected(row.receipt.receipt_id)}>
                  #{row.receipt.receipt_id}</button></td>
                <td>{dateLabel(row.receipt.created_at_etsy)}</td>
                <td>{money(row.receipt)}</td>
                <td>{receiptStatus(row.receipt)}</td>
                <td>{row.items.length} line{row.items.length === 1 ? '' : 's'}</td>
                <td>{row.items.length === 1 ? (row.items[0].design_id ?? 'Not matched') :
                  row.items.length > 1 ? 'Multiple' : '—'}</td>
                <td><span className="production-status">{row.state}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!rows.length && <div className="production-empty">
            <span aria-hidden="true">✧</span>
            <h3>No orders in this view</h3>
            <p>Use <strong>Sync Etsy now</strong> to import recent Etsy receipts. Only paid,
              non-canceled, matched single-unit orders become pending production jobs.</p>
          </div>}
        </section>
        {selectedRow && <section className="production-details" aria-label="Order details">
          <div className="production-detail-heading">
            <div><p className="production-eyebrow">ORDER DETAILS</p>
              <h2>Etsy #{selectedRow.receipt.receipt_id}</h2></div>
            <button type="button" className="production-ghost" onClick={() => setSelected(null)}>Close ×</button>
          </div>
          {materialsError&&<p role="alert" className="production-error">{materialsError}</p>}
          {selectedRow.items.map(item => {
            const job = selectedRow.jobs.find(x => x.transaction_id === item.transaction_id)
            const design = savedDesigns.find(x=>x.designId===item.design_id)
            const eligible = receiptStatus(selectedRow.receipt)==='Paid' &&
              item.match_state==='matched'&&item.quantity===1&&Boolean(job)&&
              job?.status!=='hold'&&job?.status!=='complete'
            const bom=eligible?materialsForProductionJob(materials,
              selectedRow.receipt.shop_id,selectedRow.receipt.receipt_id,item.transaction_id):null
            return <article key={item.transaction_id} className="production-item production-item-with-parts">
              <div><h3>{item.title}</h3>
                <p>Transaction #{item.transaction_id} · Quantity {item.quantity}</p>
                <p>Design: <strong>{item.design_id ?? 'No verified design linked'}</strong></p>
                {design&&<p className="production-design-spec">
                  Frame: <strong>{design.finish==='ebony'?'Matte black':design.finish==='walnut'?'Two-tone walnut':design.finish}</strong>
                  {' · '}{design.layout==='within'?'Stars within photograph':'Sky above photograph'}
                </p>}
              </div>
              <div><p>Design match: <strong>{item.match_state.replace(/_/g, ' ')}</strong></p>
                <p>Job: <strong>{job?.status.replace(/_/g, ' ') ?? 'Not created'}</strong></p>
                {!eligible&&<small>Do not purchase materials for this item until it has
                  a verified paid, matched, active production job.</small>}
                {receiptStatus(selectedRow.receipt)==='Paid'&&item.match_state!=='matched'&&
                  <small>Etsy file uploads are visual references, not automatic Design ID
                    matches. Ask the buyer to provide their SK Design ID in Etsy's
                    text personalization and review the unmatched order before building.</small>}
                {eligible&&<small>Match the saved frame finish to the variation the buyer
                  selected on Etsy before preparing this physical order.</small>}
              </div>
              {receiptStatus(selectedRow.receipt)==='Paid'&&
                item.match_state==='matched'&&item.quantity===1&&Boolean(job)&&
                item.design_id===job?.design_id&&item.design_id&&
                <OwnerProductionFiles key={item.transaction_id} adminKey={key}
                  receiptId={selectedRow.receipt.receipt_id}
                  transactionId={item.transaction_id} designId={item.design_id}
                  materials={materials}/>}
              {eligible&&<div className="production-job-bom">
                <h4>Existing M3 recipe snapshot — verify against the N-star plan above</h4>
                {!bom?.prepared
                  ?<p>{bom?.note??'Load M3 inventory before preparing a shopping list.'}
                    {' '}<a href="#materials-planning">Prepare a matching frame BOM in M3</a></p>
                  :<>
                    <p>{bom.note} The M3 recipe uses fixed per-frame quantities;
                      it is NOT guaranteed to equal the saved number of physical stars.
                      Do not purchase from this snapshot until the differences are reconciled.</p>
                    <div className="production-table-scroll"><table className="production-table">
                      <thead><tr><th>PART</th><th>JOB REQUIREMENT</th><th>GLOBAL STOCK</th><th>ON ORDER</th></tr></thead>
                      <tbody>{bom.rows.map(row=><tr key={row.sku}>
                        <td><strong>{row.name}</strong><small>{row.sku}</small></td>
                        <td>{row.required} {row.unit}</td>
                        <td>{row.physicalOnHand} {row.unit}</td>
                        <td>{row.pendingFromSuppliers} {row.unit}</td>
                      </tr>)}</tbody>
                    </table></div>
                    <p><a href="#manual-amazon-purchasing">
                      View combined Amazon shopping checklist and manually record orders</a></p>
                  </>}
              </div>}
            </article>
          })}
          {!selectedRow.items.length && <p>There are no Etsy transactions saved for this receipt yet.</p>}
        </section>}
        <ManualAmazonPurchasingPanel adminKey={key} refreshVersion={manualQueueVersion} />
        <MaterialsPanel adminKey={key} />
        <ProcurementPanel adminKey={key} />
        <p className="production-footnote">This studio never places purchases, changes Etsy orders,
          or launches fabrication. Order amounts include Etsy receipt totals, not net profit.</p>
      </>}
    </div>
  </main>
}
