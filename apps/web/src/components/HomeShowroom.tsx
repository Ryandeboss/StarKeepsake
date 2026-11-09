import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SHOWROOM_PLATES } from './HomeShowroomOptions'
import type { RoomScene } from './HomeShowroomOptions'
import { artworkFit, quadAspect, sceneQuadMatrix } from '../showroomProjection'
import { removeGreenScreen } from '../showroomMatte'
import './HomeShowroom.css'

type Props={
  room:RoomScene;imageAspect:number;lightsOn:boolean;children:ReactNode
}
type LoadedPlate={id:RoomScene;url:string}

/** Chroma-key only the photographic green insert, retaining all physical
 * wood edges, real mat board, natural wall shadows and image perspective.
 * The user's live React star field is rendered BELOW the photographic plate.
 * No uploaded customer image is sent to an external image-processing API.
 */
export function HomeShowroom({room,imageAspect,lightsOn,children}:Props){
  const scene=SHOWROOM_PLATES[room]
  const shell=useRef<HTMLDivElement>(null)
  const [size,setSize]=useState({width:0,height:0})
  const [loaded,setLoaded]=useState<LoadedPlate|null>(null)
  const [failure,setFailure]=useState<RoomScene|null>(null)
  const [closer,setCloser]=useState(false)
  const [glass,setGlass]=useState(true)

  useEffect(()=>{
    const node=shell.current
    if(!node)return
    const update=()=>{
      const width=node.clientWidth,height=node.clientHeight
      setSize(prev=>Math.abs(prev.width-width)<.5&&Math.abs(prev.height-height)<.5
        ?prev:{width,height})
    }
    const observer=new ResizeObserver(update)
    observer.observe(node)
    update()
    return ()=>observer.disconnect()
  },[])

  useEffect(()=>{
    let dead=false
    let currentBlob:string|null=null
    const image=new Image()
    image.onload=()=>{
      try {
        const canvas=document.createElement('canvas')
        canvas.width=image.naturalWidth
        canvas.height=image.naturalHeight
        const ctx=canvas.getContext('2d',{willReadFrequently:true})
        if(!ctx)throw new Error('Could not initialize studio preview.')
        ctx.drawImage(image,0,0)
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height)
        pixels.data.set(removeGreenScreen(pixels.data,canvas.width,canvas.height))
        ctx.putImageData(pixels,0,0)
        canvas.toBlob(blob=>{
          if(!blob||dead){
            if(!dead)setFailure(room)
            return
          }
          currentBlob=URL.createObjectURL(blob)
          setLoaded({id:room,url:currentBlob})
        },'image/png')
      }catch{
        if(!dead)setFailure(room)
      }
    }
    image.onerror=()=>{if(!dead)setFailure(room)}
    image.src=scene.path
    return ()=>{
      dead=true
      image.onload=null
      image.onerror=null
      if(currentBlob)URL.revokeObjectURL(currentBlob)
    }
  },[room,scene.path])

  const fitted=artworkFit(imageAspect,quadAspect(scene.quad,scene.width,scene.height))
  const plateReady=loaded?.id===room
  const failed=failure===room
  const matrix=sceneQuadMatrix(scene.quad,size.width,size.height)

  return <div ref={shell}
    className={`hsh-room ${closer?'hsh-room--closer':''} ${lightsOn?'hsh-room--night':''}`}
    style={{aspectRatio:`${scene.width}/${scene.height}`}}
    role="group" aria-label={`Your custom StarKeepsake shown in the ${scene.label.toLowerCase()} photo mockup`}>
    <div className="hsh-world">
      {plateReady && <div className="hsh-projected-art"
        style={{transform:matrix,visibility:matrix==='none'?'hidden':'visible'}}>
        <div className="hsh-opening-matte">
          <div className="hsh-user-art" style={{
            width:`${fitted.widthPercent}%`,
            height:`${fitted.heightPercent}%`,
          }}>{children}</div>
          {glass&&<div className="hsh-glass" aria-hidden="true"/>}
        </div>
      </div>}
      {plateReady&&<img className="hsh-host-photo" src={loaded.url}
        alt="" draggable={false}/>}
      {!plateReady&&<div className="hsh-loading" role="status">
        {failed?'This scene could not load. Try another frame photograph.':
          'Preparing your photographic frame…'}
      </div>}
      <div className="hsh-photo-grade" aria-hidden="true"/>
    </div>

    <div className="hsh-scene-controls">
      <span className="hsh-scene-id"><i/>{scene.category==='studio'?'FRAME DETAIL':'IN A ROOM'} · {scene.label}</span>
      <div className="hsh-control-actions">
        <button type="button" aria-pressed={glass} onClick={()=>setGlass(v=>!v)}
          title="Show or hide subtle glass reflections">
          {glass?'✧ Glass on':'✧ Glass off'}
        </button>
        <button type="button" aria-pressed={closer} onClick={()=>setCloser(v=>!v)}>
          {closer?'↙ Room view':'↗ Closer'}
        </button>
      </div>
    </div>
    <span className="hsh-light-state">
      {lightsOn?'✦ STARS ILLUMINATED':'○ LIGHTS AT REST'}
    </span>
    <span className="hsh-production-note">
      AI-generated room / frame study · Digital product visualization
    </span>
    {fitted.letterboxed&&<span className="hsh-mat-hint">
      Artwork fitted without cropping or stretching
    </span>}
  </div>
}
