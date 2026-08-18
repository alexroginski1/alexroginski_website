import type { MapCalendarKey } from '../../src/lib/calendarIds'
import type { EventSourceBreakdown, EventSourcesResponse } from '../../src/lib/mapTypes'
import { fetchStatsApiEvents } from '../_shared/statsApi'

// The "manual" bucket of Event Source values is one calendar-owner-curated
// entry per event, not one per scraped source site — so instead of just a
// count, its breakdown lists the actual (deduped) event names.
const MANUAL_EVENT_SOURCE_LABEL = 'Manually Added Events'

const CACHE_TTL_SECONDS = 300
const RESPONSE_SHAPE_VERSION = 'v1'

export const onRequestGet: PagesFunction = async (context) => {
  const { request } = context
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
    return new Response(
      JSON.stringify({ calendars: [], generatedAt: now.toISOString() } satisfies EventSourcesResponse),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  type SourceTally = { count: number; titles: Set<string> }
  const byCalendar = new Map<MapCalendarKey, Map<string, SourceTally>>()
  for (const row of rows) {
    let bySource = byCalendar.get(row.calendar)
    if (!bySource) {
      bySource = new Map()
      byCalendar.set(row.calendar, bySource)
    }
    let tally = bySource.get(row.eventSource)
    if (!tally) {
      tally = { count: 0, titles: new Set() }
      bySource.set(row.eventSource, tally)
    }
    tally.count += 1
    tally.titles.add(row.title)
  }

  // Which calendars exist is discovered from the data itself (the distinct
  // "Source Google Calendar" values), not a hardcoded list — so a newly
  // added upstream calendar shows up here without a code change.
  const calendarKeys = [...byCalendar.keys()].sort((a, b) => a.localeCompare(b))

  const calendars: EventSourceBreakdown[] = []
  for (const key of calendarKeys) {
    const bySource = byCalendar.get(key)!

    const eventSources = [...bySource.entries()]
      .map(([label, tally]) => ({
        label,
        count: tally.count,
        eventTitles:
          label === MANUAL_EVENT_SOURCE_LABEL ? [...tally.titles].sort((a, b) => a.localeCompare(b)) : undefined,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

    calendars.push({
      key,
      label: key,
      count: eventSources.reduce((sum, s) => sum + s.count, 0),
      eventSources,
    })
  }

  const body: EventSourcesResponse = { calendars, generatedAt: now.toISOString() }

  const response = new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  })

  context.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
