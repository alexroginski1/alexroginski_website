export function normalizeLocationKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function getCachedGeocodes(
  db: D1Database,
  keys: string[]
): Promise<Map<string, { lat: number; lng: number }>> {
  if (keys.length === 0) return new Map()

  const placeholders = keys.map(() => '?').join(',')
  const { results } = await db
    .prepare(`SELECT location_key, lat, lng FROM geocode_cache WHERE location_key IN (${placeholders})`)
    .bind(...keys)
    .all<{ location_key: string; lat: number; lng: number }>()

  return new Map((results ?? []).map((r) => [r.location_key, { lat: r.lat, lng: r.lng }]))
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
