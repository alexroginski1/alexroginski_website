'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import EventCountBanner from './EventCountBanner'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'
import type { MapCalendarKey } from '@/lib/calendarIds'
import type { ApiEvent, EventsResponse } from '@/lib/mapTypes'
import { haversineMiles, radiusMiles as computeRadiusMiles, TRANSPORT_SPEEDS_MPH, type TransportMode } from '@/lib/geo'

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

export default function EventsMapSection() {
  const [weekCount, setWeekCount] = useState<number | null>(null)
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [loadError, setLoadError] = useState(false)

  const [keyword, setKeyword] = useState('')
  const [locationText, setLocationText] = useState('')
  const [transportMode, setTransportMode] = useState<TransportMode>('walk')
  const [minutes, setMinutes] = useState(20)
  const [enabledSources, setEnabledSources] = useState<Set<MapCalendarKey>>(new Set(ALL_SOURCE_KEYS))
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [lastGeocode, setLastGeocode] = useState<LastGeocode | null>(null)
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const hydratedRef = useRef(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data: EventsResponse) => {
        setWeekCount(data.weekCount)
        setEvents(data.today)
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

  const activeRadiusMiles = searchOrigin ? computeRadiusMiles(transportMode, minutes) : null

  const visibleEvents = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return events.filter((event) => {
      if (!enabledSources.has(event.calendar)) return false
      if (kw) {
        const haystack = `${event.title} ${event.description ?? ''}`.toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      if (searchOrigin && activeRadiusMiles !== null) {
        const distance = haversineMiles(searchOrigin, { lat: event.lat, lng: event.lng })
        if (distance > activeRadiusMiles) return false
      }
      return true
    })
  }, [events, enabledSources, keyword, searchOrigin, activeRadiusMiles])

  return (
    <section className="std-map-section">
      <h2>Live SF Events Map</h2>

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
            placeholder="e.g. 1448 Bush Street"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
          />
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
          <input
            type="number"
            className="std-map-select"
            min={5}
            max={180}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(5, Number(e.target.value) || 5))}
            aria-label="Minutes"
            style={{ width: '5rem' }}
          />
          <span className="std-map-empty" style={{ padding: 0 }}>
            min
          </span>
          <button type="submit" className="std-map-search-btn" disabled={geocodeStatus === 'loading'}>
            {geocodeStatus === 'loading' ? 'Searching…' : 'Search'}
          </button>
        </div>
        {geocodeStatus === 'error' && (
          <p className="std-map-empty">Couldn&apos;t find that location — showing all events instead.</p>
        )}
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
              aria-pressed={on}
            >
              <span className="std-map-legend-dot" style={{ backgroundColor: color }} />
              {label}
            </button>
          )
        })}
      </div>

      <LeafletMap events={visibleEvents} searchOrigin={searchOrigin} radiusMiles={activeRadiusMiles} />

      {visibleEvents.length === 0 && (
        <p className="std-map-empty">
          {loadError
            ? "Couldn't load today's events right now — try again shortly."
            : 'No events match your current filters.'}
        </p>
      )}
    </section>
  )
}
