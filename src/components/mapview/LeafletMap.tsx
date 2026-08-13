'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Tooltip, useMap } from 'react-leaflet'
import type { ApiEvent } from '@/lib/mapTypes'
import type { MapCalendarKey } from '@/lib/calendarIds'
import { MAP_CALENDAR_LEGEND, RADIUS_HIGHLIGHT_COLOR, RADIUS_HIGHLIGHT_FILL_COLOR } from '@/lib/mapCalendarLegend'
import { isEventEnded, relativeTimeLabel, sfDateKey, shortEventDateParts } from '@/lib/mapEventFormat'
import MapEventSidebar from './MapEventSidebar'

const SF_CENTER: [number, number] = [37.7749, -122.4194]
const MILES_TO_METERS = 1609.34
const OUTSIDE_RADIUS_OPACITY = 0.25
const MARKER_LABEL_MAX_CHARS = 30
type ZoomBucket = 'sm' | 'md' | 'lg'
const MARKER_SIZE = 28

// Distinct pastel backgrounds for the weekday badge on marker labels, so
// events on different days are visually distinguishable at a glance. Only
// assigned when more than one date is present among the visible events —
// a single-day view has nothing to distinguish, so the badge stays neutral.
const DAY_BADGE_COLORS = ['#fde68a', '#bfdbfe', '#bbf7d0', '#fbcfe8', '#ddd6fe', '#fed7aa', '#a5f3fc', '#fecaca']

function buildDayColorMap(events: ApiEvent[]): Map<string, string> {
  const keys = Array.from(new Set(events.map((e) => sfDateKey(e.start)))).sort()
  const map = new Map<string, string>()
  if (keys.length <= 1) return map
  keys.forEach((key, i) => map.set(key, DAY_BADGE_COLORS[i % DAY_BADGE_COLORS.length]))
  return map
}

// Remembers the visitor's last map position/zoom across reloads, so they
// don't have to re-navigate to where they left off every visit.
const VIEW_STORAGE_KEY = 'std_map_view'
type SavedView = { lat: number; lng: number; zoom: number }

function loadSavedView(): SavedView | null {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number' && typeof parsed?.zoom === 'number') {
      return parsed
    }
  } catch {
    // ignore malformed/unavailable localStorage
  }
  return null
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

