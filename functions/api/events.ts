import type { MapCalendarKey } from '../../src/lib/calendarIds'
import { getCachedGeocodes, upsertGeocode, normalizeLocationKey } from '../_shared/geocodeCache'
import { geocodeAddress } from '../_shared/nominatim'
import { fetchStatsApiEvents } from '../_shared/statsApi'

interface Env {
  DB: D1Database
  NOMINATIM_CONTACT_EMAIL?: string
}

export type ApiEvent = {
  id: string
  calendar: MapCalendarKey
  title: string
  description?: string
  location?: string
  start: string
  end: string
  lat: number
  lng: number
  calendarLink?: string
}

export type UnknownLocationEvent = {
  id: string
  calendar: MapCalendarKey
  title: string
  description?: string
  start: string
  end: string
  calendarLink?: string
}

type EventsResponse = {
  events: ApiEvent[]
  unknownLocationEvents: UnknownLocationEvent[]
  generatedAt: string
}

const CACHE_TTL_SECONDS = 300
const MAX_NEW_GEOCODES_PER_REQUEST = 25
const GEOCODE_THROTTLE_MS = 1100

// Bump this whenever EventsResponse's shape changes. The edge cache
// (caches.default) isn't cleared on deploy, so without a version in the
// cache key, a stale pre-deploy response can still be served for up to
// CACHE_TTL_SECONDS after a shape change ships — which crashes any client
// expecting the new shape.
const RESPONSE_SHAPE_VERSION = 'v4'

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

  const knownLocationRows = rows.filter((r) => !r.unknownLocation)
  const unknownLocationRows = rows.filter((r) => r.unknownLocation)

  // Soonest-starting rows first, so when the per-request geocode budget
  // below is exhausted, it's later rows' locations that get left behind
  // rather than the soonest-starting events'.
  const byStartAscending = [...knownLocationRows].sort((a, b) => a.start.getTime() - b.start.getTime())

  const locationKeyToRaw = new Map<string, string>()
  for (const row of byStartAscending) {
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
          const query = /san francisco|,\s*ca\b/i.test(raw) ? raw : `${raw}, San Francisco, CA`
          const result = await geocodeAddress(query, contactEmail)
          if (result) {
            await upsertGeocode(env.DB, key, raw, result.lat, result.lng, result.displayName)
          }
          if (i < missingKeys.length - 1) await sleep(GEOCODE_THROTTLE_MS)
        }
      })()
    )
  }

  // Rows whose cleaned location we couldn't geocode within this request's
  // budget are simply dropped from the map for now — as the D1 geocode
  // cache fills up over repeated requests, fewer rows fall into this
  // bucket. Rows with no cleaned location at all are never geocoded; they
  // surface separately as unknownLocationEvents instead.
  const events: ApiEvent[] = []
  for (const row of knownLocationRows) {
    const coords = geocodes.get(normalizeLocationKey(row.cleanedLocation))
    if (!coords) continue
    events.push({
      id: row.id,
      calendar: row.calendar,
      title: row.title,
      description: row.description,
      location: row.cleanedLocation,
      start: row.start.toISOString(),
      end: row.end.toISOString(),
      lat: coords.lat,
      lng: coords.lng,
      calendarLink: row.calendarLink,
    })
  }

  const unknownLocationEvents: UnknownLocationEvent[] = unknownLocationRows.map((row) => ({
    id: row.id,
    calendar: row.calendar,
    title: row.title,
    description: row.description,
    start: row.start.toISOString(),
    end: row.end.toISOString(),
    calendarLink: row.calendarLink,
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
