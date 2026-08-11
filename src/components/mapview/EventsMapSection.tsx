'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import EventsList from './EventsList'
import CalendarLegendControl from './CalendarLegendControl'
import { MAP_CALENDAR_LEGEND, RADIUS_HIGHLIGHT_FILL_COLOR } from '@/lib/mapCalendarLegend'
import type { MapCalendarKey } from '@/lib/calendarIds'
import type { ApiEvent, EventsResponse, UnknownLocationEvent } from '@/lib/mapTypes'
import {
  haversineMiles,
  radiusMiles as computeRadiusMiles,
  TRANSPORT_SPEEDS_MPH,
  type TransportMode,
} from '@/lib/geo'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="std-map-container std-map-loading">Loading map…</div>,
})

// On desktop the map is allowed to grow wider than the article's text
// column, up to this cap, using whatever room is actually free to its right
// (which varies with the table-of-contents sidebar at the lg breakpoint).
const MAP_MAX_WIDTH = 1000
const MAP_MIN_WIDTH = 624 // the article column's natural content width
const MAP_RIGHT_GUTTER = 24 // matches the page's own side padding

function useMapBreakoutWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    function update() {
      const el = ref.current
      if (!el) return
      if (window.innerWidth < 768) {
        setWidth(undefined)
        return
      }
      const left = el.getBoundingClientRect().left
      const available = window.innerWidth - left - MAP_RIGHT_GUTTER
      setWidth(Math.min(MAP_MAX_WIDTH, Math.max(available, MAP_MIN_WIDTH)))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return { ref, width }
}

const ALL_SOURCE_KEYS = Object.keys(MAP_CALENDAR_LEGEND) as MapCalendarKey[]
const TRANSPORT_MODES = Object.keys(TRANSPORT_SPEEDS_MPH) as TransportMode[]
const STORAGE_KEY = 'std_map_filters'
const STORAGE_VERSION = 5

// Default "+location" anchor and its known coordinates, so the location
// clause can activate instantly on open without a geocode round-trip.
const DEFAULT_LOCATION_TEXT = 'San Francisco City Hall'
const DEFAULT_LOCATION_COORDS = { lat: 37.7793, lng: -122.4193 }

type LastGeocode = { text: string; lat: number; lng: number }

type PersistedMapFilters = {
  version: typeof STORAGE_VERSION
  locationText: string
  transportMode: TransportMode
  minutes: number
  selectedTypes: MapCalendarKey[]
  lastGeocode: LastGeocode | null
  radiusEnabled: boolean
  keywordsEnabled: boolean
  keywordsText: string
}

