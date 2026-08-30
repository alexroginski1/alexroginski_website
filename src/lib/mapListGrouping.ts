import { isEventEnded, type EventListItem } from './mapEventFormat'
import { getCalendarStyle } from './mapCalendarLegend'
import { haversineMiles, type LatLng } from './geo'

// The list view's sort/group control lets the user pick any combination of
// these, in the order they pick them — earlier picks partition the list into
// labeled subgroups (broadest first), 'time' just fixes the ordering at
// whichever level it appears and never creates a header of its own.
export type ListCriterion = 'time' | 'source' | 'distance'

export const LIST_CRITERION_LABELS: Record<ListCriterion, string> = {
  time: 'Time',
  source: 'Event source',
  distance: 'Distance',
}

// Fixed mile bands rather than bands relative to the active radius filter,
// so grouping stays meaningful (and stable) whether or not a radius search
// is active — the radius filter's own "within region" highlight already
// covers the relative case.
const DISTANCE_BANDS: { max: number; label: string }[] = [
  { max: 1, label: 'Under 1 mi' },
  { max: 3, label: '1–3 mi' },
  { max: 5, label: '3–5 mi' },
  { max: 10, label: '5–10 mi' },
  { max: Infinity, label: '10+ mi' },
]

function distanceBandLabel(miles: number): string {
  return (DISTANCE_BANDS.find((band) => miles < band.max) ?? DISTANCE_BANDS[DISTANCE_BANDS.length - 1]).label
}

// Ended events sink to the bottom of every time-sorted grouping — otherwise
// interleaved with everything still upcoming, which is what someone
// glancing down a group actually cares about. When a radius filter is
// active, events within the region sink to the top of their leaf list ahead
// of events outside it — a single list per group rather than a separate
// "within/not within region" section.
function sortByTime(items: EventListItem[], highlightedEventIds?: Set<string> | null): EventListItem[] {
  return [...items].sort((a, b) => {
    const aEnded = isEventEnded(a.end)
    const bEnded = isEventEnded(b.end)
    if (aEnded !== bEnded) return aEnded ? 1 : -1
    if (highlightedEventIds) {
      const aWithin = highlightedEventIds.has(a.id)
      const bWithin = highlightedEventIds.has(b.id)
      if (aWithin !== bWithin) return aWithin ? -1 : 1
    }
    return new Date(a.start).getTime() - new Date(b.start).getTime()
  })
}

export type EventGroupNode =
  | { items: EventListItem[]; children?: undefined }
  | { children: { label: string; node: EventGroupNode }[]; items?: undefined }

// Recursively partitions `items` by the remaining criteria, in priority
// order. 'distance' is skipped (falls through to the next criterion) when
// there's no origin to measure from, and events missing lat/lng (e.g.
// unknown-location events) fall back to a single "Unknown distance" bucket
// rather than being dropped.
function buildNode(
  items: EventListItem[],
  criteria: ListCriterion[],
  origin: LatLng | null,
  highlightedEventIds?: Set<string> | null,
): EventGroupNode {
  if (criteria.length === 0) return { items: sortByTime(items, highlightedEventIds) }

  const [criterion, ...rest] = criteria

  if (criterion === 'time') {
    const sorted = sortByTime(items, highlightedEventIds)
    return rest.length === 0 ? { items: sorted } : buildNode(sorted, rest, origin, highlightedEventIds)
  }

  if (criterion === 'distance' && !origin) {
    return buildNode(items, rest, origin, highlightedEventIds)
  }

  const buckets = new Map<string, EventListItem[]>()
  for (const event of items) {
    const key =
      criterion === 'source'
        ? getCalendarStyle(event.calendar).label
        : event.lat === undefined || event.lng === undefined
          ? 'Unknown distance'
          : distanceBandLabel(haversineMiles(origin as LatLng, { lat: event.lat, lng: event.lng }))
    const bucket = buckets.get(key)
    if (bucket) bucket.push(event)
    else buckets.set(key, [event])
  }

  const labels = [...buckets.keys()].sort((a, b) => {
    if (criterion !== 'distance') return a.localeCompare(b)
    const rank = (label: string) => {
      const idx = DISTANCE_BANDS.findIndex((band) => band.label === label)
      return idx === -1 ? DISTANCE_BANDS.length : idx // "Unknown distance" sorts last
    }
    return rank(a) - rank(b)
  })

  return {
    children: labels.map((label) => ({
      label,
      node: buildNode(buckets.get(label)!, rest, origin, highlightedEventIds),
    })),
  }
}

export function groupEvents(
  events: EventListItem[],
  order: ListCriterion[],
  origin: LatLng | null,
  highlightedEventIds?: Set<string> | null,
): EventGroupNode {
  return buildNode(events, order.length > 0 ? order : ['time'], origin, highlightedEventIds)
}
