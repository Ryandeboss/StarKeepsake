import type { ReactNode } from 'react'
import './HomeShowroom.css'

export type RoomScene = 'warm' | 'modern' | 'gallery'
export const ROOM_OPTIONS: ReadonlyArray<{id:RoomScene;label:string;symbol:string}> = [
  {id:'warm',label:'Warm living room',symbol:'⌂'},
  {id:'modern',label:'Modern loft',symbol:'▥'},
  {id:'gallery',label:'Gallery wall',symbol:'▦'},
]
export const WOOD_OPTIONS: ReadonlyArray<{
  id:'walnut'|'oak'|'ebony';label:string
}> = [
  {id:'walnut',label:'Warm walnut'},
  {id:'oak',label:'Natural oak'},
  {id:'ebony',label:'Ebony oak'},
]

/** A styled, non-AR room scene. Children are the real calculated-star preview,
 * not a static fabricated screenshot or a random star image. */
export function HomeShowroom({room,children}:{
  room:RoomScene;children:ReactNode
}) {
  const title=ROOM_OPTIONS.find(x=>x.id===room)?.label??'Living room'
  return <div className={`hsh-room hsh-room--${room}`}
    role="group" aria-label={`Your framed keepsake displayed in a simulated ${title.toLowerCase()}`}>
    <div className="hsh-wall-grain" aria-hidden="true"/>
    <div className="hsh-daylight" aria-hidden="true"/>
    <div className="hsh-window" aria-hidden="true"><i/><i/></div>
    <div className="hsh-artwork">{children}</div>
    <div className="hsh-gallery-light" aria-hidden="true"/>
    <div className="hsh-shelf" aria-hidden="true">
      <div className="hsh-shelf-top"/>
      <div className="hsh-book hsh-book-a"/>
      <div className="hsh-book hsh-book-b"/>
      <div className="hsh-vase"><i/><i/><i/></div>
      <div className="hsh-shelf-body"/>
      <div className="hsh-shelf-leg hsh-shelf-leg-left"/>
      <div className="hsh-shelf-leg hsh-shelf-leg-right"/>
    </div>
    <div className="hsh-floor" aria-hidden="true"/>
    <span className="hsh-scene-label">INTERIOR PREVIEW <i/> {title}</span>
    <span className="hsh-scene-hint">Move your pointer to inspect the frame in 3D</span>
  </div>
}
