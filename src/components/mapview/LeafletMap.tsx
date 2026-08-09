'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import type { ApiEvent } from '@/lib/mapTypes'
import type { MapCalendarKey } from '@/lib/calendarIds'
import { MAP_CALENDAR_LEGEND, RADIUS_HIGHLIGHT_COLOR } from '@/lib/mapCalendarLegend'
import { shortEventDateTime, sfDateKey } from '@/lib/mapEventFormat'
import EventPopupContent from './EventPopupContent'

const SF_CENTER: [number, number] = [37.7749, -122.4194]
const MILES_TO_METERS = 1609.34
const OUTSIDE_RADIUS_OPACITY = 0.25
const MARKER_LABEL_MAX_WORDS = 9
const MARKER_SIZE = 28
const MARKER_POPUP_WIDTH = 220
const POPUP_CLOSE_DELAY = 200

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

// Marker "permanent" tooltip labels default to sitting above their dot, but
// dense clusters make that overlap. LabelPlacer re-checks each label after
// Leaflet lays them out and, for any that collide with an already-placed
// label, tries the next preferred side in turn (below, then left, then
// right of the dot) before giving up and hiding it — since Leaflet has no
// built-in collision detection for tooltips.
const LABEL_DIRECTIONS = ['top', 'bottom', 'left', 'right'] as const
type LabelDirection = (typeof LABEL_DIRECTIONS)[number]
type LabelPlacement = { direction: LabelDirection; hidden: boolean }
const DEFAULT_LABEL_PLACEMENT: LabelPlacement = { direction: 'top', hidden: false }
const LABEL_GAP = MARKER_SIZE / 2 + 4

function labelOffset(direction: LabelDirection): [number, number] {
  switch (direction) {
    case 'top':
      return [0, -LABEL_GAP]
    case 'bottom':
      return [0, LABEL_GAP]
    case 'left':
      return [-LABEL_GAP, 0]
    case 'right':
      return [LABEL_GAP, 0]
  }
}

function labelCandidateRect(
  direction: LabelDirection,
  anchor: { x: number; y: number },
  width: number,
  height: number
) {
  switch (direction) {
    case 'top':
      return {
        left: anchor.x - width / 2,
        top: anchor.y - LABEL_GAP - height,
        right: anchor.x + width / 2,
        bottom: anchor.y - LABEL_GAP,
      }
    case 'bottom':
      return {
        left: anchor.x - width / 2,
        top: anchor.y + LABEL_GAP,
        right: anchor.x + width / 2,
        bottom: anchor.y + LABEL_GAP + height,
      }
    case 'left':
      return {
        left: anchor.x - LABEL_GAP - width,
        top: anchor.y - height / 2,
        right: anchor.x - LABEL_GAP,
        bottom: anchor.y + height / 2,
      }
    case 'right':
      return {
        left: anchor.x + LABEL_GAP,
        top: anchor.y - height / 2,
        right: anchor.x + LABEL_GAP + width,
        bottom: anchor.y + height / 2,
      }
  }
}

