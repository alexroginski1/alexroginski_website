import type { GeocodeResult } from './nominatim'

// A few recurring venues/intersections that Nominatim (OpenStreetMap) has
// no resolvable data for at all, no matter how the query is phrased —
// verified individually against nominatim.openstreetmap.org's /search
// endpoint before adding each entry here. These recur across multiple
// calendars, so a one-time manual pin is cheaper than re-discovering "still
// doesn't geocode" every cache cycle. Matched by substring against the
// cleaned location, since the upstream stats API doesn't format these 100%
// consistently (e.g. a trailing ", USA" that isn't always present).
const MANUAL_OVERRIDES: Array<{ test: RegExp; result: GeocodeResult }> = [
  {
    // "12 William Saroyan Place" (Spec's Twelve Adler Museum Cafe) — a short
    // pedestrian alley off Columbus Ave that OSM has no address data for.
    // Pinned to the alley itself, which OSM does know under its former
    // name, "Adler Place".
    test: /william saroyan place/i,
    result: { lat: 37.7976, lng: -122.406, displayName: 'William Saroyan Place, San Francisco, CA' },
  },
  {
    // Golden Gate Park's polo field / equestrian center — OSM has no
    // "Golden Gate Polo Fields" or "Golden Gate Equestrian Center" entry.
    // Pinned to the field's real street address instead.
    test: /golden gate (polo field|equestrian center)/i,
    result: { lat: 37.7692, lng: -122.4963, displayName: '1232 John F Kennedy Dr, San Francisco, CA' },
  },
  {
    // Nominatim's free-text search can't resolve "&"-joined street
    // intersections in any phrasing tried ("Page St & Scott St", "Page St
    // and Scott St", swapped order, ...). Pinned to the actual intersection
    // node (found via Overpass).
    test: /\bpage st\w*\s*(&|and)\s*scott st\w*\b|\bscott st\w*\s*(&|and)\s*page st\w*\b/i,
    result: { lat: 37.7724, lng: -122.4356, displayName: 'Page St & Scott St, San Francisco, CA' },
  },
]

export function findManualGeocodeOverride(text: string): GeocodeResult | null {
  for (const { test, result } of MANUAL_OVERRIDES) {
    if (test.test(text)) return result
  }
  return null
}
