import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import './ProductionDashboardPage.css'
import { MaterialsPanel } from './MaterialsPanel'
import { ProcurementPanel } from './ProcurementPanel'
import { ManualAmazonPurchasingPanel } from './ManualAmazonPurchasingPanel'
import { SupplierCatalogTable } from './SupplierCatalogTable'
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
type StudioTab = 'orders'|'shopping'|'operations'
type OrderModule = 'parts'|'checklist'|'files'
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
  const [activeTab,setActiveTab]=useState<StudioTab>('orders')
  const [shoppingQueueOpen,setShoppingQueueOpen]=useState(false)
  const [focusMaterials,setFocusMaterials]=useState(false)
  const [orderKind,setOrderKind]=useState<'all'|'test'|'etsy'>('all')
  const [orderSearch,setOrderSearch]=useState('')
  const [orderModule,setOrderModule]=useState<OrderModule|null>(null)
  const [orderTransaction,setOrderTransaction]=useState<number|null>(null)
  const modalCloseRef=useRef<HTMLButtonElement|null>(null)
  const modalReturnRef=useRef<HTMLButtonElement|null>(null)
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
  // The Operations receipt filter must not affect a selected card in Orders.
  const selectedRow = data&&selected!==null?(()=>{
    const receipt=data.receipts.find(x=>x.receipt_id===selected)
    return receipt?{receipt,
      items:data.items.filter(x=>x.receipt_id===receipt.receipt_id),
      jobs:data.jobs.filter(x=>x.receipt_id===receipt.receipt_id),
      state:orderState(receipt,data.items,data.jobs)}:undefined
  })():undefined
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
  const selectedTestOrder=testOrders.find(order=>order.designId===testSelected)
  const matchedItems=selectedRow?.items.filter(item=>{
    const job=selectedRow.jobs.find(row=>row.transaction_id===item.transaction_id)
    return receiptStatus(selectedRow.receipt)==='Paid'&&
      item.match_state==='matched'&&item.quantity===1&&Boolean(item.design_id)&&
      job?.design_id===item.design_id
  })??[]
  const chosenItem=matchedItems.find(item=>item.transaction_id===orderTransaction)
    ??matchedItems[0]??null
  const orderCards=useMemo(()=>{
    const tests=testOrders.map(item=>({
      key:'test:'+item.designId,kind:'test' as const,id:item.designId,
      date:item.createdAt,finish:item.finish,title:'Custom illuminated keepsake',
      status:'Internal test · unpaid',stars:item.stars,receiptId:null as number|null,
      amount:'—',
    }))
    const genuine=(data?.receipts||[]).map(receipt=>{
      const item=data?.items.find(row=>row.receipt_id===receipt.receipt_id)
      const design=savedDesigns.find(d=>d.designId===item?.design_id)
      return {key:'etsy:'+receipt.receipt_id,kind:'etsy' as const,
        id:item?.design_id||'#'+receipt.receipt_id,date:receipt.created_at_etsy,
        finish:design?.finish||'Verify finish',title:item?.title||'Etsy purchase',
        status:orderState(receipt,data!.items,data!.jobs),
        stars:null as number|null,receiptId:receipt.receipt_id,amount:money(receipt)}
    })
    return [...tests,...genuine].sort((a,b)=>
      (Date.parse(b.date||'')||0)-(Date.parse(a.date||'')||0))
  },[testOrders,data,savedDesigns])
  const filteredOrderCards=orderCards.filter(card=>
    (orderKind==='all'||card.kind===orderKind)&&
    [card.id,card.title,card.finish,card.status,
      String(card.receiptId||'')].join(' ').toLowerCase().includes(orderSearch.toLowerCase().trim())
  )
  const ordersSelected=Boolean(selectedTestOrder||selectedRow)

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
      if(requested&&json.orders.some(row=>row.designId===requested)){
        setTestSelected(requested)
        setSelected(null)
        setActiveTab('orders')
      }
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
    if(!key||!testSelected||activeTab!=='orders')return
    document.getElementById('studio-work-order')?.scrollIntoView({
      behavior:'smooth',block:'start'
    })
  },[key,testSelected,testOrders,activeTab])
  useEffect(()=>{
    if(activeTab!=='operations'||!focusMaterials)return
    const frame=window.requestAnimationFrame(()=>{
      document.getElementById('materials-planning')?.scrollIntoView({
        behavior:'smooth',block:'start'
      })
      setFocusMaterials(false)
    })
    return()=>window.cancelAnimationFrame(frame)
  },[activeTab,focusMaterials])
  useEffect(()=>{
    if(!orderModule)return
    const restore=document.body.style.overflow
    document.body.style.overflow='hidden'
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setOrderModule(null);return}
      // Keep keyboard focus inside the chosen work module until it closes.
      if(event.key!=='Tab')return
      const dialog=modalCloseRef.current?.closest('[role="dialog"]')
      const choices=dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')
      if(!choices?.length)return
      const first=choices[0],last=choices[choices.length-1]
      if(event.shiftKey&&document.activeElement===first){
        event.preventDefault();last.focus()
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();first.focus()
      }
    }
    window.addEventListener('keydown',onKey)
    modalCloseRef.current?.focus()
    return()=>{
      window.removeEventListener('keydown',onKey)
      document.body.style.overflow=restore
      modalReturnRef.current?.focus()
    }
  },[orderModule])

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
      setOrderModule(null)
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
          setOrderModule(null);
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
        <nav className="studio-main-nav" aria-label="Production Studio sections">
          {([
            ['orders','Orders',orderCards.length],
            ['shopping','Shopping & suppliers',null],
            ['operations','Operations',null],
          ] as const).map(([id,label,count])=><button type="button" key={id}
            aria-current={activeTab===id?'page':undefined}
            className={activeTab===id?'studio-nav-active':''}
            onClick={()=>{
              setActiveTab(id)
              setOrderModule(null)
            }}>
            {label}{count!==null&&<span>{count}</span>}
          </button>)}
        </nav>
        {activeTab==='orders'&&<section className="studio-orders" aria-label="Order workspace">
          {!ordersSelected?<><header className="studio-section-head">
            <div><span className="production-eyebrow">WORKSHOP / CURRENT ORDERS</span>
              <h2>All your orders</h2>
              <p>Real Etsy receipts and internal tests in one place. Only genuinely paid,
                matched Etsy orders count toward sales.</p></div>
            <button type="button" className="studio-light-button"
              disabled={busy} onClick={()=>void refresh(false)}>
              {busy?'Refreshing…':'Refresh orders'}</button>
          </header>
          {testError&&<p className="production-error" role="alert">{testError}</p>}
          {failure&&<p className="production-error" role="alert">{failure}</p>}
          <div className="studio-orders-toolbar">
            <div className="studio-order-filters" role="group" aria-label="Order type">
              {([['all','All'],['test','Tests'],['etsy','Etsy']] as const)
                .map(([id,label])=><button key={id} type="button"
                  aria-pressed={orderKind===id} onClick={()=>setOrderKind(id)}>{label}</button>)}
            </div>
            <label className="studio-order-search"><span className="sr-only">Search orders</span>
              <input type="search" value={orderSearch}
                onChange={e=>setOrderSearch(e.target.value)}
                placeholder="Search order or Design ID…"/></label>
          </div>
          {filteredOrderCards.length?
            <div className="studio-order-grid">
              {filteredOrderCards.map(card=><button type="button" key={card.key}
                className="studio-order-card" onClick={()=>{
                  setOrderModule(null);setOrderTransaction(null)
                  if(card.kind==='test'){
                    setTestSelected(card.id);setSelected(null)
                  }else{
                    setSelected(card.receiptId);setTestSelected(null);setFilter('all')
                  }
                }}>
                <span className="studio-order-card-top">
                  <span className={'studio-order-chip studio-order-chip-'+card.kind}>
                    {card.kind==='test'?'TEST · UNPAID':'ETSY'}</span>
                  <span className="studio-order-arrow" aria-hidden="true">↗</span>
                </span>
                <strong>{card.id}</strong>
                <span className="studio-order-card-title">{card.title}</span>
                <span className="studio-order-card-divider"/>
                <span className="studio-order-card-detail">
                  <span>{card.kind==='test'?'Created':'Ordered'}</span>
                  <b>{dateLabel(card.date)}</b>
                </span>
                <span className="studio-order-card-detail">
                  <span>Frame</span><b>{card.finish==='walnut'?'Two-tone walnut':
                    card.finish==='ebony'?'Matte black':card.finish}</b>
                </span>
                <span className="studio-order-card-detail">
                  <span>Status</span><b>{card.status}</b>
                </span>
                {card.kind==='etsy'&&<span className="studio-order-card-detail">
                  <span>Receipt total</span><b>{card.amount}</b>
                </span>}
                {card.kind==='test'&&<span className="studio-order-card-hint">
                  {card.stars} physical stars</span>}
              </button>)}
            </div>:<div className="studio-order-empty">
              <h3>No orders to display</h3>
              <p>{orderCards.length?'Clear the filters to see other orders.':
                'Finish a keepsake and click Simulate Etsy Purchase to create your first test work order.'}</p>
              <a href="/">Open the keepsake builder ↗</a>
            </div>}
          </>:<div className="studio-order-workspace" id="studio-work-order">
            <button type="button" className="studio-back-link" onClick={()=>{
              setSelected(null);setTestSelected(null);setOrderModule(null)
            }}>← All orders</button>
            <div className="studio-workspace-header">
              <div>
                <span className="production-eyebrow">{selectedTestOrder?
                  'INTERNAL TEST · NEVER PAID':'ETSY RECEIPT · VERIFIED STATUS'}</span>
                <h2>{selectedTestOrder?.designId||'Etsy #'+selectedRow?.receipt.receipt_id}</h2>
                <p>{selectedTestOrder?'Simulated on ':'Etsy order placed '}
                  {dateLabel(selectedTestOrder?.createdAt||selectedRow?.receipt.created_at_etsy||null)}
                  {' · '}{selectedTestOrder?.finish==='walnut'?'Two-tone walnut':
                    selectedTestOrder?.finish==='ebony'?'Matte black':
                      selectedTestOrder?.finish||selectedRow?.state}
                  {selectedTestOrder?' · '+selectedTestOrder.stars+' physical stars':
                    selectedRow?' · '+money(selectedRow.receipt):''}</p>
              </div>
              {selectedTestOrder&&<button type="button" className="production-test-delete"
                disabled={testDeleting===selectedTestOrder.designId}
                onClick={()=>void deleteTestOrder(selectedTestOrder.designId)}>
                {testDeleting===selectedTestOrder.designId?'Deleting…':'Delete test order'}
              </button>}
            </div>
            {!selectedTestOrder&&selectedRow&&<>
              <p className="studio-payment-note">Payment: <strong>
                {receiptStatus(selectedRow.receipt)}</strong>.
                {' '}Only a paid, matched single-item Etsy transaction can open manufacturing modules.</p>
              {matchedItems.length>1&&<label className="studio-transaction-picker">
                Item to inspect
                <select value={chosenItem?.transaction_id??''}
                  onChange={e=>setOrderTransaction(Number(e.target.value))}>
                  {matchedItems.map(item=><option key={item.transaction_id}
                    value={item.transaction_id}>{item.title} · #{item.transaction_id}</option>)}
                </select>
              </label>}
              {!chosenItem&&<div className="studio-order-not-ready">
                <strong>Manufacturing files unavailable until this item is verified.</strong>
                <p>This receipt may be unpaid, canceled, refunded, multi-item, or missing
                  the customer's text Design ID. Review it in Operations before building
                  or purchasing parts.</p>
                <button type="button" className="studio-light-button"
                  onClick={()=>setActiveTab('operations')}>Review Etsy receipt ↗</button>
              </div>}
            </>}
            {(selectedTestOrder||chosenItem)&&<>
              <p className="studio-module-intro">Choose what you need for this order.</p>
              <div className="studio-module-grid">
                {([
                  ['parts','Parts & supplies','See every component and update this order’s sourcing status.','01'],
                  ['checklist','Build checklist','Track the assembly, testing and quality-control steps.','02'],
                  ['files','Artwork & files','Open the exact photo, star map and print-ready downloads.','03'],
                ] as const).map(([id,title,description,num])=><button
                  key={id} type="button" className="studio-module-card"
                  onClick={event=>{
                    modalReturnRef.current=event.currentTarget
                    setOrderModule(id)
                  }}>
                  <span className="studio-module-number">{num} / WORK ORDER</span>
                  <strong>{title}</strong>
                  <p>{description}</p>
                  <span className="studio-module-open">Open module ↗</span>
                </button>)}
              </div>
              {selectedTestOrder&&<p className="studio-workspace-footnote">
                TEST ONLY · No Etsy payment, supplier purchase or stock reservation.
                Progress is saved independently for this Design ID.</p>}
            </>}
          </div>}
        </section>}
        {activeTab==='shopping'&&<section className="studio-shopping" aria-label="Shopping and suppliers">
          <header className="studio-section-head">
            <div><span className="production-eyebrow">SOURCING / PURCHASING</span>
              <h2>Shopping & suppliers</h2>
              <p>Find each component and its source without mixing supplier
                research with real paid-order purchasing.</p></div>
          </header>
          <details className="studio-shopping-queue" open={shoppingQueueOpen}
            onToggle={event=>setShoppingQueueOpen(event.currentTarget.open)}>
            <summary><span><strong>Amazon shopping checklist</strong>
              <small>View actual paid-order shortages, pack mappings and manually
                record purchases already placed</small></span>
              <span aria-hidden="true">＋</span></summary>
            {shoppingQueueOpen&&<ManualAmazonPurchasingPanel adminKey={key}
              refreshVersion={manualQueueVersion}
              onOpenMaterials={()=>{
                setFocusMaterials(true);setActiveTab('operations')
              }}/>} 
          </details>
          <SupplierCatalogTable materials={materials} onManage={()=>{
            setFocusMaterials(true);setActiveTab('operations')
          }}/>
        </section>}
        {activeTab==='operations'&&<>
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
        <details className="studio-legacy-demo">
          <summary>Open the old sample work order (reference only)</summary>
          <SampleProductionOrder />
        </details>
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
                    <p><button type="button" className="production-row-link"
                      onClick={()=>{setActiveTab('shopping');setShoppingQueueOpen(true)}}>
                      View combined Amazon shopping checklist and manually record orders</button></p>
                  </>}
              </div>}
            </article>
          })}
          {!selectedRow.items.length && <p>There are no Etsy transactions saved for this receipt yet.</p>}
        </section>}
        <MaterialsPanel adminKey={key} />
        <ProcurementPanel adminKey={key} />
        <p className="production-footnote">This studio never places purchases, changes Etsy orders,
          or launches fabrication. Order amounts include Etsy receipt totals, not net profit.</p>
        </>}
        {orderModule&&(selectedTestOrder||chosenItem)&&<div
          className="studio-modal-backdrop" role="presentation"
          onMouseDown={event=>{if(event.currentTarget===event.target)
            setOrderModule(null)}}>
          <section className="studio-module-dialog" role="dialog" aria-modal="true"
            aria-labelledby="studio-module-dialog-title">
            <div className="studio-dialog-topbar">
              <div><span className="production-eyebrow">
                {selectedTestOrder?'SIMULATED · NO PAYMENT':'VERIFIED ETSY ORDER'}
              </span>
                <h2 id="studio-module-dialog-title">{orderModule==='parts'?
                  'Parts & supplies':orderModule==='checklist'?
                    'Build checklist':'Artwork & files'}</h2>
                <p>{selectedTestOrder?.designId||chosenItem?.design_id}
                  {' · '}All changes stay scoped to this order.</p></div>
              <button type="button" ref={modalCloseRef} className="studio-dialog-close"
                onClick={()=>setOrderModule(null)} aria-label="Close module">×</button>
            </div>
            <div className="studio-dialog-body">
              <OwnerProductionFiles
                key={(selectedTestOrder?.designId||chosenItem?.design_id||'')+orderModule}
                adminKey={key}
                simulated={Boolean(selectedTestOrder)}
                receiptId={selectedTestOrder?0:selectedRow!.receipt.receipt_id}
                transactionId={selectedTestOrder?0:chosenItem!.transaction_id}
                designId={selectedTestOrder?.designId||chosenItem!.design_id!}
                module={orderModule} materials={materials}/>
            </div>
          </section>
        </div>}
      </>}
    </div>
  </main>
}
