'use client'

import { useMemo, useState } from 'react'
import { getCalendarStyle } from '@/lib/mapCalendarLegend'
import { sanitizeDescriptionHtml } from '@/lib/sanitizeHtml'
import {
  addressWithoutCityStateZip,
  googleMapsUrl,
  isEventEnded,
  nowTillLabel,
  popupEventDateTime,
  relativeTimeLabel,
  type EventListItem,
} from '@/lib/mapEventFormat'

// Shared between the map marker popup and the event-list tile popup, so
// hovering or clicking a dot and hovering or clicking its matching list tile
// show identical content.
export default function EventPopupContent({ event }: { event: EventListItem }) {
  const legend = getCalendarStyle(event.calendar)
  const ended = isEventEnded(event.end)
  const relative = ended ? null : relativeTimeLabel(event.start, event.end)
  const ongoingNow = relative === 'now'
  const descriptionHtml = useMemo(
    () => (event.description ? sanitizeDescriptionHtml(event.description) : null),
    [event.description]
  )
  const [locationInfoOpen, setLocationInfoOpen] = useState(false)

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
        <div className="std-map-popup-location">
          {event.rawLocation && event.rawLocation !== event.location && (
            <div className="std-map-popup-meta std-map-location-line">
              {addressWithoutCityStateZip(event.rawLocation)}
              <span className="std-map-location-tag"> (Location from source)</span>
            </div>
          )}
          <div className="std-map-popup-meta std-map-location-line">
            <a
              href={googleMapsUrl(event.location)}
              target="_blank"
              rel="noopener noreferrer"
              className="std-map-location-link"
            >
              {addressWithoutCityStateZip(event.location)}
            </a>
            <span className="std-map-location-tag">
              {' '}
              ({event.approximateLocation ? 'Approximate — exact address not available' : 'Location looked up'})
            </span>
            <button
              type="button"
              className="std-map-info-icon"
              onClick={() => setLocationInfoOpen((v) => !v)}
              aria-expanded={locationInfoOpen}
              aria-label="Why two locations are shown"
            >
              i
            </button>
          </div>
          {locationInfoOpen && (
            <div className="std-map-location-info-popup">
              <button
                type="button"
                className="std-map-location-info-close"
                onClick={() => setLocationInfoOpen(false)}
                aria-label="Close explanation"
              >
                ×
              </button>
              <p>
                Event hosts provide locations in non-standard formats. They might put the event
                location as &ldquo;The Function&rdquo; or &ldquo;right on the corner of 18th and
                Stanyan&rdquo;. We need to standardize these locations into their full addresses so
                that we can put them on a map. For example, &ldquo;The Function&rdquo; becomes
                &ldquo;1414 Market St, San Francisco&rdquo; which now can be placed on a map.
              </p>
              <p>
                So, we look up each location automatically using a Google tool. While accurate most
                of the time, it sometimes misinterprets locations. That&apos;s why I&apos;m providing
                both the &ldquo;Location from source&rdquo; and &ldquo;Location looked up&rdquo;
                since the automatic lookup sometimes interprets locations incorrectly. Sometimes
                volleyball in Golden Gate Park is saved as location &ldquo;San Francisco&rdquo;,
                which is incorrect.
              </p>
              <p>
                It&apos;s so interesting that in the era of Google Maps, we really don&apos;t have to
                worry about full addresses! We just give a building&apos;s name to Google Maps and it
                immediately knows!
              </p>
              <p className="std-map-location-info-sign">–Alex</p>
            </div>
          )}
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
