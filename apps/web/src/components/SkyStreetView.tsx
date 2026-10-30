import { useEffect, useRef, useState } from 'react'
import type { ExplorerLocation } from '../skyExplorerData'

type Pov = { heading: number; pitch: number }
type Listener = { remove: () => void }
type Position = { lat: () => number; lng: () => number }
type Panorama = {
  setVisible: (visible: boolean) => void
  getPov: () => Pov
  addListener: (eventName: string, cb: () => void) => Listener
  getPosition: () => Position | null
}
type Maps = {
  StreetViewService: new () => {
    getPanorama: (request: { location: { lat: number; lng: number }; radius: number }) =>
      Promise<{ data: { location: { pano: string; description?: string } } }>
  }
  StreetViewPanorama: new (
    element: HTMLElement, options: {
      pano: string
      pov: Pov
      visible: boolean
      motionTracking: boolean
      zoomControl: boolean
      panControl: boolean
      addressControl: boolean
    }
  ) => Panorama
}
type MapsWindow = Window & {
  google?: { maps?: Maps }
  __starKeepsakeMapsReady?: () => void
}
let mapsPromise: Promise<Maps> | null = null

function mapsApi(key: string): Promise<Maps> {
  const maps = (window as MapsWindow).google?.maps
  if (maps?.StreetViewPanorama) return Promise.resolve(maps)
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise<Maps>((resolve, reject) => {
    const holder = window as MapsWindow
    const script = document.createElement('script')
    const done = () => {
      const resolved = holder.google?.maps
      delete holder.__starKeepsakeMapsReady
      if (resolved?.StreetViewPanorama) resolve(resolved)
      else reject(new Error('Google Maps loaded without the Street View library.'))
    }
    holder.__starKeepsakeMapsReady = done
    const params = new URLSearchParams({
      key, loading: 'async', libraries: 'streetView', v: 'weekly', callback: '__starKeepsakeMapsReady',
    })
    script.src = 'https://maps.googleapis.com/maps/api/js?' + params.toString()
    script.async = true
    script.onerror = () => {
      delete holder.__starKeepsakeMapsReady
      mapsPromise = null
      reject(new Error('Google Street View could not load. Check your Maps JavaScript API key and allowed web referrers.'))
    }
    document.head.appendChild(script)
  })
  return mapsPromise
}

function mapsStreetViewUrl(location: ExplorerLocation): string {
  const lat = Math.max(-90, Math.min(90, location.latitude))
  const lng = Math.max(-180, Math.min(180, location.longitude))
  return 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + lat + '%2C' + lng
}

type Props = {
  location: ExplorerLocation
  camera: Pov
  onCameraChange: (camera: Pov) => void
}

export function SkyStreetView({ location, camera, onCameraChange }: Props) {
  const container = useRef<HTMLDivElement | null>(null)
  const onChange = useRef(onCameraChange)
  const [error, setError] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? ''

  useEffect(() => { onChange.current = onCameraChange }, [onCameraChange])

  useEffect(() => {
    if (!key || !container.current) return
    let cancelled = false
    let panorama: Panorama | null = null
    const listeners: Listener[] = []
    const containerElement = container.current
    async function open() {
      setLoading(true)
      setError('')
      try {
        const maps = await mapsApi(key)
        const service = new maps.StreetViewService()
        // Nearby available street imagery: do not invent an exact camera spot.
        const response = await service.getPanorama({
          location: { lat: location.latitude, lng: location.longitude },
          radius: 1200,
        })
        if (cancelled) return
        panorama = new maps.StreetViewPanorama(containerElement, {
          pano: response.data.location.pano,
          pov: { heading: camera.heading, pitch: camera.pitch },
          visible: true,
          motionTracking: false,
          zoomControl: true,
          panControl: true,
          addressControl: true,
        })
        setDescription(response.data.location.description ?? location.name)
        listeners.push(panorama.addListener('pov_changed', () => {
          if (cancelled || !panorama) return
          const pov = panorama.getPov()
          onChange.current({ heading: pov.heading, pitch: pov.pitch })
        }))
        // If visitors walk to another panorama, their sky will still be an
        // approximation for the *selected city center*, not that street corner.
        listeners.push(panorama.addListener('position_changed', () => {
          if (cancelled || !panorama) return
          const current = panorama.getPosition()
          if (!current) return
        }))
        setLoading(false)
      } catch {
        if (!cancelled) {
          setLoading(false)
          setError('Street View is unavailable here or the Google Maps API has not been enabled for this website.')
        }
      }
    }
    void open()
    return () => {
      cancelled = true
      listeners.forEach(listener => listener.remove())
      panorama?.setVisible(false)
    }
    // We initialize only on selected city changes, not on each camera event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, location.id, location.latitude, location.longitude])

  if (!key) return <div className="streetview-setup">
    <span className="immersive-eyebrow">Real 360° ground imagery</span>
    <h3>Google Street View integration is ready for setup.</h3>
    <p>Enable Maps JavaScript API billing and add a referrer-restricted
      <code> VITE_GOOGLE_MAPS_API_KEY </code> in the Vercel project to show real Street View right here.
      Until then, you can open the selected city directly in Google Maps.</p>
    <a href={mapsStreetViewUrl(location)} target="_blank" rel="noopener noreferrer">
      Open {location.name} in Google Street View ↗
    </a>
    <small>Google Maps imagery is from its own capture date, not the selected historical sky date.</small>
  </div>

  return <div className="streetview-scene">
    <div className="streetview-frame" ref={container}/>
    {loading && <div className="streetview-status" role="status">Finding a real street-level panorama near {location.name}…</div>}
    {error && <div className="streetview-status" role="alert">
      {error}
      <a href={mapsStreetViewUrl(location)} target="_blank" rel="noopener noreferrer">Open Google Maps instead ↗</a>
    </div>}
    {!loading && !error && <div className="streetview-disclaimer">
      <strong>Real Google Street View · {description}</strong>
      <small>Drag to turn or use the Street View arrows to walk. Camera heading follows the view when returning to the calculated sky.
        The photographs are not nighttime captures or a reconstruction of your chosen date.</small>
    </div>}
  </div>
}
