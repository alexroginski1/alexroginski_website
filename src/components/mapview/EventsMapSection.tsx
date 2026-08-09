'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import EventsList from './EventsList'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'
import type { MapCalendarKey } from '@/lib/calendarIds'
import type { ApiEvent, EventsResponse, UnknownLocationEvent } from '@/lib/mapTypes'
import {
  haversineMiles,
  radiusMiles as computeRadiusMiles,
  TRANSPORT_SPEEDS_MPH,
  type TransportMode,
} from '@/lib/geo'
import { getVisitorId } from '@/lib/visitorId'

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
const STORAGE_VERSION = 3

type LastGeocode = { text: string; lat: number; lng: number }

type PersistedMapFilters = {
  version: typeof STORAGE_VERSION
  keyword: string
  searchEnabled: boolean
  locationText: string
  transportMode: TransportMode
  minutes: number
  selectedTypes: MapCalendarKey[]
  lastGeocode: LastGeocode | null
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

const MINUTES_STEP = 10
const MINUTES_MIN = 10
const MINUTES_MAX = 180

type DatePreset = 'today' | 'next3' | 'week' | 'all'

export default function EventsMapSection() {
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [unknownLocationEvents, setUnknownLocationEvents] = useState<UnknownLocationEvent[]>([])
  const [loadError, setLoadError] = useState(false)

  const [keyword, setKeyword] = useState('')
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<Set<MapCalendarKey>>(() => new Set(['sf_community']))
  const [locationText, setLocationText] = useState('')
  const [transportMode, setTransportMode] = useState<TransportMode>('walk')
  const [minutes, setMinutes] = useState(20)
  const [dateFrom, setDateFrom] = useState(() => sfDateKey(new Date()))
  const [dateTo, setDateTo] = useState(() => sfDateKey(new Date()))
  const [allDates, setAllDates] = useState(false)
  const [dateExpanded, setDateExpanded] = useState(false)
  const [radiusEnabled, setRadiusEnabled] = useState(false)
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [lastGeocode, setLastGeocode] = useState<LastGeocode | null>(null)
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const [visitorId, setVisitorId] = useState<string | null>(null)
  const [upvoteCounts, setUpvoteCounts] = useState<Record<string, number>>({})
  const [votedEventIds, setVotedEventIds] = useState<Set<string>>(new Set())

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
    const id = getVisitorId()
    setVisitorId(id)
    fetch(`/api/upvotes?visitorId=${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data: { counts?: Record<string, number>; voted?: string[] }) => {
        if (data?.counts) setUpvoteCounts(data.counts)
        if (Array.isArray(data?.voted)) setVotedEventIds(new Set(data.voted))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: PersistedMapFilters = JSON.parse(raw)
        if (parsed && parsed.version === STORAGE_VERSION) {
          setKeyword(parsed.keyword ?? '')
          setSearchEnabled(parsed.searchEnabled ?? false)
          setLocationText(parsed.locationText ?? '')
          setTransportMode(TRANSPORT_MODES.includes(parsed.transportMode) ? parsed.transportMode : 'walk')
          setMinutes(parsed.minutes ?? 20)
          const validTypes = Array.isArray(parsed.selectedTypes)
            ? parsed.selectedTypes.filter((key) => ALL_SOURCE_KEYS.includes(key))
            : []
          if (validTypes.length > 0) {
            setSelectedTypes(new Set(validTypes))
          }
          if (parsed.lastGeocode) {
            setLastGeocode(parsed.lastGeocode)
            if (parsed.lastGeocode.text === parsed.locationText) {
              setSearchOrigin({ lat: parsed.lastGeocode.lat, lng: parsed.lastGeocode.lng })
            }
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
        keyword,
        searchEnabled,
        locationText,
        transportMode,
        minutes,
        selectedTypes: Array.from(selectedTypes),
        lastGeocode,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // ignore quota/availability errors
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [hydrated, keyword, searchEnabled, locationText, transportMode, minutes, selectedTypes, lastGeocode])

  function toggleCalendarType(key: MapCalendarKey) {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleDateFromChange(value: string) {
    setAllDates(false)
    setDateFrom(value)
    setDateTo((prev) => (prev < value ? value : prev))
  }

  function handleDateToChange(value: string) {
    setAllDates(false)
    setDateTo(value)
    setDateFrom((prev) => (prev > value ? value : prev))
  }

  function applyDatePreset(preset: DatePreset) {
    if (preset === 'all') {
      setAllDates(true)
      return
    }
    const today = sfDateKey(new Date())
    setAllDates(false)
    setDateFrom(today)
    setDateTo(preset === 'today' ? today : preset === 'next3' ? addDays(today, 3) : addDays(today, 7))
  }

  const activeDatePreset: DatePreset | null = useMemo(() => {
    if (allDates) return 'all'
    const today = sfDateKey(new Date())
    if (dateFrom !== today) return null
    if (dateTo === today) return 'today'
    if (dateTo === addDays(today, 3)) return 'next3'
    if (dateTo === addDays(today, 7)) return 'week'
    return null
  }, [allDates, dateFrom, dateTo])

  const dateSentence = useMemo(() => {
    if (allDates) return 'any day'
    if (activeDatePreset === 'today') return 'today'
    if (activeDatePreset === 'next3') return 'in the next 3 days'
    if (activeDatePreset === 'week') return 'in the next week'
    return dateFrom === dateTo ? `on ${dateFrom}` : `from ${dateFrom} to ${dateTo}`
  }, [allDates, activeDatePreset, dateFrom, dateTo])

  const allTypesSelected = selectedTypes.size === ALL_SOURCE_KEYS.length

  const eventTypeSentence =
    !allTypesSelected && selectedTypes.size === 1
      ? `${MAP_CALENDAR_LEGEND[[...selectedTypes][0]].label.toLowerCase()} `
      : ''

  async function handleLocationSearch(e: React.FormEvent) {
    e.preventDefault()
    const text = locationText.trim()
    if (!text) {
      setSearchOrigin(null)
      setLastGeocode(null)
      return
    }
    if (lastGeocode && lastGeocode.text === text) {
      setSearchOrigin({ lat: lastGeocode.lat, lng: lastGeocode.lng })
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

  async function toggleUpvote(eventId: string) {
    if (!visitorId) return
    const alreadyVoted = votedEventIds.has(eventId)

    setVotedEventIds((prev) => {
      const next = new Set(prev)
      if (alreadyVoted) next.delete(eventId)
      else next.add(eventId)
      return next
    })
    setUpvoteCounts((prev) => ({ ...prev, [eventId]: (prev[eventId] ?? 0) + (alreadyVoted ? -1 : 1) }))

    try {
      const res = await fetch('/api/upvotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, visitorId }),
      })
      const data: { ok?: boolean; voted?: boolean; count?: number } = await res.json()
      if (!data.ok) throw new Error('upvote failed')
      setUpvoteCounts((prev) => ({ ...prev, [eventId]: data.count ?? 0 }))
      setVotedEventIds((prev) => {
        const next = new Set(prev)
        if (data.voted) next.add(eventId)
        else next.delete(eventId)
        return next
      })
    } catch {
      // revert the optimistic update
      setVotedEventIds((prev) => {
        const next = new Set(prev)
        if (alreadyVoted) next.add(eventId)
        else next.delete(eventId)
        return next
      })
      setUpvoteCounts((prev) => ({ ...prev, [eventId]: (prev[eventId] ?? 0) + (alreadyVoted ? 1 : -1) }))
    }
  }

  const activeRadiusMiles = radiusEnabled && searchOrigin ? computeRadiusMiles(transportMode, minutes) : null

  const activeKeyword = searchEnabled ? keyword.trim().toLowerCase() : ''

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
      if (activeKeyword) {
        const haystack = `${event.title} ${event.description ?? ''}`.toLowerCase()
        if (!haystack.includes(activeKeyword)) continue
      }
      counts[event.calendar] = (counts[event.calendar] ?? 0) + 1
    }
    return counts
  }, [events, allDates, dateFrom, dateTo, activeKeyword])

  const visibleEvents = useMemo(() => {
    return (events ?? []).filter((event) => {
      if (!selectedTypes.has(event.calendar)) return false
      if (!allDates) {
        const eventDateKey = sfDateKey(new Date(event.start))
        if (eventDateKey < dateFrom || eventDateKey > dateTo) return false
      }
      if (activeKeyword) {
        const haystack = `${event.title} ${event.description ?? ''}`.toLowerCase()
        if (!haystack.includes(activeKeyword)) return false
      }
      // Events outside the travel radius stay visible (dimmed in LeafletMap)
      // rather than being dropped — the radius is a highlight, not a filter.
      return true
    })
  }, [events, selectedTypes, activeKeyword, allDates, dateFrom, dateTo])

  // Same calendar/date/keyword filters as visibleEvents, applied to events
  // whose location couldn't be placed on the map at all.
  const visibleUnknownLocationEvents = useMemo(() => {
    return unknownLocationEvents.filter((event) => {
      if (!selectedTypes.has(event.calendar)) return false
      if (!allDates) {
        const eventDateKey = sfDateKey(new Date(event.start))
        if (eventDateKey < dateFrom || eventDateKey > dateTo) return false
      }
      if (activeKeyword) {
        const haystack = `${event.title} ${event.description ?? ''}`.toLowerCase()
        if (!haystack.includes(activeKeyword)) return false
      }
      return true
    })
  }, [unknownLocationEvents, selectedTypes, activeKeyword, allDates, dateFrom, dateTo])

  // Events within the active travel radius — highlighted on the map and
  // pinned to the top of the list below. Null (not an empty set) when the
  // radius filter isn't active, so map/list rendering can tell "no radius"
  // apart from "radius active but nothing's in range".
  const highlightedEventIds = useMemo(() => {
    if (!searchOrigin || activeRadiusMiles === null) return null
    const ids = new Set<string>()
    for (const event of visibleEvents) {
      if (haversineMiles(searchOrigin, { lat: event.lat, lng: event.lng }) <= activeRadiusMiles) {
        ids.add(event.id)
      }
    }
    return ids
  }, [visibleEvents, searchOrigin, activeRadiusMiles])

  return (
    <section className="std-map-section">
      <h2>Stuff To Do Map</h2>

      <div className="std-map-sentence">
        <span>Find me events </span>
        <button
          type="button"
          className="std-map-sentence-toggle"
          onClick={() => setDateExpanded((v) => !v)}
          aria-expanded={dateExpanded}
        >
          {dateSentence}
        </button>
      </div>

      {dateExpanded && (
        <div className="std-map-date-panel">
          <div className="std-map-filter-row">
            <button
              type="button"
              className={`std-map-preset-btn${activeDatePreset === 'today' ? ' std-map-preset-btn-active' : ''}`}
              onClick={() => applyDatePreset('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`std-map-preset-btn${activeDatePreset === 'next3' ? ' std-map-preset-btn-active' : ''}`}
              onClick={() => applyDatePreset('next3')}
            >
              Next 3 days
            </button>
            <button
              type="button"
              className={`std-map-preset-btn${activeDatePreset === 'week' ? ' std-map-preset-btn-active' : ''}`}
              onClick={() => applyDatePreset('week')}
            >
              Next week
            </button>
            <button
              type="button"
              className={`std-map-preset-btn${activeDatePreset === 'all' ? ' std-map-preset-btn-active' : ''}`}
              onClick={() => applyDatePreset('all')}
            >
              All
            </button>
          </div>
          <div className="std-map-filter-row">
            <input
              type="date"
              className="std-map-select"
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              disabled={allDates}
              aria-label="Start date"
            />
            <span className="std-map-empty" style={{ padding: 0 }}>
              to
            </span>
            <input
              type="date"
              className="std-map-select"
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              disabled={allDates}
              aria-label="End date"
            />
          </div>
        </div>
      )}

      <div className="std-map-filter-row">
        <label className="std-map-checkbox-label">
          <input
            type="checkbox"
            checked={searchEnabled}
            onChange={(e) => setSearchEnabled(e.target.checked)}
          />
          search by keyword (optional)
        </label>
      </div>

      {searchEnabled && (
        <div className="std-map-filter-row">
          <input
            type="text"
            className="std-map-input"
            placeholder="Search events by keyword…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoFocus
          />
        </div>
      )}

      <form className="std-map-filters" onSubmit={handleLocationSearch}>
        <div className="std-map-filter-row">
          <label className="std-map-checkbox-label">
            <input
              type="checkbox"
              checked={radiusEnabled}
              onChange={(e) => setRadiusEnabled(e.target.checked)}
            />
            and limit by travel radius (optional)
          </label>
        </div>

        {radiusEnabled && (
          <>
            <div className="std-map-filter-row">
              <input
                type="text"
                className="std-map-input"
                placeholder="e.g. 1 Dr Carlton B Goodlett Pl"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
              />
              <button type="submit" className="std-map-search-btn" disabled={geocodeStatus === 'loading'}>
                {geocodeStatus === 'loading' ? 'Searching…' : 'Search'}
              </button>
            </div>
            {geocodeStatus === 'error' && (
              <p className="std-map-empty">Couldn&apos;t find that location — showing all events instead.</p>
            )}
            <div className="std-map-filter-row">
              <select
                className="std-map-select"
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value as TransportMode)}
              >
                {TRANSPORT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {transportLabel(mode)}
                  </option>
                ))}
              </select>
              <div className="std-map-stepper">
                <button
                  type="button"
                  className="std-map-stepper-btn"
                  onClick={() => setMinutes((m) => Math.max(MINUTES_MIN, m - MINUTES_STEP))}
                  disabled={minutes <= MINUTES_MIN}
                  aria-label="Decrease minutes"
                >
                  −
                </button>
                <span className="std-map-stepper-value">{minutes} min</span>
                <button
                  type="button"
                  className="std-map-stepper-btn"
                  onClick={() => setMinutes((m) => Math.min(MINUTES_MAX, m + MINUTES_STEP))}
                  disabled={minutes >= MINUTES_MAX}
                  aria-label="Increase minutes"
                >
                  +
                </button>
              </div>
            </div>
          </>
        )}
      </form>

      <div className="std-map-legend">
        <div className="std-map-legend-actions">
          <button
            type="button"
            className="std-map-legend-action"
            onClick={() => setSelectedTypes(new Set(ALL_SOURCE_KEYS))}
          >
            Select all
          </button>
          <button
            type="button"
            className="std-map-legend-action"
            onClick={() => setSelectedTypes(new Set([ALL_SOURCE_KEYS[0]]))}
          >
            Clear
          </button>
        </div>
        {ALL_SOURCE_KEYS.map((key) => {
          const { label, color, emoji } = MAP_CALENDAR_LEGEND[key]
          return (
            <label key={key} className="std-map-legend-item">
              <input
                type="checkbox"
                checked={selectedTypes.has(key)}
                onChange={() => toggleCalendarType(key)}
              />
              <span className="std-map-legend-dot" style={{ backgroundColor: color }}>
                {emoji}
              </span>
              <span className="std-map-legend-label">{label}</span>
              <span className="std-map-legend-count">{eventCountsByCalendar[key] ?? 0}</span>
            </label>
          )
        })}
      </div>

      <div ref={mapWrapRef} style={mapWidth ? { width: mapWidth, maxWidth: 'none' } : undefined}>
        <LeafletMap
          events={visibleEvents}
          searchOrigin={searchOrigin}
          radiusMiles={activeRadiusMiles}
          highlightedEventIds={highlightedEventIds}
        />
      </div>

      {visibleEvents.length === 0 ? (
        <p className="std-map-empty">
          {loadError
            ? "Couldn't load events right now — try again shortly."
            : `No ${eventTypeSentence}events match your current filters.`}
        </p>
      ) : (
        <EventsList
          events={visibleEvents}
          upvoteCounts={upvoteCounts}
          votedEventIds={votedEventIds}
          onToggleUpvote={toggleUpvote}
          highlightedEventIds={highlightedEventIds}
        />
      )}

      {visibleUnknownLocationEvents.length > 0 && (
        <>
          <h3 className="std-map-unknown-location-heading">Events with unknown locations</h3>
          <EventsList
            events={visibleUnknownLocationEvents}
            upvoteCounts={upvoteCounts}
            votedEventIds={votedEventIds}
            onToggleUpvote={toggleUpvote}
          />
        </>
      )}
    </section>
  )
}
