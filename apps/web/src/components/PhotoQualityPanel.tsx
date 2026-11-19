import { useState } from 'react'
import type { PhotoQualityReport } from '../photoPrintQuality'

type Props = {
  report: PhotoQualityReport
  photoUrl: string
  approved: boolean
  onApprovedChange: (approved: boolean) => void
  onReplacePhoto?: () => void
}
const regions = [
  { id: 'center', label: 'Center', position: {left:'50%',top:'50%',transform:'translate(-50%,-50%)'} },
  { id: 'top', label: 'Upper detail', position: {left:'50%',top:0,transform:'translateX(-50%)'} },
  { id: 'bottom', label: 'Lower detail', position: {left:'50%',bottom:0,transform:'translateX(-50%)'} },
] as const

/** Local source-image preflight; customer approval never overrides an owner print hold. */
export function PhotoQualityPanel({report, photoUrl, approved, onApprovedChange, onReplacePhoto}:Props) {
  const [region,setRegion]=useState<(typeof regions)[number]['id']>('center')
  const current=regions.find(item=>item.id===region)??regions[0]
  const title=report.status==='excellent'?'Excellent image detail':
    report.status==='good'?'Good image detail':
    report.status==='caution'?'Check image detail before continuing':
    'This image needs a closer look'
  return <section className={`at-photo-preflight at-quality-${report.status}`} aria-label="Print quality check">
    <div className="at-photo-preflight-heading">
      <div><span>PRINT QUALITY CHECK · SOURCE PHOTO</span><strong>{title}</strong></div>
      <b>{Math.round(report.effectivePpi)} PPI</b>
    </div>
    <p className="at-quality-summary">Check your original image before you finish the sky.
      The estimate uses its real pixels at your intended 11 × 14-inch print size,
      including the chosen photo layout and crop. Changing the composition updates the result.</p>
    <div className="at-quality-technical">
      <div><span>ORIGINAL PHOTO</span><strong>
        {report.sourcePixels.width.toLocaleString()} × {report.sourcePixels.height.toLocaleString()} px
      </strong></div>
      <div><span>PRINTED PHOTO AREA</span><strong>
        {report.printedPhotoIn.width} × {report.printedPhotoIn.height} in
      </strong></div>
      <div><span>DETAIL AT PRINT SIZE</span><strong>
        {report.effectivePpi>=250?'Excellent':report.effectivePpi>=200?'Good':
          report.effectivePpi>=150?'Caution':'Owner review'} · {Math.round(report.effectivePpi)} PPI
      </strong></div>
    </div>
    {report.warnings.length>0&&<details className="at-quality-inspect">
      <summary>Review {report.warnings.length} quality note{report.warnings.length===1?'':'s'}</summary>
      <ul>{report.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>
    </details>}
    <details className="at-quality-inspect">
      <summary>Inspect original photo detail at 100% pixels</summary>
      <div className="at-quality-inspect-controls" role="group" aria-label="Select photo detail region">
        {regions.map(item=><button key={item.id} type="button" aria-pressed={region===item.id}
          onClick={()=>setRegion(item.id)}>{item.label}</button>)}
      </div>
      <div className="at-quality-pixel-window" aria-label="Original source pixels at unscaled CSS pixel size">
        <img src={photoUrl} alt={`Original photo ${current.label.toLowerCase()} detail`}
          style={{width:report.sourcePixels.width,height:report.sourcePixels.height,...current.position}}/>
      </div>
      <small>One source pixel per CSS pixel. Inspect faces, edges, textures and compression.
        Night photography and deliberately soft backgrounds can be perfectly intentional.</small>
    </details>
    <label className="at-quality-confirm">
      <input type="checkbox" checked={approved} onChange={event=>onApprovedChange(event.target.checked)}/>
      <span><strong>{report.needsOwnerReview
        ?'I reviewed my photo and understand it still needs owner print approval.'
        :'I have reviewed this photo and approve it for my StarKeepsake design.'}</strong>
        <small>{report.needsOwnerReview
          ?'You can continue after acknowledging this, but only the owner may release a physical-print hold after proofing.'
          :'Your confirmation applies to these image and crop choices. A print-shop proof is still required.'}</small></span>
    </label>
    <div className="at-quality-actions">
      <small>No silent sharpness changes or AI upscaling. A 300-DPI export cannot restore
        original image detail that is not there.</small>
      {onReplacePhoto&&<button type="button" className="at-quality-replace"
        onClick={onReplacePhoto}>⇄ Choose another photo</button>}
    </div>
  </section>
}
