'use client'

import { useMemo, useState } from 'react'
import { EVENT_ENDED_BACKGROUND_COLOR, getCalendarStyle, RADIUS_HIGHLIGHT_FILL_COLOR } from '@/lib/mapCalendarLegend'
import {
  dateTimeFormatter,
  isEventEnded,
  nowTillLabel,
  relativeTimeLabel,
  shortLocationLabel,
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
  // Every other section (source/time/distance groups, plus the "within
  // region" split) is open by default and collapsed individually by key —
  // absence from this set means expanded.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const { within, outside, ended } = useMemo(() => {
    const byStart = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    const active = byStart.filter((event) => !isEventEnded(event.end))
    const ended = byStart.filter((event) => isEventEnded(event.end))
    if (!highlightedEventIds) return { within: active, outside: [] as EventListItem[], ended }
    return {
      within: active.filter((event) => highlightedEventIds.has(event.id)),
      outside: active.filter((event) => !highlightedEventIds.has(event.id)),
      ended,
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
    const tree = groupEvents(items, sortGroupOrder, distanceOrigin)
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
    const legend = getCalendarStyle(event.calendar)
    const highlighted = highlightedEventIds?.has(event.id) ?? false
    // Ended styling takes priority over the "within region" highlight —
    // a past event reads as inactive regardless of where it was.
    const ended = isEventEnded(event.end)
    const ongoingNow = !ended && relativeTimeLabel(event.start, event.end) === 'now'
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
            {ongoingNow ? nowTillLabel(event.end) : dateTimeFormatter.format(new Date(event.start))}
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

  if (within.length === 0 && outside.length === 0 && ended.length === 0) return null

  return (
    <>
      <div className="std-event-groups">
        {renderGroup(within, showSectionHeaders ? 'Events within region' : null)}
        {renderGroup(outside, showSectionHeaders ? 'Events not in region' : null)}
      </div>
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
