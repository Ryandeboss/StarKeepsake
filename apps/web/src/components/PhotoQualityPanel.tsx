import { useState } from 'react'
import type { PhotoQualityReport } from '../photoPrintQuality'

type Props = {
  report: PhotoQualityReport
  photoUrl: string
  onReplacePhoto?: () => void
}
const regions = [
  { id: 'center', label: 'Center', position: {left:'50%',top:'50%',transform:'translate(-50%,-50%)'} },
  { id: 'top', label: 'Upper detail', position: {left:'50%',top:0,transform:'translateX(-50%)'} },
  { id: 'bottom', label: 'Lower detail', position: {left:'50%',bottom:0,transform:'translateX(-50%)'} },
] as const

/** Customer photo guidance only. Manufacturing print holds remain in the private owner workflow. */
function customerNote(note: string): string {
  if(note.startsWith('Insufficient original pixels'))
    return 'This photo has fewer pixels than ideal for the chosen print size. Inspect the details or choose a larger original if available.'
  if(note.startsWith('This saved artwork is not the required'))
    return 'This older composition uses a different print size. Its layout will need to be checked before making the frame.'
  if(note.startsWith('The current composition stretches'))
    return 'This layout may change the photo proportions. Check faces and other important details.'
  return note
}
export function PhotoQualityPanel({report, photoUrl, onReplacePhoto}:Props) {
  const [region,setRegion]=useState<(typeof regions)[number]['id']>('center')
  const current=regions.find(item=>item.id===region)??regions[0]
  const title=report.status==='excellent'?'Beautiful photo detail':
    report.status==='good'?'Good photo detail':
    report.status==='caution'?'Worth a closer look':
    'Your photo may print a little softer'
  const description=report.status==='review'
    ?'This original may look softer at the selected print size. If you love the photo, you can continue with it as-is.'
    :report.status==='caution'
      ?'Your photo has a little less detail at this print size. You can inspect it up close or carry on.'
      :'Your original has a promising amount of detail for this composition.'
  return <section className="at-photo-preflight at-photo-quality-quiet" aria-label="Optional photo detail check">
    <div className="at-photo-preflight-heading">
      <div><span>PHOTO DETAIL · OPTIONAL</span><strong>{title}</strong></div>
      <span className="at-quality-mark" aria-hidden="true">✦</span>
    </div>
    <p className="at-quality-summary">{description}</p>
    <details className="at-quality-inspect at-quality-disclosure">
      <summary>View photo details <span>Resolution &amp; 100% preview</span></summary>
      <div className="at-quality-technical">
        <div><span>ORIGINAL PHOTO</span><strong>
          {report.sourcePixels.width.toLocaleString()} × {report.sourcePixels.height.toLocaleString()} px
        </strong></div>
        <div><span>PRINTED PHOTO AREA</span><strong>
          {report.printedPhotoIn.width} × {report.printedPhotoIn.height} in
        </strong></div>
        <div><span>DETAIL AT PRINT SIZE</span><strong>
          {Math.round(report.effectivePpi)} PPI
        </strong></div>
      </div>
      {report.warnings.length>0&&<div className="at-quality-note-list">
        <strong>Things to look for</strong>
        <ul>{report.warnings.map((note,index)=><li key={index}>{customerNote(note)}</li>)}</ul>
      </div>}
      <details className="at-quality-inspect at-quality-zoom">
        <summary>Inspect the original photo at 100% detail</summary>
        <div className="at-quality-inspect-controls" role="group" aria-label="Select photo detail region">
          {regions.map(item=><button key={item.id} type="button" aria-pressed={region===item.id}
            onClick={()=>setRegion(item.id)}>{item.label}</button>)}
        </div>
        <div className="at-quality-pixel-window" aria-label="Original source pixels without enlargement">
          <img src={photoUrl} alt={`Original photo ${current.label.toLowerCase()} detail`}
            style={{width:report.sourcePixels.width,height:report.sourcePixels.height,...current.position}}/>
        </div>
        <small>This is a close-up of the original pixels. Soft lighting and
          blurred backgrounds may be part of the photograph's style.</small>
      </details>
    </details>
    <div className="at-quality-actions">
      <small>We'll keep your original photo exactly as you uploaded it. The finished
        print is checked during production.</small>
      {onReplacePhoto&&<button type="button" className="at-quality-replace"
        onClick={onReplacePhoto}>Choose another photo</button>}
    </div>
  </section>
}
