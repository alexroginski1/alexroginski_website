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

const shortTimeFormatter = new Intl.DateTimeFormat('en-US', {
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

// True once an event's end time has passed — drives the greyed-out,
// crossed-out "Event Ended" treatment shared by map markers, list tiles,
// and previews. Takes priority over any "in region" styling.
export function isEventEnded(end: string): boolean {
  return new Date(end).getTime() < Date.now()
}

// "now" while an event is in progress, "in x min"/"in x hr" while it's still
// ahead, null once it's over — used on map marker labels so a same-day
// event's urgency is visible without opening its details. Under 2 hours away
// shows minutes (rounded up to a minimum of 1) so it doesn't misleadingly
// read "in 0 hr"; 2 hours or more rounds to the nearest hour.
export function relativeTimeLabel(startIso: string, endIso: string, now: Date = new Date()): string | null {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const t = now.getTime()
  if (t >= start && t <= end) return 'now'
  if (t < start) {
    const minutes = Math.max(1, Math.round((start - t) / (60 * 1000)))
    if (minutes < 120) return `in ${minutes} min`
    const hours = Math.round(minutes / 60)
    return `in ${hours} hr`
  }
  return null
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

// A subset of ApiEvent's fields — also satisfied by UnknownLocationEvent,
// so this list can render either without needing lat/lng. lat/lng stay
// optional (rather than omitted) so the list view's distance grouping can
// use them when present and fall back gracefully when not.
export type EventListItem = Pick<
  ApiEvent,
  'id' | 'calendar' | 'title' | 'start' | 'end' | 'location' | 'description' | 'calendarLink'
> & { lat?: number; lng?: number }
