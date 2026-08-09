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

// "Monday, August 9, 10:00 AM" — used in the map marker popup, where a bare
// time is ambiguous once events from more than one day are on screen.
export function popupEventDateTime(iso: string): string {
  const date = new Date(iso)
  return `${longWeekdayFormatter.format(date)}, ${longMonthDayFormatter.format(date)}, ${shortTimeFormatter.format(date)}`
}

// True once an event's end time has passed — drives the greyed-out,
// crossed-out "Event Ended" treatment shared by map markers, list tiles,
// and previews. Takes priority over any "in region" styling.
export function isEventEnded(end: string): boolean {
  return new Date(end).getTime() < Date.now()
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
// so this list can render either without needing lat/lng.
export type EventListItem = Pick<
  ApiEvent,
  'id' | 'calendar' | 'title' | 'start' | 'end' | 'location' | 'description'
>
