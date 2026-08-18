import type { MapCalendarKey } from '../../src/lib/calendarIds'
import type { EventSourceBreakdown, EventSourceEventSummary, EventSourcesResponse } from '../../src/lib/mapTypes'
import { fetchStatsApiEvents } from '../_shared/statsApi'

const CACHE_TTL_SECONDS = 300
const RESPONSE_SHAPE_VERSION = 'v2'

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
      JSON.stringify({
        calendars: [],
        totalCount: 0,
        totalSourceCount: 0,
        generatedAt: now.toISOString(),
      } satisfies EventSourcesResponse),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  type SourceTally = { count: number; events: EventSourceEventSummary[] }
  const byCalendar = new Map<MapCalendarKey, Map<string, SourceTally>>()
  for (const row of rows) {
    let bySource = byCalendar.get(row.calendar)
    if (!bySource) {
      bySource = new Map()
      byCalendar.set(row.calendar, bySource)
    }
    let tally = bySource.get(row.eventSource)
    if (!tally) {
      tally = { count: 0, events: [] }
      bySource.set(row.eventSource, tally)
    }
    tally.count += 1
    tally.events.push({ title: row.title, start: row.start.toISOString(), calendarLink: row.calendarLink })
  }

  // Which calendars exist is discovered from the data itself (the distinct
  // "Source Google Calendar" values), not a hardcoded list — so a newly
  // added upstream calendar shows up here without a code change. Sections
  // are ordered by event count, busiest first, so the reader sees where
  // most of the events actually come from without hunting for it.
  const calendarKeys = [...byCalendar.keys()].sort((a, b) => {
    const countA = [...byCalendar.get(a)!.values()].reduce((sum, t) => sum + t.count, 0)
    const countB = [...byCalendar.get(b)!.values()].reduce((sum, t) => sum + t.count, 0)
    return countB - countA || a.localeCompare(b)
  })

  const sourceLabels = new Set<string>()
  const calendars: EventSourceBreakdown[] = []
  for (const key of calendarKeys) {
    const bySource = byCalendar.get(key)!

    const eventSources = [...bySource.entries()]
      .map(([label, tally]) => {
        sourceLabels.add(label)
        return {
          label,
          count: tally.count,
          events: tally.events.sort((a, b) => a.start.localeCompare(b.start)),
        }
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

    calendars.push({
      key,
      label: key,
      count: eventSources.reduce((sum, s) => sum + s.count, 0),
      eventSources,
    })
  }

  const body: EventSourcesResponse = {
    calendars,
    totalCount: rows.length,
    totalSourceCount: sourceLabels.size,
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
