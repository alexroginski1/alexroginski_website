'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Map as LeafletMapInstance } from 'leaflet'
import EventsList from './EventsList'
import CalendarLegendControl, { eventSourceKey } from './CalendarLegendControl'
import NeighborhoodFilterControl from './NeighborhoodFilterControl'
import DatePresetControl, { type DatePreset } from './DatePresetControl'
import SortGroupControl from './SortGroupControl'
import HelpSidebar from './HelpSidebar'
import SurveySidebar from './SurveySidebar'
import StoriesView from './StoriesView'
import LatestUpdateSidebar from './LatestUpdateSidebar'
import { RADIUS_HIGHLIGHT_FILL_COLOR } from '@/lib/mapCalendarLegend'
import type { ListCriterion } from '@/lib/mapListGrouping'
import type { MapCalendarKey } from '@/lib/calendarIds'
import { isEventEnded, matchesPreciseTime, matchesTimeOfDay, type TimeOfDay } from '@/lib/mapEventFormat'
import type { ApiEvent, EventsResponse, UnknownLocationEvent } from '@/lib/mapTypes'
import { haversineMiles } from '@/lib/geo'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="std-map-overlay-body std-map-loading">Loading map…</div>,
})

type ViewMode = 'map' | 'list'

const STORAGE_KEY = 'std_map_filters'
const STORAGE_VERSION = 9

// Bucket label for events whose source didn't supply a neighborhood — kept
// selectable in the +neighborhood filter like any other value, rather than
// always shown regardless of selection.
const UNKNOWN_NEIGHBORHOOD = 'Unknown'

// Nudges a returning visitor toward the survey button once they've been
// here enough times to plausibly have an opinion — shown at most once ever,
// tracked separately from the visit count so it doesn't reappear once the
// count keeps climbing past the threshold.
const VISIT_COUNT_KEY = 'std_visit_count'
const SURVEY_NUDGE_SHOWN_KEY = 'std_survey_nudge_shown'
const SURVEY_NUDGE_VISIT_THRESHOLD = 5

// Default "+location" anchor and its known coordinates, so the location
// clause can activate instantly on open without a geocode round-trip.
const DEFAULT_LOCATION_TEXT = 'San Francisco City Hall'
const DEFAULT_LOCATION_COORDS = { lat: 37.7793, lng: -122.4193 }

type LastGeocode = { text: string; lat: number; lng: number }

