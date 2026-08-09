'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MAP_CALENDAR_LEGEND, RADIUS_HIGHLIGHT_COLOR } from '@/lib/mapCalendarLegend'
import { dateTimeFormatter, type EventListItem } from '@/lib/mapEventFormat'
import EventPopupContent from './EventPopupContent'

const POPUP_WIDTH = 260
const POPUP_GAP = 10
const POPUP_MARGIN = 12
const POPUP_CLOSE_DELAY = 200

function UpvoteButton({
  count,
  voted,
  onToggle,
}: {
  count: number
  voted: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`std-upvote-btn${voted ? ' std-upvote-btn-active' : ''}`}
      onClick={onToggle}
      aria-pressed={voted}
      aria-label={voted ? 'Remove upvote' : 'Upvote this event'}
    >
      <span className="std-upvote-arrow" aria-hidden="true">
        ▲
      </span>
      <span className="std-upvote-count">{count}</span>
    </button>
  )
}

// Positioned to the right of the tile that opened it (clamped to stay
// on-screen) so it never sits on top of neighboring tiles and block hovering
// between them.
function EventTilePopup({
  event,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
}: {
  event: EventListItem
  anchorRect: DOMRect
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

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
      className="std-event-popup"
      style={{
        left: pos ? pos.left : anchorRect.right + POPUP_GAP,
        top: pos ? pos.top : anchorRect.top,
        visibility: pos ? 'visible' : 'hidden',
        width: POPUP_WIDTH,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <EventPopupContent event={event} />
    </div>
  )
}

export default function EventsList({
  events,
  upvoteCounts,
  votedEventIds,
  onToggleUpvote,
  highlightedEventIds = null,
}: {
  events: EventListItem[]
  upvoteCounts: Record<string, number>
  votedEventIds: Set<string>
  onToggleUpvote: (eventId: string) => void
  // Events within the travel radius — shown bolded and pinned to the top.
  highlightedEventIds?: Set<string> | null
}) {
  const [active, setActive] = useState<{ event: EventListItem; rect: DOMRect } | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  function cancelClose() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function scheduleClose() {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => setActive(null), POPUP_CLOSE_DELAY)
  }

  // Anchored to the whole tile (not just the title button) so the popup
  // starts to the right of the upvote button too, instead of overlapping it.
  function openFor(event: EventListItem, target: HTMLElement) {
    cancelClose()
    const tile = target.closest('.std-event-item') ?? target
    setActive({ event, rect: tile.getBoundingClientRect() })
  }

  useEffect(() => {
    if (!active) return

    // Hover already closes the popup on mouseleave; this is the fallback for
    // touch/keyboard interactions, which never fire mouseleave.
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
    function handleScroll() {
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

  const sortedEvents = useMemo(() => {
    const byStart = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    if (!highlightedEventIds) return byStart
    const within = byStart.filter((event) => highlightedEventIds.has(event.id))
    const outside = byStart.filter((event) => !highlightedEventIds.has(event.id))
    return [...within, ...outside]
  }, [events, highlightedEventIds])

  if (sortedEvents.length === 0) return null

  return (
    <>
      <ul className="std-event-list">
        {sortedEvents.map((event) => {
          const legend = MAP_CALENDAR_LEGEND[event.calendar]
          const highlighted = highlightedEventIds?.has(event.id) ?? false
          return (
            <li
              key={event.id}
              className="std-event-item"
              style={highlighted ? { backgroundColor: RADIUS_HIGHLIGHT_COLOR } : undefined}
            >
              <button
                type="button"
                className="std-event-item-main"
                onClick={(e) => openFor(event, e.currentTarget)}
                onMouseEnter={(e) => openFor(event, e.currentTarget)}
                onMouseLeave={scheduleClose}
                onFocus={(e) => openFor(event, e.currentTarget)}
                onBlur={scheduleClose}
              >
                <div className="std-event-item-title-row">
                  <span className="std-event-item-dot" style={{ backgroundColor: legend.color }} />
                  <span className={`std-event-item-title${highlighted ? ' font-bold' : ''}`}>{event.title}</span>
                </div>
                <div className="std-event-item-meta">
                  {dateTimeFormatter.format(new Date(event.start))}
                  {event.location ? ` · ${event.location}` : ''}
                </div>
              </button>
              <UpvoteButton
                count={upvoteCounts[event.id] ?? 0}
                voted={votedEventIds.has(event.id)}
                onToggle={() => onToggleUpvote(event.id)}
              />
            </li>
          )
        })}
      </ul>
      {active && (
        <EventTilePopup
          event={active.event}
          anchorRect={active.rect}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </>
  )
}
