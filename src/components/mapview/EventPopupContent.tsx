'use client'

import { useMemo } from 'react'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'
import { sanitizeDescriptionHtml } from '@/lib/sanitizeHtml'
import { isEventEnded, popupEventDateTime, type EventListItem } from '@/lib/mapEventFormat'

// Shared between the map marker popup and the event-list tile popup, so
// hovering or clicking a dot and hovering or clicking its matching list tile
// show identical content.
export default function EventPopupContent({ event }: { event: EventListItem }) {
  const legend = MAP_CALENDAR_LEGEND[event.calendar]
  const ended = isEventEnded(event.end)
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
        <strong>
          <span className={ended ? 'std-map-popup-title-ended' : undefined}>{event.title}</span>
        </strong>
      </div>
      <div className="std-map-popup-meta">
        {popupEventDateTime(event.start, event.end)}
        {ended && (
          <>
            <br />
            <span className="std-map-popup-ended-badge">Event Ended</span>
          </>
        )}
      </div>
      {event.calendarLink && (
        <a
          href={event.calendarLink}
          target="_blank"
          rel="noopener noreferrer"
          className="std-map-gcal-link"
        >
          + Add to Google Calendar
        </a>
      )}
      {event.location && <div className="std-map-popup-meta">{event.location}</div>}
      {descriptionHtml && (
        <p className="std-map-popup-desc" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      )}
    </>
  )
}
