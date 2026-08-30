import type { MapCalendarKey } from '../../src/lib/calendarIds'
import { getCachedGeocodes, upsertGeocode, normalizeLocationKey, parseCoordinateLocation } from '../_shared/geocodeCache'
import { geocodeAddress } from '../_shared/nominatim'
import { fetchStatsApiEvents } from '../_shared/statsApi'

interface Env {
  DB: D1Database
  NOMINATIM_CONTACT_EMAIL?: string
}

export type ApiEvent = {
  id: string
  calendar: MapCalendarKey
  // The specific source within a calendar (e.g. a calendar's individual
  // contributing Eventbrite/Luma page) — finer-grained than `calendar`,
  // used to sub-filter within a calendar's checkbox in the UI.
  eventSource: string
  title: string
  description?: string
  location?: string
  rawLocation?: string
  // True when the source only pinned this event down to a neighborhood
  // (e.g. "Mission District") rather than an exact address — `lat`/`lng`
  // are still a reasonable point within that area, but the map should mark
  // it as approximate rather than implying a precise venue.
  approximateLocation?: boolean
  start: string
  end: string
  lat: number
  lng: number
  calendarLink?: string
  neighborhood?: string
  eventLink?: string
}

export type UnknownLocationEvent = {
  id: string
  calendar: MapCalendarKey
  eventSource: string
  title: string
  description?: string
  rawLocation?: string
  start: string
  end: string
  calendarLink?: string
  neighborhood?: string
  eventLink?: string
}

type EventsResponse = {
  events: ApiEvent[]
  unknownLocationEvents: UnknownLocationEvent[]
  generatedAt: string
}

const PRESIDIO_EVENT_SOURCE = 'Presidio Events'
// Main Post, roughly the center of the Presidio's public area.
const PRESIDIO_CENTER = { lat: 37.7989, lng: -122.4662 }

const CACHE_TTL_SECONDS = 300
const MAX_NEW_GEOCODES_PER_REQUEST = 25
const GEOCODE_THROTTLE_MS = 1100

