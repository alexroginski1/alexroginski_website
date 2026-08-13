'use client'

import { useMemo } from 'react'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'
import { sanitizeDescriptionHtml } from '@/lib/sanitizeHtml'
import {
  googleMapsUrl,
  isEventEnded,
  nowTillLabel,
  popupEventDateTime,
  relativeTimeLabel,
  shortLocationLabel,
  type EventListItem,
} from '@/lib/mapEventFormat'

// Shared between the map marker popup and the event-list tile popup, so
// hovering or clicking a dot and hovering or clicking its matching list tile
// show identical content.
export default function EventPopupContent({ event }: { event: EventListItem }) {
  const legend = MAP_CALENDAR_LEGEND[event.calendar]
  const ended = isEventEnded(event.end)
  const relative = ended ? null : relativeTimeLabel(event.start, event.end)
  const ongoingNow = relative === 'now'
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
      <div className="std-map-popup-meta-row">
        <span className="std-map-popup-meta">
          {ongoingNow ? nowTillLabel(event.end) : popupEventDateTime(event.start, event.end)}
        </span>
        {ended && <span className="std-map-popup-ended-badge">Event Ended</span>}
        {relative && !ongoingNow && <span className="std-map-popup-relative">{relative}</span>}
      </div>
      {event.location && (
        <div className="std-map-popup-meta std-map-popup-location">
          {event.rawLocation && event.rawLocation !== event.location && `${event.rawLocation} · `}
          <a href={googleMapsUrl(event.location)} target="_blank" rel="noopener noreferrer" className="std-map-location-link">
            {shortLocationLabel(event.location)}
          </a>
        </div>
      )}
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
      {descriptionHtml && (
        <p className="std-map-popup-desc" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      )}
    </>
  )
}
