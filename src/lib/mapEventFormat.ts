import type { ApiEvent } from './mapTypes'

export const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const shortWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'short',
})

export const shortTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  minute: '2-digit',
})

const longWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
})

const longMonthDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  month: 'long',
  day: 'numeric',
})

const shortMonthDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  month: 'short',
  day: 'numeric',
})

// "Mon" + "5:30 PM" / "Sat" + "10 AM" — used for the map marker labels,
// which are too small for the fuller `dateTimeFormatter` output. Split so
// the weekday can be styled separately (e.g. color-coded per day).
export function shortEventDateParts(iso: string): { weekday: string; time: string } {
  const date = new Date(iso)
  const time = shortTimeFormatter.format(date).replace(':00 ', ' ')
  return { weekday: shortWeekdayFormatter.format(date), time }
}

// "Monday, August 9, 10:00 AM – 12:00 PM" — used in the map marker popup,
// where a bare time is ambiguous once events from more than one day are on
// screen. The end is just a time when it falls on the same SF day as the
// start, and the full weekday/date otherwise.
export function popupEventDateTime(startIso: string, endIso?: string): string {
  const start = new Date(startIso)
  const startStr = `${longWeekdayFormatter.format(start)}, ${longMonthDayFormatter.format(start)}, ${shortTimeFormatter.format(start)}`
  if (!endIso) return startStr

  const end = new Date(endIso)
  const endStr =
    sfDateKey(startIso) === sfDateKey(endIso)
      ? shortTimeFormatter.format(end)
      : `${longWeekdayFormatter.format(end)}, ${longMonthDayFormatter.format(end)}, ${shortTimeFormatter.format(end)}`
  return `${startStr} – ${endStr}`
}

// "Aug 9, 7 PM" — compact date+time for constrained UI (the "?" sidebar's
// per-source event lists) where a weekday and long month name don't fit.
export function shortMonthDayTime(iso: string): string {
  const date = new Date(iso)
  const time = shortTimeFormatter.format(date).replace(':00 ', ' ')
  return `${shortMonthDayFormatter.format(date)}, ${time}`
}

// "now till 9 PM" — used in place of the usual start/end display while an
// event is currently in progress, so its remaining duration is legible at a
// glance instead of requiring the reader to compare two clock times.
export function nowTillLabel(endIso: string): string {
  return `now till ${shortTimeFormatter.format(new Date(endIso)).replace(':00 ', ' ')}`
}

// True once an event's end time has passed — drives the greyed-out,
// crossed-out "Event Ended" treatment shared by map markers, list tiles,
// and previews. Takes priority over any "in region" styling.
export function isEventEnded(end: string): boolean {
  return new Date(end).getTime() < Date.now()
}

// "now" while an event is in progress, "in x min"/"in x hr" while it's still
// ahead, null once it's over — used on map marker labels so a same-day
// event's urgency is visible without opening its details. Minutes round to
// the nearest 10 (minimum 10, so it doesn't misleadingly read "in 0 min"); 2
// hours or more rounds to the nearest hour instead.
export function relativeTimeLabel(startIso: string, endIso: string, now: Date = new Date()): string | null {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const t = now.getTime()
  if (t >= start && t <= end) return 'now'
  if (t < start) {
    const minutes = Math.max(10, Math.round((start - t) / (10 * 60 * 1000)) * 10)
    if (minutes < 120) return `in ${minutes} min`
    const hours = Math.round(minutes / 60)
    return `in ${hours} hr`
  }
  return null
}

// Status bucket for ordering a group of events by urgency: happening now
// sorts first, upcoming next, already-ended last — used by the Event view
// when several events share a marker/location.
export function eventStatusRank(startIso: string, endIso: string, now: Date = new Date()): 0 | 1 | 2 {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const t = now.getTime()
  if (t >= start && t <= end) return 0
  if (t < start) return 1
  return 2
}

const STREET_SUFFIX_RE =
  /\s+(street|st|avenue|ave|boulevard|blvd|drive|dr|road|rd|lane|ln|way|place|pl|court|ct|terrace|ter|highway|hwy)\.?$/i

// "1994 Lombard St, San Francisco, CA" -> "1994 Lombard" — just enough to
// recognize the block without the visual weight of a full address; the full
// text stays queryable via `googleMapsUrl`.
export function shortLocationLabel(location: string): string {
  const firstSegment = location.split(',')[0].trim()
  return firstSegment.replace(STREET_SUFFIX_RE, '') || firstSegment
}

export function googleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

// Trailing ", San Francisco, CA 94117", ", CA", or a bare zip — every
// combination a geocoder's display name or a manually-typed address might
// end in. Every piece is optional so partial suffixes (just a zip, just the
// city) still match, but the leading comma is required so real address
// content is never mistaken for it.
const CITY_STATE_ZIP_SUFFIX_RE =
  /,\s*(san francisco\s*,?\s*)?(ca|california)?\s*(\d{5}(-\d{4})?)?\s*(,\s*(usa|united states))?\.?\s*$/i

// "500 Divisadero St, San Francisco, CA 94117" -> "500 Divisadero St" — used
// in the event sidebar so addresses read as just the block, not a full
// mailing address. Unlike `shortLocationLabel`, this keeps every segment
// (e.g. a venue name) and only drops the trailing city/state/zip.
export function addressWithoutCityStateZip(location: string): string {
  const stripped = location.replace(CITY_STATE_ZIP_SUFFIX_RE, '').replace(/,\s*$/, '').trim()
  return stripped || location
}

// "YYYY-MM-DD" in SF time — used to group map markers by calendar day.
export function sfDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

// Hour-of-day (0-23) in SF time, the basis for the "+Time of day" filter.
// hourCycle: 'h23' (rather than hour12: false) avoids a known Intl quirk
// where midnight formats as "24" instead of "0" in some environments.
function sfHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(iso))
  )
}

// morning 5am-12pm, afternoon 12pm-5pm, evening 5pm-5am (wraps past midnight).
export function matchesTimeOfDay(startIso: string, timeOfDay: TimeOfDay): boolean {
  const hour = sfHour(startIso)
  if (timeOfDay === 'morning') return hour >= 5 && hour < 12
  if (timeOfDay === 'afternoon') return hour >= 12 && hour < 17
  return hour >= 17 || hour < 5
}

// Minutes since midnight (SF time) for the event's start — the basis for the
// "+precise time" filter's "HH:MM" bounds.
function sfMinutesOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

function timeStringToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

// Matches when the event's start time (in SF time) falls within [min, max].
// min > max wraps past midnight (e.g. 10 PM - 2 AM), mirroring matchesTimeOfDay.
export function matchesPreciseTime(startIso: string, min: string, max: string): boolean {
  const t = sfMinutesOfDay(startIso)
  const minM = timeStringToMinutes(min)
  const maxM = timeStringToMinutes(max)
  if (minM <= maxM) return t >= minM && t <= maxM
  return t >= minM || t <= maxM
}

// A subset of ApiEvent's fields — also satisfied by UnknownLocationEvent,
// so this list can render either without needing lat/lng. lat/lng stay
// optional (rather than omitted) so the list view's distance grouping can
// use them when present and fall back gracefully when not.
export type EventListItem = Pick<
  ApiEvent,
  | 'id'
  | 'calendar'
  | 'title'
  | 'start'
  | 'end'
  | 'location'
  | 'rawLocation'
  | 'approximateLocation'
  | 'description'
  | 'calendarLink'
> & { lat?: number; lng?: number }
