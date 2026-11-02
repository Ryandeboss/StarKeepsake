import type { DesignSpec } from './designSpec'

export type LocationCandidate = {
  displayName: string
  formattedAddress: string
  latitude: number
  longitude: number
  confidence: 'High' | 'Medium' | 'Low' | 'Unknown'
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = 'Something went wrong while contacting StarKeepsake.'

    try {
      const body = await response.json() as { message?: string; detail?: string; title?: string }
      message = body.message ?? body.detail ?? body.title ?? message
    } catch {
      // Keep the generic message when an upstream service returns non-JSON.
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function searchLocations(query: string) {
  return apiRequest<LocationCandidate[]>(
    `/api/locations/search?q=${encodeURIComponent(query.trim())}`,
  )
}

export function resolveMoment(input: {
  date: string
  time: string | null
  exactTimeUnknown: boolean
  locationQuery: string
  location: LocationCandidate
}) {
  return apiRequest<DesignSpec['moment']>('/api/moments/resolve', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}


export type AstronomyResult = {
  calculation: NonNullable<DesignSpec['astronomy']>
  stars: DesignSpec['stars']
}

export function generateAstronomy(
  moment: DesignSpec['moment'],
  skySettings: DesignSpec['skySettings'],
  framePresetId: DesignSpec['framePresetId'],
  photoAspectRatio: number | null = null,
) {
  return apiRequest<AstronomyResult>('/api/astronomy/stars', {
    method: 'POST',
    body: JSON.stringify({ moment, skySettings, framePresetId, photoAspectRatio }),
  })
}

export async function generateEngravingPreview(
  photo: File,
  spec: Pick<DesignSpec, 'framePresetId' | 'photoAspectRatio' | 'photo'>,
  signal?: AbortSignal,
): Promise<Blob> {
  const form = new FormData()
  // Avoid transmitting the customer's original filename to the processing service.
  form.append('image', photo, 'photo')
  form.append('framePresetId', spec.framePresetId)
  if (spec.framePresetId === 'auto' && spec.photoAspectRatio != null) {
    form.append('photoAspectRatio', String(spec.photoAspectRatio))
  }
  form.append('fitMode', spec.photo.fitMode)
  form.append('crop', JSON.stringify(spec.photo.crop))

  const response = await fetch(`${API_BASE_URL}/api/engraving/preview`, {
    method: 'POST',
    body: form,
    signal,
  })

  if (!response.ok) {
    let message = 'We could not build your engraving preview.'
    try {
      const body = await response.json() as { message?: string; detail?: string; title?: string }
      message = body.message ?? body.detail ?? body.title ?? message
    } catch {
      // Keep generic error if the service returned non-JSON.
    }
    throw new Error(message)
  }

  if (!response.headers.get('Content-Type')?.includes('image/png')) {
    throw new Error('The engraving service returned an unexpected format.')
  }

  return response.blob()
}

/**
 * Optional, metered sky-only segmentation through the StarKeepsake API.
 * The photo is transmitted to Fal only after the visitor explicitly clicks
 * "Remove sky with AI". Never include provider credentials in the browser.
 */
export async function generateSkyMask(image: Blob, signal?: AbortSignal): Promise<Blob> {
  const form = new FormData()
  form.append('image', image, 'skyline.jpg')
  const response = await fetch(`${API_BASE_URL}/api/sky/mask`, {
    method: 'POST',
    body: form,
    signal,
  })
  if (!response.ok) {
    let message = 'AI sky removal is unavailable. Your original photo is unchanged.'
    try {
      const body = await response.json() as { message?: string; detail?: string; title?: string }
      message = body.detail ?? body.message ?? body.title ?? message
    } catch { /* Preserve a safe, non-provider-specific error. */ }
    throw new Error(message)
  }
  if (!response.headers.get('Content-Type')?.includes('image/png')) {
    throw new Error('Sky detection did not return a PNG mask.')
  }
  return response.blob()
}

export async function skyMaskAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sky/mask/status`)
    if (!response.ok) return false
    const body = await response.json() as { available?: boolean }
    return body.available === true
  } catch { return false }
}
