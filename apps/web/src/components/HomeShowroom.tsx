import type { ReactNode } from 'react'
import { ROOM_OPTIONS } from './HomeShowroomOptions'
import type { RoomScene } from './HomeShowroomOptions'
import './HomeShowroom.css'

const SCENES:Record<RoomScene,{url:string;photographer:string;credit:string}> = {
  warm:{
    url:'https://images.unsplash.com/photo-1585128792020-803d29415281?auto=format&fit=crop&w=1800&q=82',
    photographer:'Julia / Beazy',
    credit:'https://unsplash.com/photos/minimalist-living-room-with-wooden-sideboard-aX1TTOuq83M',
  },
  modern:{
    url:'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=1800&q=82',
    photographer:'Francesca Tosolini',
    credit:'https://unsplash.com/photos/empty-living-room-KJFKCed0YKo',
  },
  gallery:{
    url:'https://images.unsplash.com/photo-1773754532196-014342510e64?auto=format&fit=crop&w=1800&q=82',
    photographer:'Clay Banks',
    credit:'https://unsplash.com/photos/modern-living-room-with-stylish-furniture-and-large-windows-FL-ZcDK8tMo',
  },
}

/** The frame is the actual live astronomy preview superimposed over
 * licensed editorial interiors. This is product staging, not AR or a photo
 * of the customer's own room. */
export function HomeShowroom({room,imageAspect,children}:{
  room:RoomScene;imageAspect:number;children:ReactNode
}) {
  const scene=SCENES[room]
  const title=ROOM_OPTIONS.find(x=>x.id===room)?.label??'Living room'
  const aspect=Number.isFinite(imageAspect)?Math.max(.10,Math.min(3,imageAspect)):1
  const frameWidth=Math.max(90,Math.min(320,345*aspect))
  return <div className={`hsh-room hsh-room--${room}`}
    role="group" aria-label={`Your customized keepsake staged in a photographic ${title.toLowerCase()}`}>
    <img key={room} className="hsh-room-photo" src={scene.url}
      alt="" loading="eager" decoding="async" draggable={false}
      onError={event=>{event.currentTarget.style.opacity='0'}}/>
    <div className="hsh-room-shading" aria-hidden="true"/>
    <div className="hsh-artwork" style={{width:`min(45%, ${Math.round(frameWidth)}px)`}}>
      {children}
    </div>
    <span className="hsh-scene-label">INTERIOR STUDY <i/> {title}</span>
    <span className="hsh-scene-hint">Move your pointer gently to inspect the wood frame</span>
    <a className="hsh-photo-credit" href={scene.credit} target="_blank" rel="noopener noreferrer">
      Interior photo: {scene.photographer} / Unsplash
    </a>
  </div>
}
