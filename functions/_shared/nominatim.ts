export type GeocodeResult = { lat: number; lng: number; displayName: string }

// Roughly the greater SF Bay Area, with a little margin — matches the
// stats API's own `_BAY_AREA_BOUNDS` (see stuff_to_do/app/location_service.py).
// Events aren't all in SF proper (e.g. "601 Westline Dr, Alameda"), so a
// box scoped to the city alone rejects otherwise-correct results for
// those. Ambiguous single-word venue names (e.g. "Vivarium") can still
// match a same-named place anywhere in the world without some bound — this
// keeps results anchored to the right region.
const BAY_AREA_VIEWBOX = { minLon: -123.3, minLat: 36.8, maxLon: -121.3, maxLat: 38.9 }

// Nominatim usage policy requires a real contact identifier and caps usage
// at roughly 1 request/second — see functions/_shared/geocodeCache.ts and
// functions/api/events.ts for how callers throttle/cache around this.
export async function geocodeAddress(address: string, contactEmail: string): Promise<GeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set(
    'viewbox',
    `${BAY_AREA_VIEWBOX.minLon},${BAY_AREA_VIEWBOX.maxLat},${BAY_AREA_VIEWBOX.maxLon},${BAY_AREA_VIEWBOX.minLat}`
  )
  url.searchParams.set('bounded', '1')
  if (contactEmail) url.searchParams.set('email', contactEmail)

  let res: Response
  try {
    res = await fetch(url.toString(), {
      headers: {
        'User-Agent': `alexroginski-website-stufftodo/1.0 (${contactEmail || 'no-contact-configured'})`,
        'Accept-Language': 'en',
      },
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  let results: Array<{ lat: string; lon: string; display_name: string }>
  try {
    results = await res.json()
  } catch {
    return null
  }

  if (!results.length) return null
  const lat = parseFloat(results[0].lat)
  const lng = parseFloat(results[0].lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return { lat, lng, displayName: results[0].display_name }
}
