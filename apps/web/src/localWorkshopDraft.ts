import type { DesignSpec } from './designSpec'
import type { LocationCandidate } from './api'
import type { WorkshopDetection } from './skyBlend'
import type { RoomScene } from './components/HomeShowroomOptions'
import type { AbovePhotoFitMode } from './frameSkyBalance'

const DB_NAME = 'starkeepsake-local-workshop'
const STORE_NAME = 'workshop-drafts'
const KEY = 'current-draft'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export type DraftStage = 'welcome'|'detecting'|'choice'|'refine'|'moment'|'calculating'|'preview'|'home'
export type LocalWorkshopDraft = {
  version: 1
  savedAtMs: number
  photo: Blob
  design: DesignSpec
  stage: DraftStage
  dimensions: {width:number;height:number}
  placement: 'above'|'within'
  detected: WorkshopDetection|null
  cutout: Blob|null
  savedAlpha: Uint8ClampedArray|null
  showMask: boolean
  date: string
  time: string
  unknownTime: boolean
  query: string
  selected: LocationCandidate|null
  offline: boolean
  heading: number
  pitch: number
  fov: number
  skyPercent: number
  photoFit: AbovePhotoFitMode
  atmosphericGlow: boolean
  skyTone: 'natural'|'indigo'|'teal'
  lightsOn: boolean
  finish: 'walnut'|'oak'|'ebony'
  room: RoomScene
  inscription: string
  // Never include a private reopening access key, payment or customer identity.
}

/** A refresh cannot resume unfinished network astronomy, but can retain its inputs. */
export function resumedDraftStage(stage: DraftStage, hasSky: boolean): DraftStage {
  if (stage==='calculating')return 'moment'
  if ((stage==='preview'||stage==='home')&&!hasSky)return 'moment'
  return stage
}

/** Expiry is a privacy control for shared-device photo drafts. */
export function isUsableLocalDraft(value: unknown, now=Date.now()): value is LocalWorkshopDraft {
  if(!value||typeof value!=='object')return false
  const d=value as Partial<LocalWorkshopDraft>
  return d.version===1 && typeof d.savedAtMs==='number' &&
    Number.isFinite(d.savedAtMs) && d.savedAtMs<=now+60_000 &&
    now-d.savedAtMs<=MAX_AGE_MS && d.photo instanceof Blob &&
    d.photo.size>0 && d.photo.size<=MAX_PHOTO_BYTES &&
    ['image/jpeg','image/png','image/webp'].includes(d.photo.type) &&
    !!d.dimensions && Number.isFinite(d.dimensions.width) &&
    Number.isFinite(d.dimensions.height) &&
    d.dimensions.width>0 && d.dimensions.height>0 &&
    !!d.design && typeof d.design==='object' &&
    d.design.schemaVersion==='1.5' &&
    ['welcome','detecting','choice','refine','moment','calculating','preview','home'].includes(d.stage??'') &&
    (d.placement==='above'||d.placement==='within') &&
    (d.cutout===null||d.cutout instanceof Blob) &&
    (d.detected===null|| (!!d.detected &&
      d.detected.overlay instanceof Blob &&
      d.detected.alpha instanceof Uint8ClampedArray))
}

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('Browser storage is unavailable.'));return}
    const request=indexedDB.open(DB_NAME,1)
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME)
    }
    request.onerror=()=>reject(request.error??new Error('Cannot access private browser storage.'))
    request.onsuccess=()=>resolve(request.result)
    request.onblocked=()=>reject(new Error('Close other StarKeepsake tabs and try again.'))
  })
}
async function transact<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await openDb()
  return new Promise<T>((resolve,reject)=>{
    let result:T
    let done=false
    try{
      const transaction=db.transaction(STORE_NAME,mode)
      const request=operation(transaction.objectStore(STORE_NAME))
      request.onsuccess=()=>{result=request.result}
      const fail=(error:unknown)=>{
        if(done)return
        done=true
        db.close()
        reject(error instanceof Error?error:new Error('Could not use private browser storage.'))
      }
      transaction.oncomplete=()=>{
        if(done)return
        done=true
        db.close()
        resolve(result)
      }
      transaction.onerror=()=>fail(transaction.error)
      transaction.onabort=()=>fail(transaction.error)
    }catch(e){
      db.close()
      reject(e)
    }
  })
}

// Mutations are serialized so an older slow write cannot replace a newer
// upload and so Clear Draft always runs after any queued local writes.
let mutations:Promise<unknown>=Promise.resolve()
function serialize<T>(run:()=>Promise<T>):Promise<T>{
  const next=mutations.catch(()=>undefined).then(run)
  mutations=next.catch(()=>undefined)
  return next
}

export async function readLocalWorkshopDraft():Promise<LocalWorkshopDraft|null>{
  await mutations.catch(()=>undefined)
  const value=await transact<unknown>('readonly',store=>store.get(KEY))
  if(!isUsableLocalDraft(value)){
    if(value)await clearLocalWorkshopDraft()
    return null
  }
  return value
}
export function writeLocalWorkshopDraft(draft:LocalWorkshopDraft):Promise<void>{
  return serialize(async()=>{await transact<IDBValidKey>('readwrite',store=>store.put(draft,KEY))})
}
export function clearLocalWorkshopDraft():Promise<void>{
  return serialize(async()=>{await transact<undefined>('readwrite',store=>store.delete(KEY))})
}
