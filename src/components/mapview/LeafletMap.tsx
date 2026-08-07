'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet'
import type { ApiEvent } from '@/lib/mapTypes'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'
import { haversineMiles } from '@/lib/geo'
import { sanitizeDescriptionHtml } from '@/lib/sanitizeHtml'

const SF_CENTER: [number, number] = [37.7749, -122.4194]
const MILES_TO_METERS = 1609.34
const OUTSIDE_RADIUS_OPACITY = 0.25

function RecenterOnOrigin({ origin }: { origin: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (origin) map.setView([origin.lat, origin.lng], 13)
  }, [origin, map])
  return null
}

function EventMarker({
  event,
  opacity,
}: {
  event: ApiEvent
  opacity: number
}) {
  const legend = MAP_CALENDAR_LEGEND[event.calendar]
  const descriptionHtml = useMemo(
    () => (event.description ? sanitizeDescriptionHtml(event.description) : null),
    [event.description]
  )
  return (
    <CircleMarker
      center={[event.lat, event.lng]}
      radius={7}
      pathOptions={{
        color: legend.color,
        fillColor: legend.color,
        fillOpacity: opacity,
        opacity,
        weight: 1.5,
      }}
    >
      <Popup maxWidth={280} maxHeight={260}>
        <strong>{event.title}</strong>
        <br />
        {new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        {event.location && (
          <>
            <br />
            {event.location}
          </>
        )}
        {descriptionHtml && (
          <p
            style={{ whiteSpace: 'pre-wrap', marginTop: '0.4rem' }}
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        )}
      </Popup>
    </CircleMarker>
  )
}

export default function LeafletMap({
  events,
  searchOrigin,
  radiusMiles,
}: {
  events: ApiEvent[]
  searchOrigin: { lat: number; lng: number } | null
  radiusMiles: number | null
}) {
  return (
    <MapContainer center={SF_CENTER} zoom={12} scrollWheelZoom={false} className="std-map-container">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      <RecenterOnOrigin origin={searchOrigin} />

      {searchOrigin && (
        <>
          {/* Non-interactive: a big semi-transparent overlay would otherwise
              sit in front of (or intercept clicks meant for) the event
              markers underneath it. */}
          <CircleMarker
            center={[searchOrigin.lat, searchOrigin.lng]}
            radius={8}
            pathOptions={{ color: '#1c1917', fillColor: '#1c1917', fillOpacity: 1 }}
            interactive={false}
          />
          {radiusMiles !== null && radiusMiles > 0 && (
            <Circle
              center={[searchOrigin.lat, searchOrigin.lng]}
              radius={radiusMiles * MILES_TO_METERS}
              pathOptions={{ color: '#1c1917', fillOpacity: 0.05, weight: 1 }}
              interactive={false}
            />
          )}
        </>
      )}

      {events.map((event) => {
        const withinRadius =
          !searchOrigin || radiusMiles === null
            ? true
            : haversineMiles(searchOrigin, { lat: event.lat, lng: event.lng }) <= radiusMiles
        return (
          <EventMarker key={event.id} event={event} opacity={withinRadius ? 0.85 : OUTSIDE_RADIUS_OPACITY} />
        )
      })}
    </MapContainer>
  )
}