function transportLabel(mode: TransportMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

// Events are San Francisco events, so "today" and date filtering are always
// computed in SF's timezone regardless of the viewer's own location.
function sfDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// Pure calendar-date arithmetic on a "YYYY-MM-DD" key — deliberately not
// routed through a real SF-timezone Date so DST transitions can't shift it.
function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// The Saturday/Sunday of the current or coming weekend. If today is Sunday,
// the weekend is just today — Saturday has already passed.
function weekendRange(todayKey: string): { from: string; to: string } {
  const [y, m, d] = todayKey.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (dow === 0) return { from: todayKey, to: todayKey }
  const from = addDays(todayKey, dow === 6 ? 0 : 6 - dow)
  return { from, to: addDays(from, 1) }
}

// Tap-to-cycle minutes control: 20 -> 30 -> 40 -> 50 -> 60 -> 10 -> 20 ...
const MINUTES_CYCLE = [20, 30, 40, 50, 60, 10]

type DatePreset = 'today' | 'tomorrow' | 'weekend' | 'next3' | 'next7' | 'all' | 'custom'

const DATE_PRESET_ORDER: DatePreset[] = ['today', 'tomorrow', 'next3', 'next7', 'weekend', 'all', 'custom']

export default function EventsMapSection() {
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [unknownLocationEvents, setUnknownLocationEvents] = useState<UnknownLocationEvent[]>([])
  const [loadError, setLoadError] = useState(false)

  const [selectedTypes, setSelectedTypes] = useState<Set<MapCalendarKey>>(() => new Set(ALL_SOURCE_KEYS))
  const [locationText, setLocationText] = useState(DEFAULT_LOCATION_TEXT)
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationDraft, setLocationDraft] = useState('')
  const [transportMode, setTransportMode] = useState<TransportMode>('walk')
  const [minutes, setMinutes] = useState(20)
  const [dateFrom, setDateFrom] = useState(() => sfDateKey(new Date()))
  const [dateTo, setDateTo] = useState(() => sfDateKey(new Date()))
  const [allDates, setAllDates] = useState(false)
  const [customDateMode, setCustomDateMode] = useState(false)
  const [radiusEnabled, setRadiusEnabled] = useState(false)
  const [keywordsEnabled, setKeywordsEnabled] = useState(false)
  const [keywordsText, setKeywordsText] = useState('')
  const [editingKeywords, setEditingKeywords] = useState(false)
  const [keywordsDraft, setKeywordsDraft] = useState('')
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [lastGeocode, setLastGeocode] = useState<LastGeocode | null>(null)
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const hydratedRef = useRef(false)
  const [hydrated, setHydrated] = useState(false)
  const { ref: mapWrapRef, width: mapWidth } = useMapBreakoutWidth()

  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data: EventsResponse) => {
        // Defensive against a stale edge-cached response from a previous
        // deploy whose shape doesn't match this build's expectations.
        if (Array.isArray(data?.events)) setEvents(data.events)
        if (Array.isArray(data?.unknownLocationEvents)) setUnknownLocationEvents(data.unknownLocationEvents)
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: PersistedMapFilters = JSON.parse(raw)
        if (parsed && parsed.version === STORAGE_VERSION) {
          const text = parsed.locationText || DEFAULT_LOCATION_TEXT
          setLocationText(text)
          setTransportMode(TRANSPORT_MODES.includes(parsed.transportMode) ? parsed.transportMode : 'walk')
          setMinutes(MINUTES_CYCLE.includes(parsed.minutes) ? parsed.minutes : 20)
          if (Array.isArray(parsed.selectedTypes)) {
            const validTypes = parsed.selectedTypes.filter((key) => ALL_SOURCE_KEYS.includes(key))
            setSelectedTypes(new Set(validTypes))
          }
          if (parsed.lastGeocode) {
            setLastGeocode(parsed.lastGeocode)
            if (parsed.lastGeocode.text === text) {
              setSearchOrigin({ lat: parsed.lastGeocode.lat, lng: parsed.lastGeocode.lng })
            }
          }
          if (parsed.radiusEnabled) setRadiusEnabled(true)
          if (parsed.keywordsEnabled && parsed.keywordsText) {
            setKeywordsEnabled(true)
            setKeywordsText(parsed.keywordsText)
          }
        }
      }
    } catch {
      // ignore malformed/unavailable localStorage
    }
    hydratedRef.current = true
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const timeout = setTimeout(() => {
      const payload: PersistedMapFilters = {
        version: STORAGE_VERSION,
        locationText,
        transportMode,
        minutes,
        selectedTypes: Array.from(selectedTypes),
        lastGeocode,
        radiusEnabled,
        keywordsEnabled,
        keywordsText,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // ignore quota/availability errors
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [
    hydrated,
    locationText,
    transportMode,
    minutes,
    selectedTypes,
    lastGeocode,
    radiusEnabled,
    keywordsEnabled,
    keywordsText,
  ])

  function toggleCalendarType(key: MapCalendarKey) {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function cycleTransportMode() {
    const next = TRANSPORT_MODES[(TRANSPORT_MODES.indexOf(transportMode) + 1) % TRANSPORT_MODES.length]
    setTransportMode(next)
  }

  function cycleMinutes() {
    setMinutes((m) => {
      const idx = MINUTES_CYCLE.indexOf(m)
      return MINUTES_CYCLE[(idx + 1) % MINUTES_CYCLE.length]
    })
  }

  function applyDatePreset(preset: DatePreset) {
    setCustomDateMode(preset === 'custom')
    if (preset === 'custom') {
      setAllDates(false)
      return
    }
    if (preset === 'all') {
      setAllDates(true)
      return
    }
    setAllDates(false)
    const today = sfDateKey(new Date())
    if (preset === 'weekend') {
      const { from, to } = weekendRange(today)
      setDateFrom(from)
      setDateTo(to)
      return
    }
    if (preset === 'tomorrow') {
      const tomorrow = addDays(today, 1)
      setDateFrom(tomorrow)
      setDateTo(tomorrow)
      return
    }
    setDateFrom(today)
    setDateTo(preset === 'today' ? today : preset === 'next3' ? addDays(today, 3) : addDays(today, 7))
  }

  function cycleDatePreset() {
    const currentIndex = DATE_PRESET_ORDER.indexOf(activeDatePreset)
    const next = DATE_PRESET_ORDER[(currentIndex + 1) % DATE_PRESET_ORDER.length]
    applyDatePreset(next)
  }

  const activeDatePreset: DatePreset = useMemo(() => {
    if (customDateMode) return 'custom'
    if (allDates) return 'all'
    const today = sfDateKey(new Date())
    if (dateFrom === today && dateTo === today) return 'today'
    const tomorrow = addDays(today, 1)
    if (dateFrom === tomorrow && dateTo === tomorrow) return 'tomorrow'
    if (dateFrom === today) {
      if (dateTo === addDays(today, 3)) return 'next3'
      if (dateTo === addDays(today, 7)) return 'next7'
    }
    const weekend = weekendRange(today)
    if (dateFrom === weekend.from && dateTo === weekend.to) return 'weekend'
    return 'custom'
  }, [customDateMode, allDates, dateFrom, dateTo])

  const dateSentence = useMemo(() => {
    if (allDates) return 'any day'
    if (activeDatePreset === 'today') return 'today'
    if (activeDatePreset === 'tomorrow') return 'tomorrow'
    if (activeDatePreset === 'next3') return 'in the next 3 days'
    if (activeDatePreset === 'weekend') return 'this weekend'
    if (activeDatePreset === 'next7') return 'in the next 7 days'
    return dateFrom === dateTo ? `on ${dateFrom}` : `from ${dateFrom} to ${dateTo}`
  }, [allDates, activeDatePreset, dateFrom, dateTo])

  // Resolves a location's coordinates, preferring an already-known geocode
  // (the cached last search, or the hardcoded default) over an API call.
  async function resolveLocation(text: string) {
    if (lastGeocode && lastGeocode.text === text) {
      setSearchOrigin({ lat: lastGeocode.lat, lng: lastGeocode.lng })
      return
    }
    if (text === DEFAULT_LOCATION_TEXT) {
      setSearchOrigin(DEFAULT_LOCATION_COORDS)
      setLastGeocode({ text: DEFAULT_LOCATION_TEXT, ...DEFAULT_LOCATION_COORDS })
      return
    }
    setGeocodeStatus('loading')
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(text)}`)
      const data = await res.json()
      if (data.ok) {
        setSearchOrigin({ lat: data.lat, lng: data.lng })
        setLastGeocode({ text, lat: data.lat, lng: data.lng })
        setGeocodeStatus('idle')
      } else {
        setGeocodeStatus('error')
        setSearchOrigin(null)
      }
    } catch {
      setGeocodeStatus('error')
    }
  }

  function enableLocation() {
    setRadiusEnabled(true)
    if (!searchOrigin) resolveLocation(locationText.trim() || DEFAULT_LOCATION_TEXT)
  }

  function disableLocation() {
    setRadiusEnabled(false)
    setEditingLocation(false)
  }

  function startEditingLocation() {
    setLocationDraft(locationText)
    setEditingLocation(true)
  }

  function commitLocationEdit() {
    setEditingLocation(false)
    const text = locationDraft.trim() || DEFAULT_LOCATION_TEXT
    setLocationText(text)
    setGeocodeStatus('idle')
    resolveLocation(text)
  }

  function enableKeywords() {
    setKeywordsEnabled(true)
    setKeywordsDraft(keywordsText)
    setEditingKeywords(true)
  }

  function disableKeywords() {
    setKeywordsEnabled(false)
    setEditingKeywords(false)
  }

  function startEditingKeywords() {
    setKeywordsDraft(keywordsText)
    setEditingKeywords(true)
  }

  function commitKeywordsEdit() {
    setEditingKeywords(false)
    const text = keywordsDraft.trim()
    setKeywordsText(text)
    // An empty phrase matches everything, which isn't a useful filter.
    if (!text) setKeywordsEnabled(false)
  }

  // Gated on radiusEnabled (rather than clearing searchOrigin outright) so
  // the last-searched location stays cached for instant reuse on reopen.
  const activeSearchOrigin = radiusEnabled ? searchOrigin : null
  const activeRadiusMiles = activeSearchOrigin ? computeRadiusMiles(transportMode, minutes) : null

  // Case-insensitive substring match against title/description — the "where
  // event contains" clause. Null (rather than empty string) when the filter
  // is off, so callers can skip the check entirely.
  const activeKeywords = keywordsEnabled && keywordsText ? keywordsText.toLowerCase() : null

  // Counts events matching the current date/keyword filters per calendar,
  // independent of which calendars are checked, so the legend shows what's
  // available for a source even while it's unchecked.
  const eventCountsByCalendar = useMemo(() => {
    const counts = Object.fromEntries(ALL_SOURCE_KEYS.map((key) => [key, 0])) as Record<MapCalendarKey, number>
    for (const event of events ?? []) {
      if (!allDates) {
        const eventDateKey = sfDateKey(new Date(event.start))
        if (eventDateKey < dateFrom || eventDateKey > dateTo) continue
      }
      if (
        activeKeywords &&
        !event.title.toLowerCase().includes(activeKeywords) &&
        !(event.description ?? '').toLowerCase().includes(activeKeywords)
      ) {
        continue
      }
      counts[event.calendar] = (counts[event.calendar] ?? 0) + 1
    }
    return counts
  }, [events, allDates, dateFrom, dateTo, activeKeywords])

  const visibleEvents = useMemo(() => {
    return (events ?? []).filter((event) => {
      if (!selectedTypes.has(event.calendar)) return false
      if (!allDates) {
        const eventDateKey = sfDateKey(new Date(event.start))
        if (eventDateKey < dateFrom || eventDateKey > dateTo) return false
      }
      if (
        activeKeywords &&
        !event.title.toLowerCase().includes(activeKeywords) &&
        !(event.description ?? '').toLowerCase().includes(activeKeywords)
      ) {
        return false
      }
      // Events outside the travel radius stay visible (dimmed in LeafletMap)
      // rather than being dropped — the radius is a highlight, not a filter.
      return true
    })
  }, [events, selectedTypes, allDates, dateFrom, dateTo, activeKeywords])

  // Same calendar/date/keyword filters as visibleEvents, applied to events
  // whose location couldn't be placed on the map at all.
  const visibleUnknownLocationEvents = useMemo(() => {
    return unknownLocationEvents.filter((event) => {
      if (!selectedTypes.has(event.calendar)) return false
      if (!allDates) {
        const eventDateKey = sfDateKey(new Date(event.start))
        if (eventDateKey < dateFrom || eventDateKey > dateTo) return false
      }
      if (
        activeKeywords &&
        !event.title.toLowerCase().includes(activeKeywords) &&
        !(event.description ?? '').toLowerCase().includes(activeKeywords)
      ) {
        return false
      }
      return true
    })
  }, [unknownLocationEvents, selectedTypes, allDates, dateFrom, dateTo, activeKeywords])

  // Events within the active travel radius — highlighted on the map and
  // pinned to the top of the list below. Null (not an empty set) when the
  // radius filter isn't active, so map/list rendering can tell "no radius"
  // apart from "radius active but nothing's in range".
  const highlightedEventIds = useMemo(() => {
    if (!activeSearchOrigin || activeRadiusMiles === null) return null
    const ids = new Set<string>()
    for (const event of visibleEvents) {
      if (haversineMiles(activeSearchOrigin, { lat: event.lat, lng: event.lng }) <= activeRadiusMiles) {
        ids.add(event.id)
      }
    }
    return ids
  }, [visibleEvents, activeSearchOrigin, activeRadiusMiles])

  return (
    <section className="std-map-section">
      <div className="std-map-sentence">
        <span>Find me </span>
        <CalendarLegendControl
          calendarKeys={ALL_SOURCE_KEYS}
          selectedTypes={selectedTypes}
          eventCounts={eventCountsByCalendar}
          onToggle={toggleCalendarType}
          onSelectAll={() => setSelectedTypes(new Set(ALL_SOURCE_KEYS))}
          onClear={() => setSelectedTypes(new Set())}
          toggleClassName="std-map-sentence-toggle"
        />
        <span>events for </span>
        <button type="button" className="std-map-sentence-toggle" onClick={cycleDatePreset}>
          {dateSentence}
        </button>

        {radiusEnabled ? (
          <>
            <span>within </span>
            <button type="button" className="std-map-sentence-toggle" onClick={cycleMinutes}>
              {minutes} min
            </button>
            <span>of </span>
            {editingLocation ? (
              <input
                type="text"
                className="std-map-input std-map-sentence-input"
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                onBlur={commitLocationEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setEditingLocation(false)
                }}
                autoFocus
              />
            ) : (
              <button type="button" className="std-map-sentence-toggle" onClick={startEditingLocation}>
                {locationText}
              </button>
            )}
            <span>by </span>
            <button type="button" className="std-map-sentence-toggle" onClick={cycleTransportMode}>
              {transportLabel(transportMode)}
            </button>
            <button
              type="button"
              className="std-map-sentence-remove"
              onClick={disableLocation}
              aria-label="Remove location filter"
            >
              ×
            </button>
          </>
        ) : (
          <button type="button" className="std-map-sentence-toggle" onClick={enableLocation}>
            +location
          </button>
        )}

        {keywordsEnabled ? (
          <>
            <span>where event contains </span>
            {editingKeywords ? (
              <input
                type="text"
                className="std-map-input std-map-sentence-input"
                value={keywordsDraft}
                onChange={(e) => setKeywordsDraft(e.target.value)}
                onBlur={commitKeywordsEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setEditingKeywords(false)
                }}
                autoFocus
              />
            ) : (
              <button type="button" className="std-map-sentence-toggle" onClick={startEditingKeywords}>
                &lsquo;{keywordsText}&rsquo;
              </button>
            )}
            <button
              type="button"
              className="std-map-sentence-remove"
              onClick={disableKeywords}
              aria-label="Remove keyword filter"
            >
              ×
            </button>
          </>
        ) : (
          <button type="button" className="std-map-sentence-toggle" onClick={enableKeywords}>
            +keywords
          </button>
        )}
      </div>

      {activeDatePreset === 'custom' && (
        <div className="std-map-filter-row">
          <input
            type="date"
            className="std-map-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-sm text-stone-500">to</span>
          <input
            type="date"
            className="std-map-input"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      )}

      {geocodeStatus === 'error' && (
        <p className="std-map-empty">Couldn&apos;t find that location — showing all events instead.</p>
      )}

      <p className="std-map-count">
        {loadError ? (
          "Couldn't load events right now — try again shortly."
        ) : (
          <>
            {`${visibleEvents.length} event${visibleEvents.length === 1 ? '' : 's'} found`}
            {highlightedEventIds && (
              <span className="std-map-count-badge" style={{ backgroundColor: RADIUS_HIGHLIGHT_FILL_COLOR }}>
                {`${highlightedEventIds.size} within region`}
              </span>
            )}
          </>
        )}
      </p>

      <div ref={mapWrapRef} style={mapWidth ? { width: mapWidth, maxWidth: 'none' } : undefined}>
        <LeafletMap
          events={visibleEvents}
          searchOrigin={activeSearchOrigin}
          radiusMiles={activeRadiusMiles}
          highlightedEventIds={highlightedEventIds}
          calendarKeys={ALL_SOURCE_KEYS}
          selectedTypes={selectedTypes}
          eventCounts={eventCountsByCalendar}
          onToggleCalendar={toggleCalendarType}
          onSelectAllCalendars={() => setSelectedTypes(new Set(ALL_SOURCE_KEYS))}
          onClearCalendars={() => setSelectedTypes(new Set())}
        />
      </div>

      {visibleEvents.length > 0 && (
        <EventsList events={visibleEvents} highlightedEventIds={highlightedEventIds} />
      )}

      {visibleUnknownLocationEvents.length > 0 && (
        <>
          <h3 className="std-map-unknown-location-heading">Events with unknown locations</h3>
          <EventsList events={visibleUnknownLocationEvents} />
        </>
      )}
    </section>
  )
}