type PersistedMapFilters = {
  version: typeof STORAGE_VERSION
  locationText: string
  miles: number
  selectedTypes: MapCalendarKey[]
  lastGeocode: LastGeocode | null
  radiusEnabled: boolean
  keywordsEnabled: boolean
  keywordsText: string
  neighborhoodEnabled?: boolean
  selectedNeighborhoods?: string[]
  excludeEnded?: boolean
  timeOfDayEnabled?: boolean
  timeOfDay?: TimeOfDay
  preciseTimeEnabled?: boolean
  preciseTimeMin?: string
  preciseTimeMax?: string
  excludedEventSources?: string[]
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

// Tap-to-cycle distance control, in miles.
const MILES_CYCLE = [1, 2, 3, 4, 5, 6, 7, 8]

// Tap-to-cycle time-of-day control: morning -> afternoon -> evening -> morning ...
const TIME_OF_DAY_CYCLE: TimeOfDay[] = ['morning', 'afternoon', 'evening']

// Default "+precise time" bounds — "between 3 PM and 8 PM".
const DEFAULT_PRECISE_TIME_MIN = '15:00'
const DEFAULT_PRECISE_TIME_MAX = '20:00'

// Formats an "HH:MM" time string as a whole-hour label, e.g. "15:00" -> "3 PM".
function formatHourLabel(value: string): string {
  const hour = Number(value.split(':')[0])
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour} ${period}`
}

// Shifts an "HH:MM" time string by whole hours, wrapping around the clock —
// minutes are dropped since the +precise time control only steps by hour.
function shiftHour(value: string, deltaHours: number): string {
  const hour = Number(value.split(':')[0])
  const next = ((hour + deltaHours) % 24 + 24) % 24
  return `${String(next).padStart(2, '0')}:00`
}

// Whole-hour stepper for the +precise time clause: the box shows the hour
// (e.g. "3 PM") and is split down the middle — hovering the left half reveals
// a faint "−" that decrements by 1 hour on click, the right half a faint "+"
// that increments.
function HourStepper({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
}) {
  return (
    <span className="std-map-hour-stepper">
      <span className="std-map-hour-stepper-label">{formatHourLabel(value)}</span>
      <button
        type="button"
        className="std-map-hour-stepper-zone std-map-hour-stepper-zone-left"
        onClick={() => onChange(shiftHour(value, -1))}
        aria-label={`Decrease ${ariaLabel} by 1 hour`}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        className="std-map-hour-stepper-zone std-map-hour-stepper-zone-right"
        onClick={() => onChange(shiftHour(value, 1))}
        aria-label={`Increase ${ariaLabel} by 1 hour`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </span>
  )
}

export default function EventsMapSection() {
  const [events, setEvents] = useState<ApiEvent[]>([])
  const [unknownLocationEvents, setUnknownLocationEvents] = useState<UnknownLocationEvent[]>([])
  const [loadError, setLoadError] = useState(false)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [sentenceVisible, setSentenceVisible] = useState(true)

  // Empty until either localStorage supplies an explicit selection or the
  // "default to everything" effect below runs once the actual set of
  // calendars (allCalendarKeys) is known from fetched event data.
  const [selectedTypes, setSelectedTypes] = useState<Set<MapCalendarKey>>(() => new Set())
  const selectedTypesInitializedRef = useRef(false)
  // Composite `${calendar}::${eventSource}` keys the user has unchecked in a
  // calendar's event-source sub-panel. Empty by default (every source
  // included) rather than defaulting to "everything" once sources are known
  // — unlike selectedTypes/selectedNeighborhoods, an empty exclusion set
  // already means "no sub-filter applied", so there's no separate init step.
  const [excludedEventSources, setExcludedEventSources] = useState<Set<string>>(() => new Set())
  const [neighborhoodEnabled, setNeighborhoodEnabled] = useState(false)
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<Set<string>>(() => new Set())
  const selectedNeighborhoodsInitializedRef = useRef(false)
  const [locationText, setLocationText] = useState(DEFAULT_LOCATION_TEXT)
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationDraft, setLocationDraft] = useState('')
  const [miles, setMiles] = useState(5)
  const [dateFrom, setDateFrom] = useState(() => sfDateKey(new Date()))
  const [dateTo, setDateTo] = useState(() => sfDateKey(new Date()))
  const [allDates, setAllDates] = useState(false)
  const [customDateMode, setCustomDateMode] = useState(false)
  const [radiusEnabled, setRadiusEnabled] = useState(false)
  const [keywordsEnabled, setKeywordsEnabled] = useState(false)
  const [keywordsText, setKeywordsText] = useState('')
  const [editingKeywords, setEditingKeywords] = useState(false)
  const [keywordsDraft, setKeywordsDraft] = useState('')
  const [excludeEnded, setExcludeEnded] = useState(false)
  const [timeOfDayEnabled, setTimeOfDayEnabled] = useState(false)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning')
  const [preciseTimeEnabled, setPreciseTimeEnabled] = useState(false)
  const [preciseTimeMin, setPreciseTimeMin] = useState(DEFAULT_PRECISE_TIME_MIN)
  const [preciseTimeMax, setPreciseTimeMax] = useState(DEFAULT_PRECISE_TIME_MAX)
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [lastGeocode, setLastGeocode] = useState<LastGeocode | null>(null)
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const hydratedRef = useRef(false)
  const [hydrated, setHydrated] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [sortGroupOrder, setSortGroupOrder] = useState<ListCriterion[]>(['source', 'time'])
  const [mapInstance, setMapInstance] = useState<LeafletMapInstance | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [surveyOpen, setSurveyOpen] = useState(false)
  const [surveyNudgeVisible, setSurveyNudgeVisible] = useState(false)
  const [storiesOpen, setStoriesOpen] = useState(false)
  const [latestUpdateOpen, setLatestUpdateOpen] = useState(false)

  function toggleSortGroupCriterion(criterion: ListCriterion) {
    setSortGroupOrder((prev) => (prev.includes(criterion) ? prev.filter((c) => c !== criterion) : [...prev, criterion]))
  }

  // Counts this page load as a visit and, the first time the count crosses
  // the threshold, flags the survey nudge to show — the shown-flag is set
  // immediately (not on dismiss) so it never reappears on a later visit.
  useEffect(() => {
    try {
      const count = Number(localStorage.getItem(VISIT_COUNT_KEY) ?? '0') + 1
      localStorage.setItem(VISIT_COUNT_KEY, String(count))
      const alreadyShown = localStorage.getItem(SURVEY_NUDGE_SHOWN_KEY) === '1'
      if (count > SURVEY_NUDGE_VISIT_THRESHOLD && !alreadyShown) {
        setSurveyNudgeVisible(true)
        localStorage.setItem(SURVEY_NUDGE_SHOWN_KEY, '1')
      }
    } catch {
      // ignore quota/availability errors
    }
  }, [])

  // The map is the whole page now — no collapse/close, so this only needs
  // to run once to stop the page itself from scrolling behind it.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    function loadEvents() {
      fetch('/api/events')
        .then((res) => res.json())
        .then((data: EventsResponse) => {
          if (cancelled) return
          // Defensive against a stale edge-cached response from a previous
          // deploy whose shape doesn't match this build's expectations.
          if (Array.isArray(data?.events)) setEvents(data.events)
          if (Array.isArray(data?.unknownLocationEvents)) setUnknownLocationEvents(data.unknownLocationEvents)
          setLoadError(false)
        })
        .catch(() => {
          if (!cancelled) setLoadError(true)
        })
        .finally(() => {
          if (!cancelled) setEventsLoading(false)
        })
    }

    loadEvents()

    // The API response is edge-cached for 5 minutes (CACHE_TTL_SECONDS in
    // functions/api/events.ts) and the underlying stats-API/geocode data
    // keeps changing behind it. Without a refetch, a tab left open just
    // keeps showing the snapshot from whenever it first loaded — drifting
    // further from the live event count the longer it sits, with nothing
    // telling the visitor it's gone stale.
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000
    const interval = setInterval(loadEvents, REFRESH_INTERVAL_MS)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') loadEvents()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // The set of calendars is whatever's actually present in the fetched
  // events — not a hardcoded list — so a calendar added upstream shows up
  // here (and in the "all types of" menu) without a code change.
  const allCalendarKeys = useMemo(() => {
    const keys = new Set<MapCalendarKey>()
    for (const event of events) keys.add(event.calendar)
    for (const event of unknownLocationEvents) keys.add(event.calendar)
    return [...keys].sort((a, b) => a.localeCompare(b))
  }, [events, unknownLocationEvents])

  // Defaults selectedTypes to "everything" once the real calendar list is
  // known, unless localStorage already supplied an explicit selection (that
  // branch below sets the initialized ref first, so this is skipped).
  useEffect(() => {
    if (!hydrated || selectedTypesInitializedRef.current || allCalendarKeys.length === 0) return
    setSelectedTypes(new Set(allCalendarKeys))
    selectedTypesInitializedRef.current = true
  }, [hydrated, allCalendarKeys])

  // Same "derived from whatever's actually in the data" approach as
  // allCalendarKeys above — events missing a neighborhood land in a single
  // "Unknown" bucket rather than being left out of the filter entirely.
  const allNeighborhoods = useMemo(() => {
    const keys = new Set<string>()
    for (const event of events) keys.add(event.neighborhood || UNKNOWN_NEIGHBORHOOD)
    for (const event of unknownLocationEvents) keys.add(event.neighborhood || UNKNOWN_NEIGHBORHOOD)
    return [...keys].sort((a, b) => a.localeCompare(b))
  }, [events, unknownLocationEvents])

  // Defaults selectedNeighborhoods to "everything" once the real neighborhood
  // list is known, mirroring the selectedTypes default above.
  useEffect(() => {
    if (!hydrated || selectedNeighborhoodsInitializedRef.current || allNeighborhoods.length === 0) return
    setSelectedNeighborhoods(new Set(allNeighborhoods))
    selectedNeighborhoodsInitializedRef.current = true
  }, [hydrated, allNeighborhoods])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: PersistedMapFilters = JSON.parse(raw)
        if (parsed && parsed.version === STORAGE_VERSION) {
          const text = parsed.locationText || DEFAULT_LOCATION_TEXT
          setLocationText(text)
          setMiles(MILES_CYCLE.includes(parsed.miles) ? parsed.miles : 5)
          if (Array.isArray(parsed.selectedTypes)) {
            setSelectedTypes(new Set(parsed.selectedTypes))
            selectedTypesInitializedRef.current = true
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
          if (parsed.neighborhoodEnabled) setNeighborhoodEnabled(true)
          if (Array.isArray(parsed.selectedNeighborhoods)) {
            setSelectedNeighborhoods(new Set(parsed.selectedNeighborhoods))
            selectedNeighborhoodsInitializedRef.current = true
          }
          if (parsed.excludeEnded) setExcludeEnded(true)
          if (parsed.timeOfDayEnabled && TIME_OF_DAY_CYCLE.includes(parsed.timeOfDay as TimeOfDay)) {
            setTimeOfDayEnabled(true)
            setTimeOfDay(parsed.timeOfDay as TimeOfDay)
          }
          if (parsed.preciseTimeEnabled) {
            setPreciseTimeEnabled(true)
            if (parsed.preciseTimeMin) setPreciseTimeMin(parsed.preciseTimeMin)
            if (parsed.preciseTimeMax) setPreciseTimeMax(parsed.preciseTimeMax)
          }
          if (Array.isArray(parsed.excludedEventSources)) {
            setExcludedEventSources(new Set(parsed.excludedEventSources))
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
        miles,
        selectedTypes: Array.from(selectedTypes),
        lastGeocode,
        radiusEnabled,
        keywordsEnabled,
        keywordsText,
        neighborhoodEnabled,
        selectedNeighborhoods: Array.from(selectedNeighborhoods),
        excludeEnded,
        timeOfDayEnabled,
        timeOfDay,
        preciseTimeEnabled,
        preciseTimeMin,
        preciseTimeMax,
        excludedEventSources: Array.from(excludedEventSources),
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
    miles,
    selectedTypes,
    lastGeocode,
    radiusEnabled,
    keywordsEnabled,
    keywordsText,
    neighborhoodEnabled,
    selectedNeighborhoods,
    excludeEnded,
    timeOfDayEnabled,
    timeOfDay,
    preciseTimeEnabled,
    preciseTimeMin,
    preciseTimeMax,
    excludedEventSources,
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

  function toggleEventSource(calendar: MapCalendarKey, source: string) {
    const key = eventSourceKey(calendar, source)
    setExcludedEventSources((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function cycleMiles() {
    setMiles((m) => {
      const idx = MILES_CYCLE.indexOf(m)
      return MILES_CYCLE[(idx + 1) % MILES_CYCLE.length]
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

  function toggleNeighborhood(key: string) {
    setSelectedNeighborhoods((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function enableNeighborhoodFilter() {
    setNeighborhoodEnabled(true)
  }

  function disableNeighborhoodFilter() {
    setNeighborhoodEnabled(false)
  }

  function toggleExcludeEnded() {
    setExcludeEnded((v) => !v)
  }

  function enableTimeOfDay() {
    setTimeOfDayEnabled(true)
    setTimeOfDay('morning')
  }

  function disableTimeOfDay() {
    setTimeOfDayEnabled(false)
  }

  function cycleTimeOfDay() {
    setTimeOfDay((t) => TIME_OF_DAY_CYCLE[(TIME_OF_DAY_CYCLE.indexOf(t) + 1) % TIME_OF_DAY_CYCLE.length])
  }

  function enablePreciseTime() {
    setPreciseTimeEnabled(true)
  }

  function disablePreciseTime() {
    setPreciseTimeEnabled(false)
  }

  // Gated on radiusEnabled (rather than clearing searchOrigin outright) so
  // the last-searched location stays cached for instant reuse on reopen.
  const activeSearchOrigin = radiusEnabled ? searchOrigin : null
  const activeRadiusMiles = activeSearchOrigin ? miles : null

  // Case-insensitive substring match against title/description — the "where
  // event contains" clause. Null (rather than empty string) when the filter
  // is off, so callers can skip the check entirely.
  const activeKeywords = keywordsEnabled && keywordsText ? keywordsText.toLowerCase() : null

  // Null (rather than a default bucket) when the filter is off, so callers
  // can skip the check entirely — mirrors activeKeywords above.
  const activeTimeOfDay = timeOfDayEnabled ? timeOfDay : null

  // Null when the filter is off, so callers can skip the check entirely —
  // mirrors activeTimeOfDay above.
  const activePreciseTime = preciseTimeEnabled ? { min: preciseTimeMin, max: preciseTimeMax } : null

  // Null when the filter is off, so callers can skip the check entirely —
  // mirrors activeTimeOfDay above.
  const activeNeighborhoods = neighborhoodEnabled ? selectedNeighborhoods : null

  // Counts events matching the current date/keyword filters per calendar,
  // independent of which calendars are checked, so the legend shows what's
  // available for a source even while it's unchecked. Event-source exclusions
  // are applied here (unlike calendar selection) since they're a real filter
  // the user has set, not just a preview toggle.
  const eventCountsByCalendar = useMemo(() => {
    const counts = Object.fromEntries(allCalendarKeys.map((key) => [key, 0])) as Record<MapCalendarKey, number>
    for (const event of events ?? []) {
      if (excludedEventSources.has(eventSourceKey(event.calendar, event.eventSource))) continue
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
      if (activeTimeOfDay && !matchesTimeOfDay(event.start, activeTimeOfDay)) continue
      if (activePreciseTime && !matchesPreciseTime(event.start, activePreciseTime.min, activePreciseTime.max)) continue
      if (activeNeighborhoods && !activeNeighborhoods.has(event.neighborhood || UNKNOWN_NEIGHBORHOOD)) continue
      if (excludeEnded && isEventEnded(event.end)) continue
      counts[event.calendar] = (counts[event.calendar] ?? 0) + 1
    }
    return counts
  }, [
    events,
    allCalendarKeys,
    allDates,
    dateFrom,
    dateTo,
    activeKeywords,
    activeTimeOfDay,
    activePreciseTime,
    activeNeighborhoods,
    excludeEnded,
    excludedEventSources,
  ])

  // Which event sources exist per calendar, and how many events they
  // currently match — same "independent of the checkbox itself" pattern as
  // eventCountsByCalendar, but scoped to one calendar's own sub-panel so it
  // stays correct while that panel is the thing being edited. A source with
  // zero matches is left out of eventSourcesByCalendar entirely, per the
  // "don't show empty sources" requirement.
  const { eventSourcesByCalendar, eventSourceCounts } = useMemo(() => {
    const counts: Record<string, number> = {}
    const sourcesByCalendar: Record<MapCalendarKey, Set<string>> = {}
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
      if (activeTimeOfDay && !matchesTimeOfDay(event.start, activeTimeOfDay)) continue
      if (activePreciseTime && !matchesPreciseTime(event.start, activePreciseTime.min, activePreciseTime.max)) continue
      if (activeNeighborhoods && !activeNeighborhoods.has(event.neighborhood || UNKNOWN_NEIGHBORHOOD)) continue
      if (excludeEnded && isEventEnded(event.end)) continue
      const key = eventSourceKey(event.calendar, event.eventSource)
      counts[key] = (counts[key] ?? 0) + 1
      if (!sourcesByCalendar[event.calendar]) sourcesByCalendar[event.calendar] = new Set()
      sourcesByCalendar[event.calendar].add(event.eventSource)
    }
    const sourcesOut: Record<MapCalendarKey, string[]> = {}
    for (const [calendar, sources] of Object.entries(sourcesByCalendar)) {
      sourcesOut[calendar] = [...sources].sort((a, b) => a.localeCompare(b))
    }
    return { eventSourcesByCalendar: sourcesOut, eventSourceCounts: counts }
  }, [
    events,
    allDates,
    dateFrom,
    dateTo,
    activeKeywords,
    activeTimeOfDay,
    activePreciseTime,
    activeNeighborhoods,
    excludeEnded,
  ])

  // Counts events matching the current date/keyword/calendar filters per
  // neighborhood, independent of which neighborhoods are checked, so the
  // panel shows what's available even while it's unchecked — mirrors
  // eventCountsByCalendar above.
  const eventCountsByNeighborhood = useMemo(() => {
    const counts = Object.fromEntries(allNeighborhoods.map((key) => [key, 0])) as Record<string, number>
    for (const event of events ?? []) {
      if (!selectedTypes.has(event.calendar)) continue
      if (excludedEventSources.has(eventSourceKey(event.calendar, event.eventSource))) continue
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
      if (activeTimeOfDay && !matchesTimeOfDay(event.start, activeTimeOfDay)) continue
      if (activePreciseTime && !matchesPreciseTime(event.start, activePreciseTime.min, activePreciseTime.max)) continue
      if (excludeEnded && isEventEnded(event.end)) continue
      const key = event.neighborhood || UNKNOWN_NEIGHBORHOOD
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [
    events,
    allNeighborhoods,
    selectedTypes,
    allDates,
    dateFrom,
    dateTo,
    activeKeywords,
    activeTimeOfDay,
    activePreciseTime,
    excludeEnded,
    excludedEventSources,
  ])

  // Whether any event matching the other active filters has already ended —
  // gates whether the "+ not ended" clause is offered at all, so it's not
  // dangled in front of the user when there's nothing for it to exclude.
  // Computed without excludeEnded itself, so the clause doesn't vanish out
  // from under the user the moment they turn it on.
  const hasEndedEvents = useMemo(() => {
    for (const event of events ?? []) {
      if (!selectedTypes.has(event.calendar)) continue
      if (excludedEventSources.has(eventSourceKey(event.calendar, event.eventSource))) continue
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
      if (activeTimeOfDay && !matchesTimeOfDay(event.start, activeTimeOfDay)) continue
      if (activePreciseTime && !matchesPreciseTime(event.start, activePreciseTime.min, activePreciseTime.max)) continue
      if (activeNeighborhoods && !activeNeighborhoods.has(event.neighborhood || UNKNOWN_NEIGHBORHOOD)) continue
      if (isEventEnded(event.end)) return true
    }
    return false
  }, [
    events,
    selectedTypes,
    allDates,
    dateFrom,
    dateTo,
    activeKeywords,
    activeTimeOfDay,
    activePreciseTime,
    activeNeighborhoods,
    excludedEventSources,
  ])

  const visibleEvents = useMemo(() => {
    return (events ?? []).filter((event) => {
      if (!selectedTypes.has(event.calendar)) return false
      if (excludedEventSources.has(eventSourceKey(event.calendar, event.eventSource))) return false
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
      if (activeTimeOfDay && !matchesTimeOfDay(event.start, activeTimeOfDay)) return false
      if (activePreciseTime && !matchesPreciseTime(event.start, activePreciseTime.min, activePreciseTime.max)) return false
      if (activeNeighborhoods && !activeNeighborhoods.has(event.neighborhood || UNKNOWN_NEIGHBORHOOD)) return false
      if (excludeEnded && isEventEnded(event.end)) return false
      // Events outside the travel radius stay visible (dimmed in LeafletMap)
      // rather than being dropped — the radius is a highlight, not a filter.
      return true
    })
  }, [
    events,
    selectedTypes,
    allDates,
    dateFrom,
    dateTo,
    activeKeywords,
    activeTimeOfDay,
    activePreciseTime,
    activeNeighborhoods,
    excludeEnded,
    excludedEventSources,
  ])

  // Same calendar/date/keyword filters as visibleEvents, applied to events
  // whose location couldn't be placed on the map at all.
  const visibleUnknownLocationEvents = useMemo(() => {
    return unknownLocationEvents.filter((event) => {
      if (!selectedTypes.has(event.calendar)) return false
      if (excludedEventSources.has(eventSourceKey(event.calendar, event.eventSource))) return false
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
      if (activeTimeOfDay && !matchesTimeOfDay(event.start, activeTimeOfDay)) return false
      if (activePreciseTime && !matchesPreciseTime(event.start, activePreciseTime.min, activePreciseTime.max)) return false
      if (activeNeighborhoods && !activeNeighborhoods.has(event.neighborhood || UNKNOWN_NEIGHBORHOOD)) return false
      if (excludeEnded && isEventEnded(event.end)) return false
      return true
    })
  }, [
    unknownLocationEvents,
    selectedTypes,
    allDates,
    dateFrom,
    dateTo,
    activeKeywords,
    activeTimeOfDay,
    activePreciseTime,
    activeNeighborhoods,
    excludeEnded,
    excludedEventSources,
  ])

  // List view shows events with an unplaceable location inline alongside
  // everything else (styled distinctly, see EventsList) rather than in a
  // separate section — the map view still excludes them since they have no
  // lat/lng to plot.
  const listEvents = useMemo(
    () => [...visibleEvents, ...visibleUnknownLocationEvents],
    [visibleEvents, visibleUnknownLocationEvents],
  )

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
    <div className="std-map-overlay">
      <div className="std-map-button-stack">
        <button
          type="button"
          className="std-map-stack-btn"
          onClick={() => setSentenceVisible((v) => !v)}
          aria-label={sentenceVisible ? 'Hide filters' : 'Show filters'}
        >
          {sentenceVisible ? '▲' : '▼'}
        </button>

        {viewMode === 'map' && (
          <>
            <button
              type="button"
              className="std-map-stack-btn"
              onClick={() => mapInstance?.zoomIn()}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="std-map-stack-btn"
              onClick={() => mapInstance?.zoomOut()}
              aria-label="Zoom out"
            >
              −
            </button>
          </>
        )}

        <button
          type="button"
          className={`std-map-stack-btn${helpOpen ? ' std-map-stack-btn-active' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setHelpOpen((v) => !v)
            setSurveyOpen(false)
            setStoriesOpen(false)
            setLatestUpdateOpen(false)
          }}
          aria-label={helpOpen ? 'Close about this project' : 'About this project'}
        >
          ?
        </button>

        <button
          type="button"
          className={`std-map-stack-btn${latestUpdateOpen ? ' std-map-stack-btn-active' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setLatestUpdateOpen((v) => !v)
            setHelpOpen(false)
            setSurveyOpen(false)
            setStoriesOpen(false)
          }}
          aria-label={latestUpdateOpen ? 'Close latest update' : 'Latest update'}
        >
          !
        </button>

        <div className="std-map-survey-btn-wrap">
          <button
            type="button"
            className={`std-map-stack-btn${surveyOpen ? ' std-map-stack-btn-active' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              setSurveyOpen((v) => !v)
              setHelpOpen(false)
              setSurveyNudgeVisible(false)
              setStoriesOpen(false)
              setLatestUpdateOpen(false)
            }}
            aria-label={surveyOpen ? 'Close survey' : 'Quick survey'}
          >
            🤚
          </button>

          {surveyNudgeVisible && (
            <div className="std-map-survey-nudge" role="status">
              <button
                type="button"
                className="std-map-survey-nudge-close"
                onClick={() => setSurveyNudgeVisible(false)}
                aria-label="Dismiss"
              >
                ×
              </button>
              <p>Enjoying the map? Tap 🤚 to share quick feedback!</p>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`std-map-stack-btn${storiesOpen ? ' std-map-stack-btn-active' : ''}`}
          onClick={() => {
            setStoriesOpen((v) => !v)
            setHelpOpen(false)
            setSurveyOpen(false)
            setSurveyNudgeVisible(false)
            setLatestUpdateOpen(false)
          }}
          aria-label={storiesOpen ? 'Close Our Stories' : 'Our Stories'}
        >
          📖
        </button>
      </div>

      {sentenceVisible && (
      <div className="std-map-overlay-topbar">
      <div className="std-map-sentence">
        <span>Find me </span>
        <CalendarLegendControl
          calendarKeys={allCalendarKeys}
          selectedTypes={selectedTypes}
          eventCounts={eventCountsByCalendar}
          onToggle={toggleCalendarType}
          onSelectAll={() => setSelectedTypes(new Set(allCalendarKeys))}
          onClear={() => setSelectedTypes(new Set())}
          eventSourcesByCalendar={eventSourcesByCalendar}
          eventSourceCounts={eventSourceCounts}
          excludedEventSources={excludedEventSources}
          onToggleEventSource={toggleEventSource}
          toggleClassName="std-map-sentence-toggle"
        />
        <span>events for </span>
        <DatePresetControl
          label={dateSentence}
          activePreset={activeDatePreset}
          onSelect={applyDatePreset}
          toggleClassName="std-map-sentence-toggle"
        />

        {timeOfDayEnabled && (
          <>
            <span>in the </span>
            <button type="button" className="std-map-sentence-toggle" onClick={cycleTimeOfDay}>
              {timeOfDay}
            </button>
            <button
              type="button"
              className="std-map-sentence-remove"
              onClick={disableTimeOfDay}
              aria-label="Remove time of day filter"
            >
              ×
            </button>
          </>
        )}

        {preciseTimeEnabled && (
          <>
            <span>and is between </span>
            <HourStepper value={preciseTimeMin} onChange={setPreciseTimeMin} ariaLabel="earliest start time" />
            <span>and </span>
            <HourStepper value={preciseTimeMax} onChange={setPreciseTimeMax} ariaLabel="latest start time" />
            <button
              type="button"
              className="std-map-sentence-remove"
              onClick={disablePreciseTime}
              aria-label="Remove precise time filter"
            >
              ×
            </button>
          </>
        )}

        {radiusEnabled && (
          <>
            <span>and is </span>
            <button type="button" className="std-map-sentence-toggle" onClick={cycleMiles}>
              {miles} mi
            </button>
            <span>from </span>
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
            <button
              type="button"
              className="std-map-sentence-remove"
              onClick={disableLocation}
              aria-label="Remove location filter"
            >
              ×
            </button>
          </>
        )}

        {keywordsEnabled && (
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
        )}

        {neighborhoodEnabled && (
          <>
            <span>in </span>
            <NeighborhoodFilterControl
              neighborhoods={allNeighborhoods}
              selected={selectedNeighborhoods}
              eventCounts={eventCountsByNeighborhood}
              onToggle={toggleNeighborhood}
              onSelectAll={() => setSelectedNeighborhoods(new Set(allNeighborhoods))}
              onClear={() => setSelectedNeighborhoods(new Set())}
            />
            <button
              type="button"
              className="std-map-sentence-remove"
              onClick={disableNeighborhoodFilter}
              aria-label="Remove neighborhood filter"
            >
              ×
            </button>
          </>
        )}

        {hasEndedEvents && excludeEnded && (
          <>
            <span>and has not ended yet </span>
            <button
              type="button"
              className="std-map-sentence-remove"
              onClick={toggleExcludeEnded}
              aria-label="Remove not-ended filter"
            >
              ×
            </button>
          </>
        )}
      </div>

      {(!timeOfDayEnabled ||
        !preciseTimeEnabled ||
        !radiusEnabled ||
        !keywordsEnabled ||
        !neighborhoodEnabled ||
        (hasEndedEvents && !excludeEnded)) && (
        <div className="std-map-sentence-extra">
          {!timeOfDayEnabled && (
            <button type="button" className="std-map-sentence-toggle-sm" onClick={enableTimeOfDay}>
              +Time of day
            </button>
          )}
          {!preciseTimeEnabled && (
            <button type="button" className="std-map-sentence-toggle-sm" onClick={enablePreciseTime}>
              +precise time
            </button>
          )}
          {!radiusEnabled && (
            <button type="button" className="std-map-sentence-toggle-sm" onClick={enableLocation}>
              +miles from
            </button>
          )}
          {!keywordsEnabled && (
            <button type="button" className="std-map-sentence-toggle-sm" onClick={enableKeywords}>
              +keywords
            </button>
          )}
          {!neighborhoodEnabled && (
            <button type="button" className="std-map-sentence-toggle-sm" onClick={enableNeighborhoodFilter}>
              +neighborhood
            </button>
          )}
          {hasEndedEvents && !excludeEnded && (
            <button type="button" className="std-map-sentence-toggle-sm" onClick={toggleExcludeEnded}>
              +not ended
            </button>
          )}
        </div>
      )}

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
        ) : eventsLoading ? (
          'Loading events…'
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
      </div>
      )}

      <div className="std-map-overlay-body">
        {eventsLoading ? (
          <div className="std-map-loading h-full">Loading events…</div>
        ) : viewMode === 'map' ? (
          <LeafletMap
            events={visibleEvents}
            searchOrigin={activeSearchOrigin}
            radiusMiles={activeRadiusMiles}
            highlightedEventIds={highlightedEventIds}
            onMapReady={setMapInstance}
          />
        ) : (
          <div className="std-map-overlay-list">
            <div className="std-list-toolbar">
              <SortGroupControl
                order={sortGroupOrder}
                onToggle={toggleSortGroupCriterion}
                distanceAvailable={!!activeSearchOrigin}
              />
            </div>
            {visibleEvents.length + visibleUnknownLocationEvents.length > 0 ? (
              <EventsList
                events={listEvents}
                highlightedEventIds={highlightedEventIds}
                sortGroupOrder={sortGroupOrder}
                distanceOrigin={activeSearchOrigin}
              />
            ) : (
              <p className="std-map-empty">No events match your filters.</p>
            )}
          </div>
        )}

        {helpOpen && <HelpSidebar onClose={() => setHelpOpen(false)} />}
        {surveyOpen && <SurveySidebar onClose={() => setSurveyOpen(false)} />}
        {storiesOpen && <StoriesView onClose={() => setStoriesOpen(false)} />}
        {latestUpdateOpen && <LatestUpdateSidebar onClose={() => setLatestUpdateOpen(false)} />}
      </div>

      <div className="std-map-view-toggle">
        <button type="button" onClick={() => setViewMode((v) => (v === 'map' ? 'list' : 'map'))}>
          {viewMode === 'map' ? '☰ List' : '🗺️ Map'}
        </button>
      </div>
    </div>
    </section>
  )
}
