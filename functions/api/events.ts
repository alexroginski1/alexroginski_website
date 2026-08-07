import { CALENDAR_IDS, icsUrl, type MapCalendarKey } from '../../src/lib/calendarIds'
import { parseIcsOccurrences, type RawOccurrence } from '../_shared/ics'
import { getCachedGeocodes, upsertGeocode, normalizeLocationKey } from '../_shared/geocodeCache'
import { geocodeAddress } from '../_shared/nominatim'

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
}

type EventsResponse = {
  weekCount: number
  events: ApiEvent[]
  generatedAt: string
  calendarsFetched: MapCalendarKey[]
  errors: { calendar: MapCalendarKey; error: string }[]
}

const FETCH_TIMEOUT_MS = 5000
const CACHE_TTL_SECONDS = 300
const MAX_NEW_GEOCODES_PER_REQUEST = 15
const GEOCODE_THROTTLE_MS = 1100

// Bump this whenever EventsResponse's shape changes. The edge cache
// (caches.default) isn't cleared on deploy, so without a version in the
// cache key, a stale pre-deploy response can still be served for up to
// CACHE_TTL_SECONDS after a shape change ships — which crashes any client
// expecting the new shape.
const RESPONSE_SHAPE_VERSION = 'v2'

async function fetchIcs(calendarId: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(icsUrl(calendarId), {
      signal: controller.signal,
      cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timeout)
  }
}

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
  const weekWindowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const calendarEntries = Object.entries(CALENDAR_IDS) as [MapCalendarKey, string][]

  const errors: { calendar: MapCalendarKey; error: string }[] = []
  const calendarsFetched: MapCalendarKey[] = []
  const perCalendarOccurrences: { calendar: MapCalendarKey; occ: RawOccurrence }[] = []

  const results = await Promise.allSettled(
    calendarEntries.map(async ([key, id]) => {
      const icsText = await fetchIcs(id)
      const occurrences = parseIcsOccurrences(icsText, now, weekWindowEnd)
      return { key, occurrences }
    })
  )

  results.forEach((result, i) => {
    const [key] = calendarEntries[i]
    if (result.status === 'fulfilled') {
      calendarsFetched.push(key)
      for (const occ of result.value.occurrences) {
        perCalendarOccurrences.push({ calendar: key, occ })
      }
    } else {
      const reason = result.reason
      errors.push({ calendar: key, error: reason instanceof Error ? reason.message : String(reason) })
    }
  })

  // All events still in progress or upcoming within the next 7 days — this
  // is both the "events this week" count and the full pool of map pins.
  const upcoming = perCalendarOccurrences.filter(({ occ }) => occ.end >= now && occ.start <= weekWindowEnd)
  const weekCount = upcoming.length

  const locationKeyToRaw = new Map<string, string>()
  for (const { occ } of upcoming) {
    if (!occ.location) continue
    const key = normalizeLocationKey(occ.location)
    if (!locationKeyToRaw.has(key)) locationKeyToRaw.set(key, occ.location)
  }

  const allKeys = [...locationKeyToRaw.keys()]
  const geocodes = await getCachedGeocodes(env.DB, allKeys)

  const missingKeys = allKeys.filter((k) => !geocodes.has(k)).slice(0, MAX_NEW_GEOCODES_PER_REQUEST)
  const contactEmail = env.NOMINATIM_CONTACT_EMAIL ?? ''

  for (let i = 0; i < missingKeys.length; i++) {
    const key = missingKeys[i]
    const raw = locationKeyToRaw.get(key)!
    const query = /san francisco|,\s*ca\b/i.test(raw) ? raw : `${raw}, San Francisco, CA`
    const result = await geocodeAddress(query, contactEmail)
    if (result) {
      geocodes.set(key, { lat: result.lat, lng: result.lng })
      context.waitUntil(upsertGeocode(env.DB, key, raw, result.lat, result.lng, result.displayName))
    }
    if (i < missingKeys.length - 1) await sleep(GEOCODE_THROTTLE_MS)
  }

  // Locations we couldn't geocode within this request's budget (or that are
  // missing entirely) are simply dropped from the map — they still counted
  // toward weekCount above. As the D1 geocode cache fills up over repeated
  // requests, fewer events fall into this bucket.
  const events: ApiEvent[] = []
  for (const { calendar, occ } of upcoming) {
    if (!occ.location) continue
    const coords = geocodes.get(normalizeLocationKey(occ.location))
    if (!coords) continue
    events.push({
      id: `${calendar}:${occ.uid}`,
      calendar,
      title: occ.title,
      description: occ.description,
      location: occ.location,
      start: occ.start.toISOString(),
      end: occ.end.toISOString(),
      lat: coords.lat,
      lng: coords.lng,
    })
  }

  const body: EventsResponse = {
    weekCount,
    events,
    generatedAt: now.toISOString(),
    calendarsFetched,
    errors,
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
