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
) {
  return apiRequest<AstronomyResult>('/api/astronomy/stars', {
    method: 'POST',
    body: JSON.stringify({ moment, skySettings, framePresetId }),
  })
}

export async function generateEngravingPreview(
  photo: File,
  spec: Pick<DesignSpec, 'framePresetId' | 'photo'>,
  signal?: AbortSignal,
): Promise<Blob> {
  const form = new FormData()
  // Avoid transmitting the customer's original filename to the processing service.
  form.append('image', photo, 'photo')
  form.append('framePresetId', spec.framePresetId)
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
