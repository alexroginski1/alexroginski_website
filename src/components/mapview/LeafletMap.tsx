'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import type { ApiEvent } from '@/lib/mapTypes'
import type { MapCalendarKey } from '@/lib/calendarIds'
import { MAP_CALENDAR_LEGEND, RADIUS_HIGHLIGHT_COLOR } from '@/lib/mapCalendarLegend'
import { sanitizeDescriptionHtml } from '@/lib/sanitizeHtml'
import { googleCalendarUrl } from '@/lib/googleCalendar'
import { shortEventDateTime, popupEventDateTime, sfDateKey } from './EventsList'

const SF_CENTER: [number, number] = [37.7749, -122.4194]
const MILES_TO_METERS = 1609.34
const OUTSIDE_RADIUS_OPACITY = 0.25
const MARKER_LABEL_MAX_WORDS = 6
const MARKER_SIZE = 28
const MARKER_POPUP_WIDTH = 220
const HOVER_PREVIEW_MAX_LINES = 5

// Assigned to distinct calendar days (in order) whenever more than one day
// of events is visible at once, so same-day markers read as a group at a
// glance. Cycles if more days than colors are ever shown together.
const PASTEL_DATE_COLORS = [
  '#FDE2E4',
  '#CDE7F0',
  '#E2F0CB',
  '#FFF1C1',
  '#E5D4EF',
  '#FFDAC1',
  '#C1FFF4',
  '#F0D9FF',
]

// Plain-text preview of an event description for the hover popup — strips
// any embedded HTML (some calendar sources put raw markup in DESCRIPTION)
// and keeps only the first few non-blank lines.
function descriptionPreview(description: string | undefined, maxLines = HOVER_PREVIEW_MAX_LINES): string | null {
  if (!description) return null
  const text = new DOMParser().parseFromString(description, 'text/html').body.textContent ?? ''
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  return lines.slice(0, maxLines).join('\n')
}

function markerIconHtml(color: string, emoji: string, count: number): string {
  const badge = count > 1 ? `<span class="std-map-marker-badge">${count}</span>` : ''
  return `<span class="std-map-marker-emoji" style="background-color:${color}">${emoji}</span>${badge}`
}

// Precomputed once per calendar source — same emoji/color for every
// single-event marker of that type, so there's no need to build a new
// divIcon for the common case. Locations with more than one event get a
// count badge, built on demand since the count varies per marker.
const MARKER_ICONS: Record<MapCalendarKey, L.DivIcon> = Object.fromEntries(
  (Object.keys(MAP_CALENDAR_LEGEND) as MapCalendarKey[]).map((key) => {
    const { color, emoji } = MAP_CALENDAR_LEGEND[key]
    return [
      key,
      L.divIcon({
        className: 'std-map-marker-icon',
        html: markerIconHtml(color, emoji, 1),
        iconSize: [MARKER_SIZE, MARKER_SIZE],
        iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
      }),
    ]
  })
) as Record<MapCalendarKey, L.DivIcon>

function buildMarkerIcon(calendar: MapCalendarKey, count: number): L.DivIcon {
  const { color, emoji } = MAP_CALENDAR_LEGEND[calendar]
  return L.divIcon({
    className: 'std-map-marker-icon',
    html: markerIconHtml(color, emoji, count),
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
  })
}

function truncateTitle(title: string, maxWords = MARKER_LABEL_MAX_WORDS): string {
  const words = title.trim().split(/\s+/)
  if (words.length <= maxWords) return title.trim()
  return `${words.slice(0, maxWords).join(' ')}…`
}

// Groups events geocoded to (essentially) the same point so they share one
// marker instead of stacking unclickable duplicates on top of each other.
const LOCATION_KEY_PRECISION = 5 // ~1 meter of latitude/longitude

type EventGroup = {
  key: string
  lat: number
  lng: number
  events: ApiEvent[]
}

function groupEventsByLocation(events: ApiEvent[]): EventGroup[] {
  const groups = new Map<string, EventGroup>()
  for (const event of events) {
    const key = `${event.lat.toFixed(LOCATION_KEY_PRECISION)},${event.lng.toFixed(LOCATION_KEY_PRECISION)}`
    let group = groups.get(key)
    if (!group) {
      group = { key, lat: event.lat, lng: event.lng, events: [] }
      groups.set(key, group)
    }
    group.events.push(event)
  }
  return Array.from(groups.values())
}

function RecenterOnOrigin({ origin }: { origin: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (origin) map.setView([origin.lat, origin.lng], 13)
  }, [origin, map])
  return null
}

