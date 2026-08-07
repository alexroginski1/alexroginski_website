export type GeocodeResult = { lat: number; lng: number; displayName: string }

// Roughly the city of San Francisco, with a little margin. Ambiguous
// single-word venue names (e.g. "Vivarium") can otherwise match a
// same-named place anywhere in the world — this keeps free-text venue/
// address geocoding for this SF-focused site anchored to the right city.
const SF_VIEWBOX = { minLon: -122.53, minLat: 37.7, maxLon: -122.35, maxLat: 37.84 }

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
    `${SF_VIEWBOX.minLon},${SF_VIEWBOX.maxLat},${SF_VIEWBOX.maxLon},${SF_VIEWBOX.minLat}`
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
