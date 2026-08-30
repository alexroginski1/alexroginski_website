'use client'

import { useMemo, useState } from 'react'
import {
  EVENT_ENDED_BACKGROUND_COLOR,
  RADIUS_HIGHLIGHT_FILL_COLOR,
  UNKNOWN_LOCATION_BACKGROUND_COLOR,
} from '@/lib/mapCalendarLegend'
import {
  addressWithoutCityStateZip,
  buildDayColorMap,
  eventListDateParts,
  googleMapsUrl,
  isEventEnded,
  nowTillLabel,
  relativeTimeLabel,
  sfDateKey,
  type EventListItem,
} from '@/lib/mapEventFormat'
import { groupEvents, type EventGroupNode, type ListCriterion } from '@/lib/mapListGrouping'
import type { LatLng } from '@/lib/geo'
import MapEventSidebar from './MapEventSidebar'

export default function EventsList({
  events,
  highlightedEventIds = null,
  sortGroupOrder = [],
  distanceOrigin = null,
}: {
  events: EventListItem[]
  // Events within the travel radius — shown bolded and pinned to the top.
  highlightedEventIds?: Set<string> | null
  // User-picked sort/group criteria, in priority order — see SortGroupControl.
  sortGroupOrder?: ListCriterion[]
  // Origin for 'distance' grouping; ignored (criterion falls through) when null.
  distanceOrigin?: LatLng | null
}) {
  // Reuses the same click-triggered sidebar as the Map view (see
  // LeafletMap's `selected` state) rather than a separate popup, so an
  // event's detail view looks and behaves identically from either tab.
  const [selected, setSelected] = useState<EventListItem | null>(null)
  // Collapsed by default — ended events are stashed out of the way so
  // scrolling the list only surfaces things still relevant to the user.
  const [endedExpanded, setEndedExpanded] = useState(false)
  // Every other section (source/time/distance groups) is open by default
  // and collapsed individually by key — absence from this set means expanded.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Same palette/assignment as the map view's marker weekday badges, built
  // from the same underlying event set, so a given date reads as the same
  // color whether the user is looking at the map or the list.
  const dayColors = useMemo(() => buildDayColorMap(events), [events])

  const { active, ended } = useMemo(() => {
    const byStart = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    return {
      active: byStart.filter((event) => !isEventEnded(event.end)),
      ended: byStart.filter((event) => isEventEnded(event.end)),
    }
  }, [events])

  function renderNode(node: EventGroupNode, keyPrefix: string, level: number) {
    if (node.items) {
      if (node.items.length === 0) return null
      return <ul className="std-event-list">{node.items.map(renderTile)}</ul>
    }
    return (
      <>
        {node.children.map(({ label, node: child }, index) => {
          const key = `${keyPrefix}-${index}-${label}`
          const rendered = renderNode(child, key, level + 1)
          if (!rendered) return null
          const collapsed = collapsedGroups.has(key)
          return (
            <div className="std-event-group" key={key}>
              <button
                type="button"
                className="std-event-group-header std-event-group-header-toggle"
                style={level > 0 ? { paddingLeft: `${level * 12}px` } : undefined}
                onClick={() => toggleGroup(key)}
                aria-expanded={!collapsed}
              >
                <span className={`std-event-group-caret${collapsed ? '' : ' std-event-group-caret-open'}`}>▸</span>
                {label}
              </button>
              {!collapsed && rendered}
            </div>
          )
        })}
      </>
    )
  }

  function renderGroup(items: EventListItem[], header: string | null) {
    if (items.length === 0) return null
    const tree = groupEvents(items, sortGroupOrder, distanceOrigin, highlightedEventIds)
    const key = header ?? 'root'
    const collapsed = header ? collapsedGroups.has(key) : false
    return (
      <div className="std-event-group">
        {header && (
          <button
            type="button"
            className="std-event-group-header std-event-group-header-toggle"
            onClick={() => toggleGroup(key)}
            aria-expanded={!collapsed}
          >
            <span className={`std-event-group-caret${collapsed ? '' : ' std-event-group-caret-open'}`}>▸</span>
            {header}
          </button>
        )}
        {!collapsed && renderNode(tree, key, 0)}
      </div>
    )
  }

  function renderTile(event: EventListItem) {
    const highlighted = highlightedEventIds?.has(event.id) ?? false
    // Ended styling takes priority over the "within region" highlight —
    // a past event reads as inactive regardless of where it was.
    const ended = isEventEnded(event.end)
    const ongoingNow = !ended && relativeTimeLabel(event.start, event.end) === 'now'
    // Events whose location couldn't be geocoded arrive with no lat/lng at
    // all (see UnknownLocationEvent) — real events always have both, so
    // this is a reliable signal without needing a separate flag.
    const locationUnknown = event.lat === undefined || event.lng === undefined
    const tileBackground = ended
      ? EVENT_ENDED_BACKGROUND_COLOR
      : locationUnknown
        ? UNKNOWN_LOCATION_BACKGROUND_COLOR
        : highlighted
          ? RADIUS_HIGHLIGHT_FILL_COLOR
          : undefined
    const dayColor = dayColors.get(sfDateKey(event.start))
    const { weekday, rest } = eventListDateParts(event.start)
    const rawVenue = event.rawLocation || event.location
    const venue = rawVenue ? addressWithoutCityStateZip(rawVenue) : undefined
    const mapsQuery = event.location || rawVenue
    const openSidebar = () => setSelected(event)
    return (
      <li key={event.id} className="std-event-item" style={tileBackground ? { backgroundColor: tileBackground } : undefined}>
        {/* A `div` (not `button`) so the venue link below can nest inside it —
            an `<a>` inside a `<button>` is invalid HTML and behaves
            unpredictably for keyboard/screen-reader users. */}
        <div
          className="std-event-item-main"
          role="button"
          tabIndex={0}
          onClick={openSidebar}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openSidebar()
            }
          }}
        >
          <div className="std-event-item-title-row">
            <span
              className={`std-event-item-title${highlighted && !ended ? ' font-bold' : ''}${ended ? ' std-event-item-title-ended' : ''}`}
            >
              {event.title}
            </span>
          </div>
          <div className="std-event-item-meta">
            {ongoingNow ? (
              nowTillLabel(event.end)
            ) : (
              <>
                <span className="std-event-item-day" style={dayColor ? { backgroundColor: dayColor } : undefined}>
                  {weekday}
                </span>{' '}
                {rest}
              </>
            )}
            {venue && (
              <>
                {' · '}
                {event.neighborhood && `${event.neighborhood} `}(
                <a
                  href={googleMapsUrl(mapsQuery || venue)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="std-event-item-venue"
                  onClick={(e) => e.stopPropagation()}
                >
                  {venue}
                </a>
                )
              </>
            )}
            {event.eventLink && (
              <>
                {' · '}
                <a
                  href={event.eventLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="std-event-item-venue"
                  onClick={(e) => e.stopPropagation()}
                >
                  Event Link
                </a>
              </>
            )}
            {event.calendarLink && (
              <>
                {' · '}
                <a
                  href={event.calendarLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="std-event-item-venue"
                  onClick={(e) => e.stopPropagation()}
                >
                  Calendar
                </a>
              </>
            )}
            {ended && (
              <>
                <br />
                <span className="std-event-item-ended-badge">Event Ended</span>
              </>
            )}
            {locationUnknown && (
              <>
                <br />
                <span className="std-event-item-unknown-location-badge">! Could not place on map</span>
              </>
            )}
          </div>
        </div>
      </li>
    )
  }

  if (active.length === 0 && ended.length === 0) return null

  return (
    <>
      <div className="std-event-groups">{renderGroup(active, null)}</div>
      {ended.length > 0 && (
        <div className="std-event-ended-section">
          <button
            type="button"
            className="std-event-ended-toggle"
            onClick={() => setEndedExpanded((expanded) => !expanded)}
            aria-expanded={endedExpanded}
          >
            <span className={`std-event-ended-toggle-caret${endedExpanded ? ' std-event-ended-toggle-caret-open' : ''}`}>▸</span>
            Ended Events ({ended.length})
          </button>
          {endedExpanded && <div className="std-event-groups">{renderGroup(ended, null)}</div>}
        </div>
      )}
      {selected && (
        <MapEventSidebar
          events={[selected]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setSelected(null)}
          className="std-map-sidebar-right"
        />
      )}
    </>
  )
}
