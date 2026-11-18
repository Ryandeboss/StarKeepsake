import {useEffect,useState} from 'react'
import {downloadFile} from '../customerOrder'
import {supplierCandidateFor} from '../supplierCandidates'
import type {MaterialSnapshot} from '../manualAmazonQueue'
import type {MakerGroup,MakerPart,MakerPlan} from '../manufacturingJobPlan'
import {makerPartsCsv,makerStarMapCsv,makerDrillTemplateSvg,makerChecklistJson}
  from '../manufacturingJobPlan'
import './OwnerManufacturingPlan.css'

const groups:readonly {id:MakerGroup;name:string;intro:string}[]=[
  {id:'buy',name:'Buy specifically for this order',
    intro:'Frame finish, professional print and print shop expense. Confirm exact Etsy variation and final quote.'},
  {id:'pack',name:'Pack Stock â€” consume per frame',
    intro:'Individual electronics, connector sets and packaging. These are not approved vendor SKUs.'},
  {id:'bulk',name:'Bulk Stock â€” cut and consume',
    intro:'Film, wire, adhesives, PVC board and strip stock. Unknown lengths remain TO MEASURE.'},
  {id:'make',name:'Make for this order',
    intro:'Fabrication and assembly tasks, based on the saved physical-star count.'},
]
const unitName=(x:number|null,unit:string)=>x===null?'TO MEASURE':x+' '+unit
function stockSnapshot(part:MakerPart,materials:MaterialSnapshot|null){
  const sku=part.skuHint?.toLowerCase()
  const found=sku?materials?.parts.find(p=>p.sku.toLowerCase()===sku):undefined
  if(!found)return null
  const pending=materials!.purchases.filter(p=>p.sku===found.sku&&
    ['ordered','partially_receive¶»§q«^