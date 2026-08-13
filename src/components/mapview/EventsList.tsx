'use client'

import { useMemo, useState } from 'react'
import { EVENT_ENDED_BACKGROUND_COLOR, MAP_CALENDAR_LEGEND, RADIUS_HIGHLIGHT_FILL_COLOR } from '@/lib/mapCalendarLegend'
import { dateTimeFormatter, isEventEnded, shortLocationLabel, type EventListItem } from '@/lib/mapEventFormat'
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

  const { within, outside } = useMemo(() => {
    const byStart = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    if (!highlightedEventIds) return { within: byStart, outside: [] as EventListItem[] }
    return {
      within: byStart.filter((event) => highlightedEventIds.has(event.id)),
      outside: byStart.filter((event) => !highlightedEventIds.has(event.id)),
    }
  }, [events, highlightedEventIds])

  const showSectionHeaders = !!highlightedEventIds && within.length > 0 && outside.length > 0
  // A "source" section header already names the calendar — repeating it on
  // every tile inside that section is redundant.
  const hideSourceLabel = sortGroupOrder.includes('source')

  // The "within region" split (above) is always the outermost partition when
  // active; the user's own sort/group picks are layered inside each side of
  // it, rather than replacing it, so the radius highlight never disappears.
  function renderNode(node: EventGroupNode, keyPrefix: string, level: number) {
    if (node.items) {
      if (node.items.length === 0) return null
      return <ul className="std-event-list">{node.items.map(renderTile)}</ul>
    }
    return (
      <>
        {node.children.map(({ label, node: child }, index) => {
          const rendered = renderNode(child, `${keyPrefix}-${index}`, level + 1)
          if (!rendered) return null
          return (
            <div className="std-event-group" key={`${keyPrefix}-${label}`}>
              <div
                className="std-event-group-header"
                style={level > 0 ? { paddingLeft: `${level * 12}px` } : undefined}
              >
                {label}
              </div>
              {rendered}
            </div>
          )
        })}
      </>
    )
  }

  function renderGroup(items: EventListItem[], header: string | null) {
    if (items.length === 0) return null
    const tree = groupEvents(items, sortGroupOrder, distanceOrigin)
    return (
      <div className="std-event-group">
        {header && <div className="std-event-group-header">{header}</div>}
        {renderNode(tree, header ?? 'root', 0)}
      </div>
    )
  }

  function renderTile(event: EventListItem) {
    const legend = MAP_CALENDAR_LEGEND[event.calendar]
    const highlighted = highlightedEventIds?.has(event.id) ?? false
    // Ended styling takes priority over the "within region" highlight —
    // a past event reads as inactive regardless of where it was.
    const ended = isEventEnded(event.end)
    const tileBackground = ended ? EVENT_ENDED_BACKGROUND_COLOR : highlighted ? RADIUS_HIGHLIGHT_FILL_COLOR : undefined
    return (
      <li key={event.id} className="std-event-item" style={tileBackground ? { backgroundColor: tileBackground } : undefined}>
        <button type="button" className="std-event-item-main" onClick={() => setSelected(event)}>
          <div className="std-event-item-title-row">
            <span className="std-event-item-dot" style={{ backgroundColor: legend.color }} />
            <span
              className={`std-event-item-title${highlighted && !ended ? ' font-bold' : ''}${ended ? ' std-event-item-title-ended' : ''}`}
            >
              {!hideSourceLabel && <span className="std-event-item-source">{legend.label}: </span>}
              {event.title}
            </span>
          </div>
          <div className="std-event-item-meta">
            {dateTimeFormatter.format(new Date(event.start))}
            {ended && (
              <>
                <br />
                <span className="std-event-item-ended-badge">Event Ended</span>
              </>
            )}
            {event.location && (
              <>
                <br />
                {shortLocationLabel(event.location)}
              </>
            )}
          </div>
        </button>
      </li>
    )
  }

  if (within.length === 0 && outside.length === 0) return null

  return (
    <>
      <div className="std-event-groups">
        {renderGroup(within, showSectionHeaders ? 'Events within region' : null)}
        {renderGroup(outside, showSectionHeaders ? 'Events not in region' : null)}
      </div>
      {selected && (
        <MapEventSidebar events={[selected]} index={0} onIndexChange={() => {}} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
