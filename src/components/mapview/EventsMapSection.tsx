'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import EventCountBanner from './EventCountBanner'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'
import type { MapCalendarKey } from '@/lib/calendarIds'
import type { ApiEvent, EventsResponse } from '@/lib/mapTypes'
import { radiusMiles as computeRadiusMiles, TRANSPORT_SPEEDS_MPH, type TransportMode } from '@/lib/geo'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="std-map-container std-map-loading">Loading map…</div>,
})

const ALL_SOURCE_KEYS = Object.keys(MAP_CALENDAR_LEGEND) as MapCalendarKey[]
const TRANSPORT_MODES = Object.keys(TRANSPORT_SPEEDS_MPH) as TransportMode[]
const STORAGE_KEY = 'std_map_filters'
const STORAGE_VERSION = 1

type LastGeocode = { text: string; lat: number; lng: number }

type PersistedMapFilters = {
  version: typeof STORAGE_VERSION
  keyword: string
  locationText: string
  transportMode: TransportMode
  minutes: number
  enabledSources: MapCalendarKey[]
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
  const [weekCount, setWeekCount] = useState<number | null>(null)
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [loadError, setLoadError] = useState(false)

  const [keyword, setKeyword] = useState('')
  const [locationText, setLocationText] = useState('')
  const [transportMode, setTransportMode] = useState<TransportMode>('walk')
  const [minutes, setMinutes] = useState(20)
  const [enabledSources, setEnabledSources] = useState<Set<MapCalendarKey>>(new Set(ALL_SOURCE_KEYS))
  const [dateFrom, setDateFrom] = useState(() => sfDateKey(new Date()))
  const [dateTo, setDateTo] = useState(() => sfDateKey(new Date()))
  const [allDates, setAllDates] = useState(false)
  const [radiusEnabled, setRadiusEnabled] = useState(false)
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [recenterSignal, setRecenterSignal] = useState(0)
  const [lastGeocode, setLastGeocode] = useState<LastGeocode | null>(null)
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const hydratedRef = useRef(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data: EventsResponse) => {
        // Defensive against a stale edge-cached response from a previous
        // deploy whose shape doesn't match this build's expectations.
        if (typeof data?.weekCount === 'number') setWeekCount(data.weekCount)
        if (Array.isArray(data?.events)) setEvents(data.events)
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: PersistedMapFilters = JSON.parse(raw)
        if (parsed && parsed.version === STORAGE_VERSION) {
          setKeyword(parsed.keyword ?? '')
          setLocationText(parsed.locationText ?? '')
          setTransportMode(parsed.transportMode ?? 'walk')
          setMinutes(parsed.minutes ?? 20)
          if (parsed.enabledSources?.length) setEnabledSources(new Set(parsed.enabledSources))
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
        locationText,
        transportMode,
        minutes,
        enabledSources: [...enabledSources],
        lastGeocode,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // ignore quota/availability errors
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [hydrated, keyword, locationText, transportMode, minutes, enabledSources, lastGeocode])

  function toggleSource(key: MapCalendarKey) {
    setEnabledSources((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function isolateSource(key: MapCalendarKey) {
    setEnabledSources((prev) => {
      // Double-clicking an already-isolated chip restores all sources.
      if (prev.size === 1 && prev.has(key)) return new Set(ALL_SOURCE_KEYS)
      return new Set([key])
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

  const activeRadiusMiles = radiusEnabled && searchOrigin ? computeRadiusMiles(transportMode, minutes) : null

  const visibleEvents = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return (events ?? []).filter((event) => {
      if (!enabledSources.has(event.calendar)) return false
      if (!allDates) {
        const eventDateKey = sfDateKey(new Date(event.start))
        if (eventDateKey < dateFrom || eventDateKey > dateTo) return false
      }
      if (kw) {
        const haystack = `${event.title} ${event.description ?? ''}`.toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      // Events outside the travel radius stay visible (dimmed in LeafletMap)
      // rather than being dropped — the radius is a highlight, not a filter.
      return true
    })
  }, [events, enabledSources, keyword, allDates, dateFrom, dateTo])

  return (
    <section className="std-map-section">
      <h2>(WIP) Live SF Events Map</h2>

      <EventCountBanner count={loadError ? null : weekCount} />

      <form className="std-map-filters" onSubmit={handleLocationSearch}>
        <div className="std-map-filter-row">
          <input
            type="text"
            className="std-map-input"
            placeholder="Search events by keyword…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

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
          <button
            type="button"
            className="std-map-preset-btn"
            onClick={() => setRecenterSignal((n) => n + 1)}
          >
            Recenter to SF
          </button>
        </div>
        {geocodeStatus === 'error' && (
          <p className="std-map-empty">
            Couldn&apos;t find that location — showing all events instead. Use &quot;Recenter to SF&quot; to
            reset the map view.
          </p>
        )}

        <div className="std-map-filter-row">
          <label className="std-map-checkbox-label">
            <input
              type="checkbox"
              checked={radiusEnabled}
              onChange={(e) => setRadiusEnabled(e.target.checked)}
            />
            Limit by travel radius
          </label>
          <select
            className="std-map-select"
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value as TransportMode)}
            disabled={!radiusEnabled}
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
              disabled={!radiusEnabled || minutes <= MINUTES_MIN}
              aria-label="Decrease minutes"
            >
              −
            </button>
            <span className="std-map-stepper-value">{minutes} min</span>
            <button
              type="button"
              className="std-map-stepper-btn"
              onClick={() => setMinutes((m) => Math.min(MINUTES_MAX, m + MINUTES_STEP))}
              disabled={!radiusEnabled || minutes >= MINUTES_MAX}
              aria-label="Increase minutes"
            >
              +
            </button>
          </div>
        </div>

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
          <label className="std-map-empty" style={{ padding: 0 }} htmlFor="std-map-date-from">
            Date
          </label>
          <input
            id="std-map-date-from"
            type="date"
            className="std-map-select"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            disabled={allDates}
          />
          <span className="std-map-empty" style={{ padding: 0 }}>
            to
          </span>
          <input
            type="date"
            className="std-map-select"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            aria-label="End date"
            disabled={allDates}
          />
        </div>
      </form>

      <div className="std-map-legend">
        {ALL_SOURCE_KEYS.map((key) => {
          const { label, color } = MAP_CALENDAR_LEGEND[key]
          const on = enabledSources.has(key)
          return (
            <button
              key={key}
              type="button"
              className={`std-map-legend-chip${on ? '' : ' std-map-legend-chip-off'}`}
              onClick={() => toggleSource(key)}
              onDoubleClick={() => isolateSource(key)}
              aria-pressed={on}
              title="Double-click to show only this calendar"
            >
              <span className="std-map-legend-dot" style={{ backgroundColor: color }} />
              {label}
            </button>
          )
        })}
      </div>

      <LeafletMap
        events={visibleEvents}
        searchOrigin={searchOrigin}
        radiusMiles={activeRadiusMiles}
        recenterSignal={recenterSignal}
      />

      {visibleEvents.length === 0 && (
        <p className="std-map-empty">
          {loadError
            ? "Couldn't load this week's events right now — try again shortly."
            : 'No events match your current filters.'}
        </p>
      )}
    </section>
  )
}
