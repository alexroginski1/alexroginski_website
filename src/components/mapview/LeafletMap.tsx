'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet'
import type { ApiEvent } from '@/lib/mapTypes'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'

const SF_CENTER: [number, number] = [37.7749, -122.4194]
const MILES_TO_METERS = 1609.34

function RecenterOnOrigin({ origin }: { origin: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (origin) map.setView([origin.lat, origin.lng], 13)
  }, [origin, map])
  return null
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <RecenterOnOrigin origin={searchOrigin} />

      {searchOrigin && (
        <>
          <CircleMarker
            center={[searchOrigin.lat, searchOrigin.lng]}
            radius={8}
            pathOptions={{ color: '#1c1917', fillColor: '#1c1917', fillOpacity: 1 }}
          />
          {radiusMiles !== null && radiusMiles > 0 && (
            <Circle
              center={[searchOrigin.lat, searchOrigin.lng]}
              radius={radiusMiles * MILES_TO_METERS}
              pathOptions={{ color: '#1c1917', fillOpacity: 0.05, weight: 1 }}
            />
          )}
        </>
      )}

      {events.map((event) => {
        const legend = MAP_CALENDAR_LEGEND[event.calendar]
        return (
          <CircleMarker
            key={event.id}
            center={[event.lat, event.lng]}
            radius={7}
            pathOptions={{ color: legend.color, fillColor: legend.color, fillOpacity: 0.85, weight: 1.5 }}
          >
            <Popup>
              <strong>{event.title}</strong>
              <br />
              {legend.label}
              <br />
              {new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              {event.location && (
                <>
                  <br />
                  {event.location}
                </>
              )}
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
