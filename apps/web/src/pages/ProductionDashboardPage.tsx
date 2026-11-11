import { useMemo, useState, type FormEvent } from 'react'
import './ProductionDashboardPage.css'
import { MaterialsPanel } from './MaterialsPanel'

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
type Filter = 'all' | 'review' | 'ready' | 'canceled'
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
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
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
  const paidCount = data?.receipts.filter(r => receiptStatus(r) === 'Paid').length ?? 0
  const reviewCount = data?.receipts.filter(r =>
    ['Review design','Refund review','Not paid','On hold'].includes(
      orderState(r, data.items, data.jobs))).length ?? 0

  async function load(adminKey: string) {
    const view = await api<Dashboard>('/api/admin/production/orders', adminKey)
    setData(view)
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
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Request failed.'
      if (text.includes('admin key')) { setKey(''); setData(null) }
      setFailure(text)
    } finally { setBusy(false) }
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
          setKey(''); setData(null); setSelected(null); setFailure(''); setMessage('')
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
          {selectedRow.items.map(item => {
            const job = selectedRow.jobs.find(x => x.transaction_id === item.transaction_id)
            return <article key={item.transaction_id} className="production-item">
              <div><h3>{item.title}</h3>
                <p>Transaction #{item.transaction_id} · Quantity {item.quantity}</p>
                <p>Design: <strong>{item.design_id ?? 'No verified design linked'}</strong></p>
              </div>
              <div><p>Design match: <strong>{item.match_state.replace(/_/g, ' ')}</strong></p>
                <p>Job: <strong>{job?.status.replace(/_/g, ' ') ?? 'Not created'}</strong></p>
                {job && <small>Pending your manual production review. No parts are ordered automatically.</small>}
              </div>
            </article>
          })}
          {!selectedRow.items.length && <p>There are no Etsy transactions saved for this receipt yet.</p>}
        </section>}
        <MaterialsPanel adminKey={key} />
        <p className="production-footnote">This studio never places purchases, changes Etsy orders,
          or launches fabrication. Order amounts include Etsy receipt totals, not net profit.</p>
      </>}
    </div>
  </main>
}
