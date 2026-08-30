import { getCachedGeocodes, upsertGeocode, normalizeLocationKey } from '../_shared/geocodeCache'
import { geocodeAddress } from '../_shared/nominatim'

interface Env {
  DB: D1Database
  NOMINATIM_CONTACT_EMAIL?: string
}

type GeocodeResponse =
  | { ok: true; lat: number; lng: number; cached: boolean }
  | { ok: false; error: 'not_found' | 'bad_request' | 'server_error' }

function json(body: GeocodeResponse, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const address = new URL(request.url).searchParams.get('address')?.trim()

  if (!address || address.length > 200) {
    return json({ ok: false, error: 'bad_request' }, 400)
  }

  const key = normalizeLocationKey(address)

  const cached = await getCachedGeocodes(env.DB, [key])
  const hit = cached.get(key)
  if (hit) {
    return json({ ok: true, lat: hit.lat, lng: hit.lng, cached: true }, 200)
  }

  try {
    const query = /san francisco|,\s*ca\b/i.test(address) ? address : `${address}, San Francisco, CA`
    const result = await geocodeAddress(query, env.NOMINATIM_CONTACT_EMAIL ?? '')
    if (!result) {
      return json({ ok: false, error: 'not_found' }, 404)
    }
    await upsertGeocode(env.DB, key, address, result.lat, result.lng, result.displayName)
    return json({ ok: true, lat: result.lat, lng: result.lng, cached: false }, 200)
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: 'server_error' }, 500)
  }
}
