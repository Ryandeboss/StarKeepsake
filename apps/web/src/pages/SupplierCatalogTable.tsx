import {useMemo,useState} from 'react'
import type {MaterialSnapshot} from '../manualAmazonQueue'
import {SUPPLIER_CANDIDATES} from '../supplierCandidates'
import './SupplierCatalogTable.css'

type Item={
  id:string;name:string;url:string|null;price:number|null;notes:string;
  source:'saved'|'research'
}
const price=(cents:number|null)=>cents===null?'—':
  new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)
const safe=(url:string|null|undefined)=>/^https:\/\//i.test(url||'')?url!:null

export function SupplierCatalogTable({materials,onManage}:{
  materials:MaterialSnapshot|null;onManage:()=>void
}){
  const [search,setSearch]=useState('')
  const rows=useMemo<Item[]>(()=>[
    ...(materials?.parts||[]).map(part=>({
      id:'catalog-'+part.sku,name:part.name,url:safe(part.supplier_url),
      price:part.unit_cost_cents,notes:part.notes||'—',source:'saved' as const
    })),
    ...SUPPLIER_CANDIDATES.map(part=>({
      id:'research-'+part.key,name:part.product,url:safe(part.url),
      price:null,notes:part.notes,source:'research' as const
    }))
  ],[materials])
  const visible=rows.filter(item=>
    (item.name+' '+item.notes).toLowerCase().includes(search.trim().toLowerCase()))
  return <section className="studio-suppliers">
    <div className="studio-sheet-toolbar">
      <input aria-label="Search parts" type="search"
        placeholder="Search parts…" value={search}
        onChange={e=>setSearch(e.target.value)}/>
      <button type="button" onClick={onManage}>Edit my catalog →</button>
    </div>
    <div className="studio-sheet-scroll" role="region"
      aria-label="Supplier spreadsheet" tabIndex={0}>
      <table className="studio-sheet-table">
        <thead><tr><th>Item</th><th>Supplier link</th>
          <th>Saved price</th><th>Notes</th></tr></thead>
        <tbody>{visible.map(item=><tr key={item.id}>
          <td><strong>{item.name}</strong></td>
          <td>{item.url?<a target="_blank" rel="noopener noreferrer"
            href={item.url}>Open website ↗</a>:<span>—</span>}</td>
          <td>{price(item.price)}</td>
          <td>{item.notes==='—'?'—':item.notes}
            {item.source==='research'&&<span className="studio-sheet-research">
              Research only</span>}</td>
        </tr>)}</tbody>
      </table>
      {!visible.length&&<div className="studio-sheet-empty">No matching items.</div>}
    </div>
    <div className="studio-sheet-note">Prices are saved estimates, not live quotes.</div>
  </section>
}