// Hides overlapping "permanent" tooltip labels after Leaflet positions them,
// keeping whichever label in each overlapping cluster was placed first (DOM
// order == event render order) and hiding the rest — since Leaflet has no
// built-in collision detection for tooltips.
function LabelDeclutter({ events }: { events: ApiEvent[] }) {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()

    function declutter() {
      const labels = Array.from(
        container.querySelectorAll<HTMLElement>('.leaflet-tooltip.std-map-marker-label')
      )
      const placed: DOMRect[] = []
      for (const label of labels) {
        label.classList.remove('std-map-marker-label-hidden')
        const rect = label.getBoundingClientRect()
        const overlapsPlaced = placed.some(
          (p) => rect.left < p.right && rect.right > p.left && rect.top < p.bottom && rect.bottom > p.top
        )
        if (overlapsPlaced) {
          label.classList.add('std-map-marker-label-hidden')
        } else {
          placed.push(rect)
        }
      }
    }

    const raf = requestAnimationFrame(declutter)
    map.on('zoomend moveend', declutter)
    return () => {
      cancelAnimationFrame(raf)
      map.off('zoomend moveend', declutter)
    }
  }, [map, events])
  return null
}

// Full title + description preview shown on marker hover. Rendered as a
// plain positioned div (not a Leaflet Tooltip/Popup) so it can't collide
// with the always-on label tooltip or the click-triggered popup, which are
// both bound to the marker itself.
function HoverPreview({ event }: { event: ApiEvent }) {
  const map = useMap()
  const boxRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  // Top-left corner of the box, clamped to stay inside the map viewport —
  // computed from the box's real rendered size, since a fixed offset from
  // the anchor point can push it past the map edge (where it gets clipped
  // by the container's overflow: hidden).
  const [box, setBox] = useState({ left: 0, top: 0 })

  useEffect(() => {
    function update() {
      const p = map.latLngToContainerPoint([event.lat, event.lng])
      setAnchor({ x: p.x, y: p.y })
    }
    update()
    map.on('move zoom', update)
    return () => {
      map.off('move zoom', update)
    }
  }, [map, event.lat, event.lng])

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!anchor || !el) return
    const mapSize = map.getSize()
    const margin = 6
    const gap = MARKER_SIZE / 2 + 8
    const width = el.offsetWidth
    const height = el.offsetHeight

    let left = anchor.x - width / 2
    left = Math.min(Math.max(left, margin), Math.max(margin, mapSize.x - width - margin))

    // Prefer sitting above the marker; flip below it if there isn't room.
    let top = anchor.y - gap - height
    if (top < margin) top = anchor.y + gap
    top = Math.min(Math.max(top, margin), Math.max(margin, mapSize.y - height - margin))

    setBox({ left, top })
  }, [anchor, map])

  if (!anchor) return null

  const preview = descriptionPreview(event.description)

  return (
    <div ref={boxRef} className="std-map-hover-preview" style={{ left: box.left, top: box.top }}>
      <div className="std-map-hover-preview-title">{event.title}</div>
      {preview && <div className="std-map-hover-preview-desc">{preview}</div>}
    </div>
  )
}

// On touch devices, a single-finger drag over the map would otherwise pan
// the map instead of scrolling the page — a common source of frustration
// when a map sits mid-article. Panning starts disabled and turns on after
// the visitor's first touch, so the first swipe through the section always
// scrolls the page like everything else on it.
function TouchGate() {
  const map = useMap()
  const [active, setActive] = useState(false)

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (!isTouchDevice) {
      setActive(true)
      return
    }
    map.dragging.disable()
    const container = map.getContainer()
    function activate() {
      map.dragging.enable()
      setActive(true)
      container.removeEventListener('touchstart', activate)
    }
    container.addEventListener('touchstart', activate, { passive: true })
    return () => {
      container.removeEventListener('touchstart', activate)
      map.dragging.enable()
    }
  }, [map])

  if (active) return null
  return <div className="std-map-touch-hint">Tap the map, then drag to explore</div>
}

