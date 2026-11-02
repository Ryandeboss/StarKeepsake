import { useEffect, useState } from 'react'
import './SkyLoadingProgress.css'

/**
 * A visual estimate, not server-reported percent complete.
 * The astronomy endpoint currently returns a single response.
 */
export function SkyLoadingProgress({ active, overlay }: { active: boolean; overlay: boolean }) {
  const [percent, setPercent] = useState(12)
  const [visible, setVisible] = useState(active)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (active) {
      const start = window.setTimeout(() => {
        setVisible(true)
        setLeaving(false)
        setPercent(12)
      }, 0)
      const ticks = window.setInterval(() => {
        setPercent(value => Math.min(90, value + Math.max(0.6, (90 - value) * 0.11)))
      }, 180)
      return () => { window.clearTimeout(start); window.clearInterval(ticks) }
    }

    if (!visible) return
    const finish = window.setTimeout(() => {
      setPercent(100)
      setLeaving(true)
    }, 0)
    const hide = window.setTimeout(() => setVisible(false), 650)
    return () => { window.clearTimeout(finish); window.clearTimeout(hide) }
  }, [active, visible])

  if (!visible) return null
  const stage = percent >= 100 ? 'Sky ready' : percent < 32 ? 'Preparing scene…'
    : percent < 64 ? 'Calculating stars…'
    : percent < 87 ? 'Rendering sky…' : 'Finishing details…'

  return <div className={'sky-loading-progress ' + (overlay ? 'is-overlay ' : '') + (leaving ? 'is-leaving' : '')}
    aria-live="polite">
    <div className="sky-loading-inner">
      <span className="sky-loading-kicker">StarKeepsake Observatory</span>
      <div className="sky-loading-title">
        <strong>{stage}</strong>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="sky-loading-track" role="progressbar"
        aria-label="Visual estimate of sky loading"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
        <div className="sky-loading-fill" style={{ width: percent + '%' }}/>
      </div>
      <small>Visual loading estimate · astronomy data is ready when the calculation finishes.</small>
    </div>
  </div>
}
