import type {DesignSpec} from './designSpec'

export const TRIAL_DATE='2024-07-04'
export const TRIAL_TIME='21:00'
export const TRIAL_REFERENCE='TRIAL-NO-ETSY-PAYMENT'

/** Synthetic landscape generated only in the browser: no private image, no upload. */
export async function createTrialPhoto():Promise<File>{
  const c=document.createElement('canvas')
  c.width=3600;c.height=2700
  const ctx=c.getContext('2d')
  if(!ctx)throw Error('Your browser cannot generate the sample photograph.')
  const sky=ctx.createLinearGradient(0,0,0,c.height)
  sky.addColorStop(0,'#243951');sky.addColorStop(.45,'#c57f72')
  sky.addColorStop(.72,'#e7bc8f');sky.addColorStop(1,'#273d40')
  ctx.fillStyle=sky;ctx.fillRect(0,0,c.width,c.height)
  ctx.fillStyle='#f6cc9e';ctx.beginPath();ctx.arc(2580,980,230,0,Math.PI*2);ctx.fill()
  ctx.fillStyle='#577174';ctx.beginPath();ctx.moveTo(0,1880)
  for(const [x,y] of [[400,1510],[880,1810],[1410,1300],[1880,1610],[2450,1250],[3000,1680],[3600,1460]])
    ctx.lineTo(x,y)
  ctx.lineTo(3600,2700);ctx.lineTo(0,2700);ctx.fill()
  ctx.fillStyle='#263f46';ctx.beginPath();ctx.moveTo(0,2250)
  for(const [x,y] of [[490,2050],[840,2260],[1250,1950],[1740,2220],[2300,1880],[2960,2260],[3600,2000]])
    ctx.lineTo(x,y)
  ctx.lineTo(3600,2700);ctx.lineTo(0,2700);ctx.fill()
  ctx.fillStyle='#17313a';ctx.fillRect(0,2470,3600,230)
  ctx.fillStyle='rgba(255,250,221,.9)';ctx.font='bold 82px Georgia'
  ctx.fillText('STARKEEPSAKE · SYNTHETIC TEST PHOTOGRAPH',145,2530)
  ctx.font='43px sans-serif';ctx.fillText('No real customer • No payment • Trial data only',145,2610)
  const blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(
    x=>x?resolve(x):reject(Error('Could not encode trial photo.')),'image/png'))
  return new File([blob],'starkeepsake-trial-photo.png',{type:'image/png'})
}

/** Deterministic sky cutout for checking the woven-photo packet (NOT AI segmentation). */
export async function createTrialForeground(photo:File):Promise<Blob>{
  const source=await createImageBitmap(photo)
  try{
    const c=document.createElement('canvas');c.width=source.width;c.height=source.height
    const ctx=c.getContext('2d');if(!ctx)throw Error('Foreground mask canvas is unavailable.')
    ctx.drawImage(source,0,0)
    ctx.clearRect(0,0,c.width,Math.round(c.height*.42))
    return await new Promise<Blob>((resolve,reject)=>c.toBlob(
      x=>x?resolve(x):reject(Error('Could not prepare trial foreground.')),'image/png'))
  }finally{source.close()}
}

/** Offline fixture only when LIVE astronomy fails; marked as a test fallback. */
export function fallbackTrialStars():DesignSpec['stars']{
  return Array.from({length:90},(_,i)=>({
    hipparcosId:800000+i,
    xMm:10+(i%10)*25,
    yMm:20+Math.floor(i/10)*30,
    azimuthDeg:115+(i%10)*13,
    altitudeDeg:12+Math.floor(i/10)*7,
    magnitude:0.35+(i%7)*.67,
    holeSizeMm:.8,
    ledIndex:i,
  }))
}
export function fallbackTrialCalculation(dateTime:string):NonNullable<DesignSpec['astronomy']>{
  return {catalog:'hipparcos',ephemeris:'de440s',
    projection:'altaz-equirectangular',orientation:'north-center-east-right',
    calculationUtcDateTime:dateTime,timeBasis:'exact',magnitudeLimit:6,maxStars:96,
    minSeparationMm:4.5,visibleCatalogStars:90,projectedCandidates:90,selectedStars:90}
}