function EventMarkerGroup({
  group,
  highlightedEventIds,
  dateColorByKey,
  onHover,
}: {
  group: EventGroup
  highlightedEventIds: Set<string> | null
  dateColorByKey: Map<string, string> | null
  onHover: (event: ApiEvent | null) => void
}) {
  const markerRef = useRef<L.Marker>(null)
  const [index, setIndex] = useState(0)
  const count = group.events.length
  // Clamp rather than reset to 0 on prop changes, so re-filtering the map
  // doesn't yank the user back to the first event mid-browse.
  const activeIndex = index < count ? index : count - 1
  const event = group.events[activeIndex]

  const descriptionHtml = useMemo(
    () => (event.description ? sanitizeDescriptionHtml(event.description) : null),
    [event.description]
  )

  const icon = useMemo(
    () => (count > 1 ? buildMarkerIcon(event.calendar, count) : MARKER_ICONS[event.calendar]),
    [event.calendar, count]
  )

  useEffect(() => {
    // The open popup's cached size/position is stale once its content
    // (the current event) changes underneath it.
    markerRef.current?.getPopup()?.update()
  }, [activeIndex])

  const withinRadius = !highlightedEventIds || highlightedEventIds.has(event.id)
  const opacity = withinRadius ? 0.85 : OUTSIDE_RADIUS_OPACITY
  const highlighted = !!highlightedEventIds && withinRadius
  const dateColor = dateColorByKey?.get(sfDateKey(event.start)) ?? null

  function stepIndex(delta: number) {
    setIndex((i) => ((i < count ? i : count - 1) + delta + count) % count)
  }

  return (
    <Marker
      ref={markerRef}
      position={[group.lat, group.lng]}
      icon={icon}
      opacity={opacity}
      eventHandlers={{
        mouseover: () => onHover(event),
        mouseout: () => onHover(null),
      }}
    >
      <Tooltip
        permanent
        interactive
        direction="top"
        offset={[0, -(MARKER_SIZE / 2 + 4)]}
        opacity={1}
        className="std-map-marker-label"
        eventHandlers={{ click: () => markerRef.current?.openPopup() }}
      >
        <div className="std-map-marker-label-inner" style={{ backgroundColor: dateColor ?? '#ffffff' }}>
          <div className={`std-map-marker-label-title${highlighted ? ' font-bold' : ''}`}>
            {truncateTitle(event.title)}
            {count > 1 && <span className="std-map-marker-label-count"> +{count - 1} more</span>}
          </div>
          <div className="std-map-marker-label-time">{shortEventDateTime(event.start)}</div>
        </div>
      </Tooltip>
      <Popup
        maxWidth={MARKER_POPUP_WIDTH}
        minWidth={MARKER_POPUP_WIDTH}
        maxHeight={260}
        autoPanPadding={[16, 16]}
      >
        {count > 1 && (
          <div className="std-map-popup-pager">
            <button type="button" onClick={() => stepIndex(-1)} aria-label="Previous event at this location">
              ‹
            </button>
            <span>
              {activeIndex + 1} of {count} here
            </span>
            <button type="button" onClick={() => stepIndex(1)} aria-label="Next event at this location">
              ›
            </button>
          </div>
        )}
        <strong>{event.title}</strong>
        <br />
        {popupEventDateTime(event.start)}
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
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="std-map-gcal-link"
        >
          + Add to Google Calendar
        </a>
      </Popup>
    </Marker>
  )
}

export default function LeafletMap({
  events,
  searchOrigin,
  radiusMiles,
  highlightedEventIds,
}: {
  events: ApiEvent[]
  searchOrigin: { lat: number; lng: number } | null
  radiusMiles: number | null
  // Events within the travel radius — non-null only while the radius filter
  // is active. Drives marker dimming/bolding to match the event list below.
  highlightedEventIds: Set<string> | null
}) {
  const groups = useMemo(() => groupEventsByLocation(events), [events])
  const [hoveredEvent, setHoveredEvent] = useState<ApiEvent | null>(null)

  // Only worth color-coding by day once more than one day is actually on
  // screen — a single-day view has nothing to distinguish.
  const dateColorByKey = useMemo(() => {
    const keys = Array.from(new Set(events.map((event) => sfDateKey(event.start)))).sort()
    if (keys.length <= 1) return null
    return new Map(keys.map((key, i) => [key, PASTEL_DATE_COLORS[i % PASTEL_DATE_COLORS.length]]))
  }, [events])

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
              pathOptions={{
                color: RADIUS_HIGHLIGHT_COLOR,
                fillColor: RADIUS_HIGHLIGHT_COLOR,
                fillOpacity: 0.12,
                weight: 2,
              }}
              interactive={false}
            />
          )}
        </>
      )}

      {groups.map((group) => (
        <EventMarkerGroup
          key={group.key}
          group={group}
          highlightedEventIds={highlightedEventIds}
          dateColorByKey={dateColorByKey}
          onHover={setHoveredEvent}
        />
      ))}

      {hoveredEvent && <HoverPreview event={hoveredEvent} />}

      <LabelDeclutter events={events} />
      <TouchGate />
    </MapContainer>
  )
}
