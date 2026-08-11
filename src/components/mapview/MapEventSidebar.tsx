'use client'

import type { EventListItem } from '@/lib/mapEventFormat'
import EventPopupContent from './EventPopupContent'

// The click-triggered detail panel for a map marker — analogous to the
// info panel Google Maps opens when you click a point of interest. Shown
// for exactly one marker group at a time (see LeafletMap's `selected` state).
export default function MapEventSidebar({
  events,
  index,
  onIndexChange,
  onClose,
}: {
  events: EventListItem[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const count = events.length
  const activeIndex = index < count ? index : count - 1
  const event = events[activeIndex]

  return (
    <div className="std-map-sidebar">
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
