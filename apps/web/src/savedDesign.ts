import type { DesignSpec } from './designSpec'
import type { OrderPreferences } from './orderManifest'

export type SavedDesignReceipt = {
  designId: string
  accessKey: string
  createdAtUtc: string
  status: 'SAVED_UNPAID'
}
export type LoadedDesign = {
  designId: string
  createdAtUtc: string
  status: 'SAVED_UNPAID'
  design: DesignSpec
  preferences: OrderPreferences
  hasPreparedForeground: boolean
}

const DESIGN_ID = /^SK-[0-9A-F]{16}$/
const ACCESS_KEY = /^[A-Za-z0-9_-]{43}$/

const apiBaseUrl = () =>
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

async function fail(response: Response, fallback: string): Promise<never> {
  let reason = fallback
  try {
    const data = await response.json() as {title?: string; detail?: string; message?: string}
    reason = data.detail ?? data.title ?? data.message ?? reason
  } catch { /* Keep the generic error on a proxy or HTML response. */ }
  throw new Error(reason)
}

export function parseDesignLink(hash: string): {designId: string; accessKey: string} | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const designId = params.get('design') ?? ''
  const accessKey = params.get('key') ?? ''
  return DESIGN_ID.test(designId) && ACCESS_KEY.test(accessKey)
    ? {designId, accessKey} : null
}

/**
 * The edit key stays in the URL fragment, not the query string, so browsers
 * do not send it to Azure, Etsy or a web server in an HTTP request.
 * Anyone who receives this full link can open the private design.
 */
export function privateDesignLink(baseUrl: string, receipt: Pick<SavedDesignReceipt, 'designId'|'accessKey'>) {
  if (!DESIGN_ID.test(receipt.designId) || !ACCESS_KEY.test(receipt.accessKey))
    throw new Error('Invalid saved design reference.')
  const url = new URL(baseUrl)
  url.search = ''
  url.hash = new URLSearchParams({design: receipt.designId, key: receipt.accessKey}).toString()
  return url.toString()
}

export function designSnapshotSignature(input: {
  design: DesignSpec
  preferences: OrderPreferences
  photoBytes: number
  prepared: boolean
}) {
  return JSON.stringify({
    design: {...input.design, designId: 'stable-id'},
    preferences: input.preferences,
    photoBytes: input.photoBytes,
    prepared: input.prepared,
  })
}

export async function saveCustomerDesign(input: {
  design: DesignSpec
  preferences: OrderPreferences
  photo: File
  foreground: Blob | null
}): Promise<SavedDesignReceipt> {
  const form = new FormData()
  form.append('design', JSON.stringify(input.design))
  form.append('preferences', JSON.stringify(input.preferences))
  form.append('photo', input.photo, 'original-photo')
  if (input.foreground) form.append('foreground', input.foreground, 'prepared-foreground.png')
  const response = await fetch(apiBaseUrl() + '/api/designs', {
    method: 'POST',
    body: form,
    // Do not set Content-Type: browser must add multipart boundary.
  })
  if (!response.ok) return fail(response, 'Unable to save your design.')
  const receipt = await response.json() as SavedDesignReceipt
  if (!DESIGN_ID.test(receipt.designId) || !ACCESS_KEY.test(receipt.accessKey))
    throw new Error('Design service returned an invalid receipt.')
  return receipt
}

export async function reopenCustomerDesign(
  reference: {designId: string; accessKey: string},
): Promise<{saved: LoadedDesign; original: Blob; foreground: Blob | null}> {
  const headers = {'X-Design-Access-Key': reference.accessKey}
  const base = apiBaseUrl() + '/api/designs/' + encodeURIComponent(reference.designId)
  const response = await fetch(base, {headers, cache: 'no-store'})
  if (!response.ok) return fail(response, 'This private design link is invalid or unavailable.')
  const saved = await response.json() as LoadedDesign
  const originalResponse = await fetch(base + '/assets/original', {headers, cache: 'no-store'})
  if (!originalResponse.ok) return fail(originalResponse, 'Could not retrieve the original photo.')
  const original = await originalResponse.blob()
  let foreground: Blob | null = null
  if (saved.hasPreparedForeground) {
    const foregroundResponse = await fetch(base + '/assets/foreground', {headers, cache: 'no-store'})
    if (!foregroundResponse.ok) return fail(foregroundResponse, 'Could not retrieve the polished foreground.')
    foreground = await foregroundResponse.blob()
  }
  return {saved, original, foreground}
}