function truncateTitle(title: string, maxChars: number): string {
  const trimmed = title.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars)}...`
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

// Fits the view to the radius circle (with a comfortable margin) rather than
// jumping to a fixed zoom, so "limit by travel radius" always shows exactly
// the area that's in range — whether that's a 10-minute walk or an hour's
// drive. Falls back to a plain recenter when there's no radius to fit yet.
const RADIUS_FIT_PADDING: [number, number] = [40, 40]

function RecenterOnOrigin({
  origin,
  radiusMiles,
}: {
  origin: { lat: number; lng: number } | null
  radiusMiles: number | null
}) {
  const map = useMap()
  useEffect(() => {
    if (!origin) return
    if (radiusMiles !== null && radiusMiles > 0) {
      // toBounds() computes the box from lat/lng math alone, unlike
      // Circle.getBounds() which needs the circle to already be attached to
      // a map (it projects through the map's pixel origin) and throws otherwise.
      const bounds = L.latLng(origin.lat, origin.lng).toBounds(radiusMiles * MILES_TO_METERS * 2)
      map.fitBounds(bounds, { padding: RADIUS_FIT_PADDING })
    } else {
      map.setView([origin.lat, origin.lng], 13)
    }
  }, [origin, radiusMiles, map])
  return null
}

// Events below this count don't get a fit-to-bounds default view — a
// couple of markers zoomed tight to fit is more disorienting than useful,
// so those cases just keep the standard SF-wide view.
const MIN_EVENTS_FOR_FIT = 3
const EVENTS_FIT_PADDING: [number, number] = [40, 40]
const EVENTS_FIT_MAX_ZOOM = 15

// Establishes the map's starting position exactly once per mount: the
// visitor's saved view takes priority (so reloads land where they left
// off), otherwise the view fits all currently-visible events so the
// default isn't zoomed out further than the events actually need. Origin-
// driven centering (RecenterOnOrigin) always wins over both when active.
function InitialViewSetter({
  events,
  savedView,
  hasOrigin,
}: {
  events: ApiEvent[]
  savedView: SavedView | null
  hasOrigin: boolean
}) {
  const map = useMap()
  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current || hasOrigin) return
    didInit.current = true
    if (savedView) {
      map.setView([savedView.lat, savedView.lng], savedView.zoom)
      return
    }
    if (events.length > MIN_EVENTS_FOR_FIT) {
      const bounds = L.latLngBounds(events.map((e): [number, number] => [e.lat, e.lng]))
      map.fitBounds(bounds, { padding: EVENTS_FIT_PADDING, maxZoom: EVENTS_FIT_MAX_ZOOM })
    }
  }, [map, events, savedView, hasOrigin])
  return null
}

// Persists the visitor's current view on every pan/zoom so it can be
// restored by InitialViewSetter on the next visit.
function MapViewPersistence() {
  const map = useMap()
  useEffect(() => {
    function save() {
      const center = map.getCenter()
      try {
        localStorage.setItem(
          VIEW_STORAGE_KEY,
          JSON.stringify({ lat: center.lat, lng: center.lng, zoom: map.getZoom() })
        )
      } catch {
        // ignore quota/availability errors
      }
    }
    map.on('moveend zoomend', save)
    return () => {
      map.off('moveend zoomend', save)
    }
  }, [map])
  return null
}

// Hands the underlying Leaflet map instance up to the parent once, so
// page-level chrome (the right-side zoom buttons) can drive it without the
// default top-left Leaflet zoom control, which used to collide with the
// filters toggle in the same corner.
function MapReadyNotifier({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
  }, [map, onReady])
  return null
}

// Tracks the map's current zoom level (bucketed) so markers/labels can use a
// bit more of the available screen space once the user has zoomed in.
function ZoomBucketWatcher({ onChange }: { onChange: (zoom: number) => void }) {
  const map = useMap()
  useEffect(() => {
    function update() {
      onChange(map.getZoom())
    }
    update()
    map.on('zoomend', update)
    return () => {
      map.off('zoomend', update)
    }
  }, [map, onChange])
  return null
}

// Leaflet caches the container's pixel size at init, but the map now always
// renders inside a flex layout whose final height isn't necessarily settled
// on the first paint — so tiles can come in misaligned until re-measured.
function MapResizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), 50)
    function onResize() {
      map.invalidateSize()
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', onResize)
    }
  }, [map])
  return null
}

// Marker "permanent" tooltip labels always sit below their dot. Dense
// clusters can make that overlap, so LabelPlacer re-checks each label after
// Leaflet lays them out and hides any that collide with an already-placed
// label — since Leaflet has no built-in collision detection for tooltips.
type LabelPlacement = { hidden: boolean }
const DEFAULT_LABEL_PLACEMENT: LabelPlacement = { hidden: false }
const LABEL_GAP = MARKER_SIZE / 2 + 1
const LABEL_OFFSET: [number, number] = [0, LABEL_GAP]

function labelCandidateRect(anchor: { x: number; y: number }, width: number, height: number) {
  return {
    left: anchor.x - width / 2,
    top: anchor.y + LABEL_GAP,
    right: anchor.x + width / 2,
    bottom: anchor.y + LABEL_GAP + height,
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

        const rect = labelCandidateRect(anchor, width, height)
        const overlaps = placed.some(
          (p) => rect.left < p.right && rect.right > p.left && rect.top < p.bottom && rect.bottom > p.top
        )
        if (!overlaps) placed.push(rect)
        next.set(group.key, { hidden: overlaps })
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

function EventMarkerGroup({
  group,
  highlightedEventIds,
  placement,
  dayColors,
  registerMarker,
  onSelect,
}: {
  group: EventGroup
  highlightedEventIds: Set<string> | null
  placement: LabelPlacement
  dayColors: Map<string, string>
  registerMarker: (key: string, marker: L.Marker | null) => void
  onSelect: (groupKey: string) => void
}) {
  const markerRef = useRef<L.Marker>(null)
  const count = group.events.length
  const event = group.events[0]

  const icon = useMemo(
    () => (count > 1 ? buildMarkerIcon(event.calendar, count) : MARKER_ICONS[event.calendar]),
    [event.calendar, count]
  )

  useEffect(() => {
    registerMarker(group.key, markerRef.current)
    return () => registerMarker(group.key, null)
  }, [group.key, registerMarker])

  const withinRadius = !highlightedEventIds || group.events.some((e) => highlightedEventIds.has(e.id))
  const opacity = withinRadius ? 0.85 : OUTSIDE_RADIUS_OPACITY
  // Ended styling takes priority over the "within region" bolding — a past
  // event reads as inactive regardless of where it was.
  const ended = isEventEnded(event.end)
  const highlighted = !!highlightedEventIds && withinRadius && !ended

  const { weekday, time } = shortEventDateParts(event.start)
  const dayColor = dayColors.get(sfDateKey(event.start))
  const isToday = sfDateKey(event.start) === sfDateKey(new Date().toISOString())
  const relative = isToday ? relativeTimeLabel(event.start, event.end) : null

  const onLabelClick = () => onSelect(group.key)

  return (
    <Marker
      ref={markerRef}
      position={[group.lat, group.lng]}
      icon={icon}
      opacity={opacity}
      eventHandlers={{
        click: onLabelClick,
      }}
    >
      <Tooltip
        permanent
        interactive
        direction="bottom"
        offset={LABEL_OFFSET}
        opacity={1}
        eventHandlers={{
          click: onLabelClick,
        }}
        className={`std-map-marker-label${placement.hidden ? ' std-map-marker-label-hidden' : ''}${ended ? ' std-map-marker-label-ended' : ''}`}
      >
        <span
          className={`std-map-marker-label-title${highlighted ? ' font-bold' : ''}${ended ? ' std-map-marker-label-title-ended' : ''}`}
        >
          {truncateTitle(event.title, MARKER_LABEL_MAX_CHARS)}
        </span>
        <span className="std-map-marker-label-datetime">
          <span
            className="std-map-marker-label-day"
            style={dayColor ? { backgroundColor: dayColor } : undefined}
          >
            {weekday}
          </span>
          <span className="std-map-marker-label-time">{time}</span>
          {relative && (
            <span
              className={`std-map-marker-label-relative${relative === 'now' ? ' std-map-marker-label-relative-now' : ''}`}
            >
              {relative}
            </span>
          )}
        </span>
      </Tooltip>
    </Marker>
  )
}

export default function LeafletMap({
  events,
  searchOrigin,
  radiusMiles,
  highlightedEventIds,
  onMapReady,
}: {
  events: ApiEvent[]
  searchOrigin: { lat: number; lng: number } | null
  radiusMiles: number | null
  // Events within the travel radius — non-null only while the radius filter
  // is active. Drives marker dimming/bolding to match the event list below.
  highlightedEventIds: Set<string> | null
  // Reports the Leaflet map instance up once it's mounted, so the page's
  // own right-side zoom buttons can call zoomIn()/zoomOut() on it.
  onMapReady?: (map: L.Map) => void
}) {
  const [zoom, setZoom] = useState(12)
  const zoomBucket: ZoomBucket = zoom >= 16 ? 'lg' : zoom >= 14 ? 'md' : 'sm'
  const groups = useMemo(() => groupEventsByLocation(events), [events])
  const dayColors = useMemo(() => buildDayColorMap(events), [events])
  // Read once at mount — InitialViewSetter only ever needs this on its first
  // run, and the saved view is re-captured on every subsequent pan/zoom.
  const savedView = useRef(loadSavedView()).current

  const markerRegistry = useRef(new Map<string, L.Marker>()).current
  const registerMarker = useCallback(
    (key: string, marker: L.Marker | null) => {
      if (marker) markerRegistry.set(key, marker)
      else markerRegistry.delete(key)
    },
    [markerRegistry]
  )
  const [labelPlacements, setLabelPlacements] = useState<Map<string, LabelPlacement>>(new Map())

  // The click-triggered sidebar's target — a marker group plus which of its
  // (possibly several) co-located events is showing.
  const [selected, setSelected] = useState<{ groupKey: string; index: number } | null>(null)
  const selectedGroup = selected ? (groups.find((g) => g.key === selected.groupKey) ?? null) : null

  // Filtering the map out from under an open sidebar (e.g. narrowing the
  // date range) shouldn't leave it pointed at a marker that's no longer shown.
  useEffect(() => {
    if (selected && !selectedGroup) setSelected(null)
  }, [selected, selectedGroup])

  const selectGroup = useCallback((groupKey: string) => setSelected({ groupKey, index: 0 }), [])

  return (
    <div className={`std-map-outer std-map-zoom-${zoomBucket}`}>
      <MapContainer
        center={SF_CENTER}
        zoom={12}
        scrollWheelZoom
        zoomControl={false}
        className="std-map-container"
      >
        {onMapReady && <MapReadyNotifier onReady={onMapReady} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        <RecenterOnOrigin origin={searchOrigin} radiusMiles={radiusMiles} />
        <InitialViewSetter events={events} savedView={savedView} hasOrigin={!!searchOrigin} />
        <MapViewPersistence />

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
                  fillColor: RADIUS_HIGHLIGHT_FILL_COLOR,
                  fillOpacity: 0.5,
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
            placement={labelPlacements.get(group.key) ?? DEFAULT_LABEL_PLACEMENT}
            dayColors={dayColors}
            registerMarker={registerMarker}
            onSelect={selectGroup}
          />
        ))}

        <LabelPlacer groups={groups} markerRegistry={markerRegistry} onChange={setLabelPlacements} />
        <MapResizeWatcher />
        <ZoomBucketWatcher onChange={setZoom} />
      </MapContainer>

      {selectedGroup && (
        <MapEventSidebar
          events={selectedGroup.events}
          index={selected!.index}
          onIndexChange={(index) => setSelected({ groupKey: selectedGroup.key, index })}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