function LabelPlacer({
  groups,
  markerRegistry,
  onChange,
}: {
  groups: EventGroup[]
  markerRegistry: Map<string, L.Marker>
  onChange: (placements: Map<string, LabelPlacement>) => void
}) {
  const map = useMap()
  useEffect(() => {
    function place() {
      const placed: { left: number; top: number; right: number; bottom: number }[] = []
      const next = new Map<string, LabelPlacement>()

      for (const group of groups) {
        const marker = markerRegistry.get(group.key)
        const el = marker?.getTooltip()?.getElement()
        if (!marker || !el) continue

        const anchor = map.latLngToContainerPoint(marker.getLatLng())
        const width = el.offsetWidth
        const height = el.offsetHeight

        let placement: LabelPlacement = { direction: 'top', hidden: true }
        for (const direction of LABEL_DIRECTIONS) {
          const rect = labelCandidateRect(direction, anchor, width, height)
          const overlaps = placed.some(
            (p) => rect.left < p.right && rect.right > p.left && rect.top < p.bottom && rect.bottom > p.top
          )
          if (!overlaps) {
            placed.push(rect)
            placement = { direction, hidden: false }
            break
          }
        }
        next.set(group.key, placement)
      }

      onChange(next)
    }

    const raf = requestAnimationFrame(place)
    map.on('zoomend moveend', place)
    return () => {
      cancelAnimationFrame(raf)
      map.off('zoomend moveend', place)
    }
  }, [map, groups, markerRegistry, onChange])
  return null
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
  placement,
  registerMarker,
}: {
  group: EventGroup
  highlightedEventIds: Set<string> | null
  dateColorByKey: Map<string, string> | null
  placement: LabelPlacement
  registerMarker: (key: string, marker: L.Marker | null) => void
}) {
  const markerRef = useRef<L.Marker>(null)
  const closeTimerRef = useRef<number | null>(null)
  const hoveredRef = useRef(false)
  const [index, setIndex] = useState(0)
  const count = group.events.length
  // Clamp rather than reset to 0 on prop changes, so re-filtering the map
  // doesn't yank the user back to the first event mid-browse.
  const activeIndex = index < count ? index : count - 1
  const event = group.events[activeIndex]

  const icon = useMemo(
    () => (count > 1 ? buildMarkerIcon(event.calendar, count) : MARKER_ICONS[event.calendar]),
    [event.calendar, count]
  )

  useEffect(() => {
    // The open popup's cached size/position is stale once its content
    // (the current event) changes underneath it.
    markerRef.current?.getPopup()?.update()
  }, [activeIndex])

  useEffect(() => {
    registerMarker(group.key, markerRef.current)
    return () => registerMarker(group.key, null)
  }, [group.key, registerMarker])

  const withinRadius = !highlightedEventIds || highlightedEventIds.has(event.id)
  const opacity = withinRadius ? 0.85 : OUTSIDE_RADIUS_OPACITY
  const highlighted = !!highlightedEventIds && withinRadius
  const dateColor = dateColorByKey?.get(sfDateKey(event.start)) ?? null

  function stepIndex(delta: number) {
    setIndex((i) => ((i < count ? i : count - 1) + delta + count) % count)
  }

  function cancelClose() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function scheduleClose() {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => markerRef.current?.closePopup(), POPUP_CLOSE_DELAY)
  }

  function openPopup() {
    cancelClose()
    hoveredRef.current = true
    markerRef.current?.openPopup()
  }

  function handleMouseOut() {
    hoveredRef.current = false
    scheduleClose()
  }

  return (
    <Marker
      ref={markerRef}
      position={[group.lat, group.lng]}
      icon={icon}
      opacity={opacity}
      eventHandlers={{
        mouseover: openPopup,
        mouseout: handleMouseOut,
        // Leaflet's own marker click handler toggles the popup, which would
        // close it right back up if the cursor already opened it via hover —
        // reopen in that case so click always shows it, same as hover.
        popupclose: () => {
          if (hoveredRef.current) markerRef.current?.openPopup()
        },
        // Keeps the popup open while the cursor travels from the marker up
        // into the popup content itself (e.g. to click the calendar link).
        popupopen: (e) => {
          const el = e.popup.getElement()
          el?.addEventListener('mouseenter', cancelClose)
          el?.addEventListener('mouseleave', scheduleClose)
        },
      }}
    >
      <Tooltip
        key={`${placement.direction}-${placement.hidden}`}
        permanent
        interactive
        direction={placement.direction}
        offset={labelOffset(placement.direction)}
        opacity={1}
        className={`std-map-marker-label${placement.hidden ? ' std-map-marker-label-hidden' : ''}`}
        eventHandlers={{ click: openPopup, mouseover: openPopup, mouseout: handleMouseOut }}
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
        <EventPopupContent event={event} />
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

  // Only worth color-coding by day once more than one day is actually on
  // screen — a single-day view has nothing to distinguish.
  const dateColorByKey = useMemo(() => {
    const keys = Array.from(new Set(events.map((event) => sfDateKey(event.start)))).sort()
    if (keys.length <= 1) return null
    return new Map(keys.map((key, i) => [key, PASTEL_DATE_COLORS[i % PASTEL_DATE_COLORS.length]]))
  }, [events])

  const markerRegistry = useRef(new Map<string, L.Marker>()).current
  const registerMarker = useCallback(
    (key: string, marker: L.Marker | null) => {
      if (marker) markerRegistry.set(key, marker)
      else markerRegistry.delete(key)
    },
    [markerRegistry]
  )
  const [labelPlacements, setLabelPlacements] = useState<Map<string, LabelPlacement>>(new Map())

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
          placement={labelPlacements.get(group.key) ?? DEFAULT_LABEL_PLACEMENT}
          registerMarker={registerMarker}
        />
      ))}

      <LabelPlacer groups={groups} markerRegistry={markerRegistry} onChange={setLabelPlacements} />
      <TouchGate />
    </MapContainer>
  )
}