// Bump this whenever EventsResponse's shape changes. The edge cache
// (caches.default) isn't cleared on deploy, so without a version in the
// cache key, a stale pre-deploy response can still be served for up to
// CACHE_TTL_SECONDS after a shape change ships — which crashes any client
// expecting the new shape.
const RESPONSE_SHAPE_VERSION = 'v8'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const cache = caches.default
  const cacheUrl = new URL(request.url)
  cacheUrl.searchParams.set('shapeVersion', RESPONSE_SHAPE_VERSION)
  const cacheKey = new Request(cacheUrl.toString(), request)

  const cached = await cache.match(cacheKey)
  if (cached) return cached

  const now = new Date()
  let rows
  try {
    rows = await fetchStatsApiEvents(now)
  } catch {
    // Source is temporarily unreachable — respond with empty lists instead
    // of a 500, and skip caching so the next request retries fresh.
    return new Response(
      JSON.stringify({ events: [], unknownLocationEvents: [], generatedAt: now.toISOString() } satisfies EventsResponse),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Presidio Events' own listings are frequently missing a specific venue
  // (e.g. recurring "Habitat Stewards" volunteer shifts), but they're always
  // somewhere within the Presidio itself — rather than falling into the
  // unknown-location bucket, they're placed at the park's center with an
  // approximate-location flag.
  const presidioUnknownRows = rows.filter((r) => r.unknownLocation && r.eventSource === PRESIDIO_EVENT_SOURCE)
  const knownLocationRows = rows.filter((r) => !r.unknownLocation)
  const unknownLocationRows = rows.filter((r) => r.unknownLocation && r.eventSource !== PRESIDIO_EVENT_SOURCE)

  // Soonest-starting rows first, so when the per-request geocode budget
  // below is exhausted, it's later rows' locations that get left behind
  // rather than the soonest-starting events'.
  const byStartAscending = [...knownLocationRows].sort((a, b) => a.start.getTime() - b.start.getTime())

  const locationKeyToRaw = new Map<string, string>()
  for (const row of byStartAscending) {
    // Already a "lat,lng" pin — plots directly below, no geocode needed.
    if (parseCoordinateLocation(row.cleanedLocation)) continue
    const key = normalizeLocationKey(row.cleanedLocation)
    if (!locationKeyToRaw.has(key)) locationKeyToRaw.set(key, row.cleanedLocation)
  }

  const allKeys = [...locationKeyToRaw.keys()]
  const geocodes = await getCachedGeocodes(env.DB, allKeys)

  const missingKeys = allKeys.filter((k) => !geocodes.has(k)).slice(0, MAX_NEW_GEOCODES_PER_REQUEST)
  const contactEmail = env.NOMINATIM_CONTACT_EMAIL ?? ''

  // Geocoding new locations against Nominatim is rate-limited to ~1 req/sec
  // (GEOCODE_THROTTLE_MS), so resolving a full batch of missing keys inline
  // used to block the response for up to ~15-20s. Instead, return this
  // response with whatever's already cached and resolve the rest in the
  // background — they'll show up once the D1 geocode cache is warm on a
  // future request (this response is itself edge-cached for
  // CACHE_TTL_SECONDS, so that's the worst-case delay).
  if (missingKeys.length) {
    context.waitUntil(
      (async () => {
        for (let i = 0; i < missingKeys.length; i++) {
          const key = missingKeys[i]
          const raw = locationKeyToRaw.get(key)!

          // A combined "name + address" free-text query can fail on Nominatim
          // even when either half would succeed alone, and the useful half
          // differs by source shape — a Google Calendar entry mashing a POI
          // name into an unrelated cross-street (e.g. "Duboce Park, Scott
          // St") needs the name kept and the tail dropped, while a "Venue
          // Name, Street Address" entry (e.g. the Bars calendar's "Choquet's,
          // 2500 Washington St") needs the opposite: the address is what
          // Nominatim can actually resolve, and the venue name is what's
          // confusing it. Try the full string first, then both halves split
          // on the first comma, stopping at the first one that resolves.
          const candidates = [raw]
          const firstComma = raw.indexOf(',')
          if (firstComma !== -1) {
            const leadingSegment = raw.slice(0, firstComma).trim()
            const trailingSegment = raw.slice(firstComma + 1).trim()
            if (leadingSegment && !candidates.includes(leadingSegment)) candidates.push(leadingSegment)
            if (trailingSegment && !candidates.includes(trailingSegment)) candidates.push(trailingSegment)
          }

          let result: Awaited<ReturnType<typeof geocodeAddress>> = null
          for (let c = 0; c < candidates.length && !result; c++) {
            if (c > 0) await sleep(GEOCODE_THROTTLE_MS)
            const candidate = candidates[c]
            const query = /san francisco|,\s*ca\b/i.test(candidate) ? candidate : `${candidate}, San Francisco, CA`
            result = await geocodeAddress(query, contactEmail)
          }

          if (result) {
            await upsertGeocode(env.DB, key, raw, result.lat, result.lng, result.displayName)
          }
          if (i < missingKeys.length - 1) await sleep(GEOCODE_THROTTLE_MS)
        }
      })()
    )
  }

  // Rows whose cleaned location we couldn't geocode within this request's
  // budget (or ever — some locations are simply unresolvable, see the
  // fallback above) fall into the unknownLocationEvents bucket alongside
  // rows with no location at all, rather than being dropped: as the D1
  // geocode cache fills up over repeated requests, resolvable rows migrate
  // out of this bucket and onto the map.
  const events: ApiEvent[] = []
  const geocodeFailedRows: typeof knownLocationRows = []
  for (const row of knownLocationRows) {
    const coords = parseCoordinateLocation(row.cleanedLocation) ?? geocodes.get(normalizeLocationKey(row.cleanedLocation))
    if (!coords) {
      geocodeFailedRows.push(row)
      continue
    }
    events.push({
      id: row.id,
      calendar: row.calendar,
      eventSource: row.eventSource,
      title: row.title,
      description: row.description,
      location: row.cleanedLocation,
      rawLocation: row.rawLocation,
      approximateLocation: row.locationType === 'inexact' ? true : undefined,
      start: row.start.toISOString(),
      end: row.end.toISOString(),
      lat: coords.lat,
      lng: coords.lng,
      calendarLink: row.calendarLink,
      neighborhood: row.neighborhood,
      eventLink: row.eventLink,
    })
  }

  for (const row of presidioUnknownRows) {
    events.push({
      id: row.id,
      calendar: row.calendar,
      eventSource: row.eventSource,
      title: row.title,
      description: row.description,
      location: 'Presidio, San Francisco, CA',
      rawLocation: row.rawLocation,
      approximateLocation: true,
      start: row.start.toISOString(),
      end: row.end.toISOString(),
      lat: PRESIDIO_CENTER.lat,
      lng: PRESIDIO_CENTER.lng,
      calendarLink: row.calendarLink,
      neighborhood: row.neighborhood,
      eventLink: row.eventLink,
    })
  }

  const unknownLocationEvents: UnknownLocationEvent[] = [...unknownLocationRows, ...geocodeFailedRows].map((row) => ({
    id: row.id,
    calendar: row.calendar,
    eventSource: row.eventSource,
    title: row.title,
    description: row.description,
    rawLocation: row.rawLocation,
    start: row.start.toISOString(),
    end: row.end.toISOString(),
    calendarLink: row.calendarLink,
    neighborhood: row.neighborhood,
    eventLink: row.eventLink,
  }))

  const body: EventsResponse = {
    events,
    unknownLocationEvents,
    generatedAt: now.toISOString(),
  }

  const response = new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  })

  context.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
