'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EVENT_ENDED_BACKGROUND_COLOR, MAP_CALENDAR_LEGEND, RADIUS_HIGHLIGHT_FILL_COLOR } from '@/lib/mapCalendarLegend'
import { dateTimeFormatter, isEventEnded, type EventListItem } from '@/lib/mapEventFormat'
import EventPopupContent from './EventPopupContent'

const POPUP_WIDTH = 260
const POPUP_GAP = 10
const POPUP_MARGIN = 12

// Positioned to the right of the tile that opened it (clamped to stay
// on-screen) so it never sits on top of neighboring tiles.
function EventTilePopup({
  event,
  anchorRect,
}: {
  event: EventListItem
  anchorRect: DOMRect
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const ended = isEventEnded(event.end)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const width = el.offsetWidth
    const height = el.offsetHeight

    let left = anchorRect.right + POPUP_GAP
    left = Math.min(left, Math.max(POPUP_MARGIN, window.innerWidth - width - POPUP_MARGIN))

    let top = anchorRect.top
    top = Math.min(Math.max(top, POPUP_MARGIN), Math.max(POPUP_MARGIN, window.innerHeight - height - POPUP_MARGIN))

    setPos({ left, top })
  }, [anchorRect])

  return (
    <div
      ref={boxRef}
      className={`std-event-popup${ended ? ' std-event-popup-ended' : ''}`}
      style={{
        left: pos ? pos.left : anchorRect.right + POPUP_GAP,
        top: pos ? pos.top : anchorRect.top,
        visibility: pos ? 'visible' : 'hidden',
        width: POPUP_WIDTH,
      }}
    >
      <EventPopupContent event={event} />
    </div>
  )
}

export default function EventsList({
  events,
  highlightedEventIds = null,
}: {
  events: EventListItem[]
  // Events within the travel radius — shown bolded and pinned to the top.
  highlightedEventIds?: Set<string> | null
}) {
  const [active, setActive] = useState<{ event: EventListItem; rect: DOMRect } | null>(null)

  // Anchored to the whole tile (not just the title button) so the popup
  // starts clear of the tile edge instead of overlapping it. Clicking the
  // already-open tile again closes it.
  function toggleFor(event: EventListItem, target: HTMLElement) {
    setActive((prev) => {
      if (prev?.event.id === event.id) return null
      const tile = target.closest('.std-event-item') ?? target
      return { event, rect: tile.getBoundingClientRect() }
    })
  }

  useEffect(() => {
    if (!active) return

    function handlePointerDown(e: MouseEvent) {
      const inside = e
        .composedPath()
        .some(
          (el) =>
            el instanceof HTMLElement &&
            (el.classList.contains('std-event-popup') || el.classList.contains('std-event-item-main'))
        )
      if (!inside) setActive(null)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActive(null)
    }
    // Scroll events fired from inside the popup itself shouldn't close it —
    // only scrolling elsewhere on the page should.
    function handleScroll(e: Event) {
      if (e.target instanceof HTMLElement && e.target.closest('.std-event-popup')) return
      setActive(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [active])

  const { within, outside } = useMemo(() => {
    const byStart = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    if (!highlightedEventIds) return { within: byStart, outside: [] as EventListItem[] }
    return {
      within: byStart.filter((event) => highlightedEventIds.has(event.id)),
      outside: byStart.filter((event) => !highlightedEventIds.has(event.id)),
    }
  }, [events, highlightedEventIds])

  const showSectionHeaders = !!highlightedEventIds && within.length > 0 && outside.length > 0

  function renderGroup(items: EventListItem[], header: string | null) {
    if (items.length === 0) return null
    return (
      <div className="std-event-group">
        {header && <div className="std-event-group-header">{header}</div>}
        <ul className="std-event-list">{items.map(renderTile)}</ul>
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
        <button type="button" className="std-event-item-main" onClick={(e) => toggleFor(event, e.currentTarget)}>
          <div className="std-event-item-title-row">
            <span className="std-event-item-dot" style={{ backgroundColor: legend.color }} />
            <span
              className={`std-event-item-title${highlighted && !ended ? ' font-bold' : ''}${ended ? ' std-event-item-title-ended' : ''}`}
            >
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
                {event.location}
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
      {active && <EventTilePopup event={active.event} anchorRect={active.rect} />}
    </>
  )
}
