export function normalizeLocationKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Some scrapers pin an event to an exact known point (e.g. a specific piano
// in a park) rather than a real street address — "lat,lng" in the cleaned
// location plots directly instead of being sent to Nominatim, whose
// free-text `/search` endpoint can't resolve a bare coordinate pair.
const COORDINATE_LOCATION_RE = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/

export function parseCoordinateLocation(text: string): { lat: number; lng: number } | null {
  const match = COORDINATE_LOCATION_RE.exec(text.trim())
  if (!match) return null
  const lat = parseFloat(match[1])
  const lng = parseFloat(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

// D1 caps the number of bound parameters per query well below SQLite's own
// default limit, so a whole week's worth of unique locations (can be 100+)
// has to be looked up in batches rather than one IN (...) with every key.
const D1_MAX_BOUND_PARAMS = 90

export async function getCachedGeocodes(
  db: D1Database,
  keys: string[]
): Promise<Map<string, { lat: number; lng: number }>> {
  const out = new Map<string, { lat: number; lng: number }>()
  if (keys.length === 0) return out

  for (let i = 0; i < keys.length; i += D1_MAX_BOUND_PARAMS) {
    const batch = keys.slice(i, i + D1_MAX_BOUND_PARAMS)
    const placeholders = batch.map(() => '?').join(',')
    const { results } = await db
      .prepare(`SELECT location_key, lat, lng FROM geocode_cache WHERE location_key IN (${placeholders})`)
      .bind(...batch)
      .all<{ location_key: string; lat: number; lng: number }>()

    for (const r of results ?? []) out.set(r.location_key, { lat: r.lat, lng: r.lng })
  }

  return out
}

export async function upsertGeocode(
  db: D1Database,
  key: string,
  rawLocation: string,
  lat: number,
  lng: number,
  displayName?: string
): Promise<void> {
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO geocode_cache (location_key, raw_location, lat, lng, display_name, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'nominatim', ?, ?)
       ON CONFLICT(location_key) DO UPDATE SET
         lat = excluded.lat,
         lng = excluded.lng,
         display_name = excluded.display_name,
         updated_at = excluded.updated_at`
    )
    .bind(key, rawLocation, lat, lng, displayName ?? null, now, now)
    .run()
}
