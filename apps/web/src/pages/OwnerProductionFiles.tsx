import {useEffect,useMemo,useState} from 'react'
import {createCustomerPacket,downloadFile} from '../customerOrder'
import {PRINT_VARIANTS,trimSafeGuideSvg} from '../manufacturingPrint'
import type {PrintVariantId} from '../manufacturingPrint'
import type {LoadedDesign} from '../savedDesign'
import {buildManufacturingJobPlan} from '../manufacturingJobPlan'
import {OwnerManufacturingPlan} from './OwnerManufacturingPlan'
import type {MaterialSnapshot} from '../manualAmazonQueue'
import './OwnerProductionFiles.css'

const BASE=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,'')??''
type Packet=Awaited<ReturnType<typeof createCustomerPacket>>

export function OwnerProductionFiles({adminKey,receiptId,transactionId,designId,materials}:{
  adminKey:string;receiptId:number;transactionId:number;designId:string;
  materials:MaterialSnapshot|null
}){
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [packet,setPacket]=useState<Packet|null>(null)
  const [savedMeta,setSavedMeta]=useState<LoadedDesign|null>(null)
  const [metaError,setMetaError]=useState('')
  const [archive,setArchive]=useState<{archived:boolean;frozenAt:string|null;
    bytes:number|null}|null>(null)
  const [archiveBusy,setArchiveBusy]=useState(false)
  const [archiveError,setArchiveError]=useState('')
  const archiveUrl='/api/production/archive?receiptId='+receiptId+
    '&transactionId='+transactionId
  const url=BASE+'/api/admin/production/jobs/'+receiptId+'/¶»§q«^