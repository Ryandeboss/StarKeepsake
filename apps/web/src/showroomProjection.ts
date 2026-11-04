import type { PlateQuad } from './components/HomeShowroomOptions'

type Pt = readonly [number,number]
/** Unit-square -> normalized image quad projective transform. Unlike skew(),
 * this maps all four corners exactly, including camera-angled plates.
 */
export function quadHomography(q:PlateQuad):readonly number[]{
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q
  const dx1=x1-x2, dx2=x3-x2, dx3=x0-x1+x2-x3
  const dy1=y1-y2, dy2=y3-y2, dy3=y0-y1+y2-y3
  const denom=dx1*dy2-dx2*dy1
  let g=0,h=0
  if(Math.abs(dx3)+Math.abs(dy3)>1e-9){
    if(Math.abs(denom)<1e-9)throw new Error('Degenerate showroom quadrilateral.')
    g=(dx3*dy2-dx2*dy3)/denom
    h=(dx1*dy3-dx3*dy1)/denom
  }
  return [x1-x0+g*x1,x3-x0+h*x3,x0,
          y1-y0+g*y1,y3-y0+h*y3,y0,g,h]
}
export function mapUnitToQuad(q:PlateQuad,u:number,v:number):Pt{
  const [a,b,c,d,e,f,g,h]=quadHomography(q)
  const den=g*u+h*v+1
  return [(a*u+b*v+c)/den,(d*u+e*v+f)/den]
}
/** CSS matrix3d in CSS-pixel coordinates (source is full scene box).
 * Aspect compensation is critical when 1024x687 plates scale responsively.
 */
export function sceneQuadMatrix(q:PlateQuad,w:number,h:number):string{
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)
    return 'none'
  const [a,b,c,d,e,f,g,j]=quadHomography(q)
  const m=[a,d*h/w,0,g/w,
           b*w/h,e,0,j/h,
           0,0,1,0,
           c*w,f*h,0,1]
  if(m.some(value=>!Number.isFinite(value)))return 'none'
  return 'matrix3d('+m.map(v=>Number(v.toFixed(9))).join(',')+')'
}
export function quadAspect(q:PlateQuad,w:number,h:number):number{
  const dist=(a:Pt,b:Pt)=>Math.hypot((a[0]-b[0])*w,(a[1]-b[1])*h)
  const width=(dist(q[0],q[1])+dist(q[3],q[2]))/2
  const height=(dist(q[0],q[3])+dist(q[1],q[2]))/2
  return width/Math.max(height,1e-8)
}
/** Fit any original custom artwork inside fixed photographic opening.
 * This prevents distorting a customer's portrait into a landscape mockup.
 */
export function artworkFit(artAspect:number,slotAspect:number):{
  widthPercent:number;heightPercent:number; letterboxed:boolean
}{
  if(!Number.isFinite(artAspect)||!Number.isFinite(slotAspect)||
     artAspect<=0||slotAspect<=0)
    return {widthPercent:100,heightPercent:100,letterboxed:false}
  const widthPercent=Math.min(100,100*artAspect/slotAspect)
  const heightPercent=Math.min(100,100*slotAspect/artAspect)
  return {widthPercent,heightPercent,letterboxed:widthPercent<99.5||heightPercent<99.5}
}
