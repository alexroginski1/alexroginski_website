'use client'

import { useMemo } from 'react'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'
import { sanitizeDescriptionHtml } from '@/lib/sanitizeHtml'
import { popupEventDateTime, type EventListItem } from '@/lib/mapEventFormat'

// Shared between the map marker popup and the event-list tile popup, so
// hovering or clicking a dot and hovering or clicking its matching list tile
// show identical content.
export default function EventPopupContent({ event }: { event: EventListItem }) {
  const legend = MAP_CALENDAR_LEGEND[event.calendar]
  const descriptionHtml = useMemo(
    () => (event.description ? sanitizeDescriptionHtml(event.description) : null),
    [event.description]
  )

  return (
    <>
      <div className="std-map-popup-title-row">
        <span className="std-map-legend-dot" style={{ backgroundColor: legend.color }}>
          {legend.emoji}
        </span>
        <strong>{event.title}</strong>
      </div>
      <div className="std-map-popup-meta">
        {popupEventDateTime(event.start)}
        {event.location ? ` · ${event.location}` : ''}
      </div>
      {descriptionHtml && (
        <p className="std-map-popup-desc" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      )}
    </>
  )
}
