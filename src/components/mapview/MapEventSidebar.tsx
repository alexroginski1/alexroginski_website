'use client'

import { useEffect, useMemo, useRef } from 'react'
import { eventStatusRank, type EventListItem } from '@/lib/mapEventFormat'
import EventPopupContent from './EventPopupContent'

// The click-triggered detail panel for a map marker — analogous to the
// info panel Google Maps opens when you click a point of interest. Shown
// for exactly one marker group at a time (see LeafletMap's `selected` state).
export default function MapEventSidebar({
  events,
  index,
  onIndexChange,
  onClose,
  className = '',
}: {
  events: EventListItem[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  // Extra class for placement — e.g. the list view anchors it to the right
  // edge instead of the left, so it doesn't cover the event titles.
  className?: string
}) {
  // Happening now first, then soonest-upcoming, with already-ended events
  // pushed to the bottom — `index` then just walks this ordered list.
  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const rankDiff = eventStatusRank(a.start, a.end) - eventStatusRank(b.start, b.end)
        return rankDiff !== 0 ? rankDiff : new Date(a.start).getTime() - new Date(b.start).getTime()
      }),
    [events]
  )
  const count = sortedEvents.length
  const activeIndex = index < count ? index : count - 1
  const event = sortedEvents[activeIndex]

  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [onClose])

  return (
    <div ref={rootRef} className={`std-map-sidebar${className ? ` ${className}` : ''}`}>
      <button type="button" className="std-map-sidebar-close" onClick={onClose} aria-label="Close event details">
        ×
      </button>
      {count > 1 && (
        <div className="std-map-popup-pager">
          <button
            type="button"
            onClick={() => onIndexChange((activeIndex - 1 + count) % count)}
            aria-label="Previous event at this location"
          >
            ‹
          </button>
          <span>
            {activeIndex + 1} of {count} here
          </span>
          <button
            type="button"
            onClick={() => onIndexChange((activeIndex + 1) % count)}
            aria-label="Next event at this location"
          >
            ›
          </button>
        </div>
      )}
      <EventPopupContent event={event} />
    </div>
  )
}
