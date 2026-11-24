import {useMemo,useState} from 'react'
import type {MaterialSnapshot} from '../manualAmazonQueue'
import {SUPPLIER_CANDIDATES} from '../supplierCandidates'
import './SupplierCatalogTable.css'

type SupplierRow={
  id:string;name:string;sku:string;website:string|null;supplier:string;
  price:number|null;unit:string;notes:string;source:'catalog'|'research';
  confidence:string;stock:number|null
}
const usd=(cents:number|null)=>cents===null?'Not recorded':
  new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)
const safeUrl=(value:string|null|undefined)=>{
  if(!value)return null
  try{
    const parsed=new URL(value)
    return ['https:','http:'].includes(parsed.protocol)?parsed.href:null
  }catch{return null}
}
export function SupplierCatalogTable({materials,onManage}:{
  materials:MaterialSnapshot|null;onManage:()=>void
}){
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState<'all'|'catalog'|'research'>('all')
  const rows=useMemo<SupplierRow[]>(()=>{
    const stored=(materials?.parts||[]).map(part=>({
      id:'m3:'+part.sku,sku:part.sku,name:part.name,
      website:safeUrl(part.supplier_url),supplier:part.supplier_name||'Not selected',
      price:part.unit_cost_cents,unit:part.unit,
      notes:part.notes||'Owner-managed M3 catalog entry. Validate exact supplier SKU and fit.',
      source:'catalog' as const,confidence:'Owner catalog · needs independent verification',
      stock:Number(part.on_hand),
    }))
    const researched=SUPPLIER_CANDIDATES.map(part=>({
      id:'research:'+part.key,sku:part.key.replaceAll('_','-').toUpperCase(),
      name:part.product,website:safeUrl(part.url),supplier:part.supplier,
      price:null,unit:'—',notes:part.notes,
      source:'research' as const,
      confidence:part.sourceConfidence,stock:null,
    }))
    return [...stored,...researched]
  },[materials])
  const shown=useMemo(()=>rows.filter(row=>
    (filter==='all'||row.source===filter)&&
    [row.name,row.sku,row.supplier,row.notes].join(' ').toLowerCase()
      .includes(query.trim().toLowerCase())
  ),[rows,filter,query])
  return <section className="studio-suppliers" aria-label="Supplier spreadsheet">
    <header className="studio-supplier-heading">
      <div>
        <span className="production-eyebrow">MASTER PARTS & SUPPLIERS</span>
        <h2>Supplier directory</h2>
        <p>One searchable table for your saved inventory products and researched sourcing options.
          Research links are candidates, not proof of physical compatibility or stock.</p>
      </div>
      <button className="studio-supplier-manage" type="button" onClick={onManage}>
        Edit catalog & prices <span aria-hidden="true">↗</span>
      </button>
    </header>
    <div className="studio-sheet-toolbar">
      <label className="studio-sheet-search">
        <span>Search products</span>
        <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
          placeholder="Name, SKU, supplier or notes…"/>
      </label>
      <div className="studio-sheet-filters" role="group" aria-label="Supplier row type">
        {([['all','All'],['catalog','My catalog'],['research','Research']] as const)
          .map(([value,label])=><button key={value} type="button"
            aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}
      </div>
      <span className="studio-sheet-count">{shown.length} products</span>
    </div>
    <div className="studio-sheet-scroll" role="region" aria-label="Products and supplier information" tabIndex={0}>
      <table className="studio-sheet-table">
        <thead><tr>
          <th scope="col">PRODUCT / SKU</th>
          <th scope="col">SUPPLIER</th>
          <th scope="col">WEBSITE</th>
          <th scope="col">PRICE / UNIT</th>
          <th scope="col">ON HAND</th>
          <th scope="col">SOURCE</th>
          <th scope="col">NOTES & VERIFICATION</th>
        </tr></thead>
        <tbody>{shown.map(row=><tr key={row.id}>
          <td><strong>{row.name}</strong><small>{row.sku}</small></td>
          <td>{row.supplier}</td>
          <td>{row.website?<a href={row.website} target="_blank" rel="noopener noreferrer">
            View product <span aria-hidden="true">↗</span></a>:
            <span className="studio-sheet-muted">No product link</span>}</td>
          <td><strong className="studio-sheet-price">{usd(row.price)}</strong>
            <small>{row.source==='catalog'?'Recorded M3 cost · not live':'No verified price'}{row.unit!=='—'?' / '+row.unit:''}</small></td>
          <td>{row.stock===null?'—':row.stock.toLocaleString('en-US')}</td>
          <td><span className={'studio-sheet-type studio-sheet-type-'+row.source}>
            {row.source==='catalog'?'My catalog':'Research only'}</span></td>
          <td><span className="studio-sheet-note">{row.notes}</span>
            <small>{row.confidence}</small></td>
        </tr>)}</tbody>
      </table>
      {!shown.length&&<div className="studio-sheet-empty">No matching products. Try another search or filter.</div>}
    </div>
    <p className="studio-sheet-footnote">
      <strong>Pricing:</strong> A price appears only when you have entered it in the M3 catalog.
      It is not a live Amazon or supplier quote. Open the supplier website to check current
      price, stock, shipping, tax, pack size and exact SKU before buying.
      No automatic purchase is initiated here.
    </p>
  </section>
}
