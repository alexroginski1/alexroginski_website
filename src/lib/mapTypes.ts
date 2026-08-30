import type { MapCalendarKey } from './calendarIds'

export type ApiEvent = {
  id: string
  calendar: MapCalendarKey
  // The specific source within a calendar (e.g. a calendar's individual
  // contributing Eventbrite/Luma page) — finer-grained than `calendar`,
  // used to sub-filter within a calendar's checkbox in the UI.
  eventSource: string
  title: string
  description?: string
  location?: string
  // The venue's original, uncleaned text (e.g. "The Function") — often more
  // recognizable than the geocoded address in `location`, so it's shown
  // alongside it rather than in place of it.
  rawLocation?: string
  // True when the source only pinned this event down to a neighborhood
  // rather than an exact address — lat/lng are still a reasonable point
  // within that area, but the UI should mark it as approximate.
  approximateLocation?: boolean
  start: string
  end: string
  lat: number
  lng: number
  calendarLink?: string
  // The source's own neighborhood label (e.g. "Hayes Valley") — coarser
  // than the geocoded address but often more recognizable.
  neighborhood?: string
  // The original event listing (Eventbrite/Luma/Meetup/etc.), separate from
  // calendarLink which only ever points at "+ Add to Google Calendar".
  eventLink?: string
}

export type UnknownLocationEvent = Pick<
  ApiEvent,
  | 'id'
  | 'calendar'
  | 'eventSource'
  | 'title'
  | 'description'
  | 'rawLocation'
  | 'start'
  | 'end'
  | 'calendarLink'
  | 'neighborhood'
  | 'eventLink'
>

export type EventsResponse = {
  events: ApiEvent[]
  unknownLocationEvents: UnknownLocationEvent[]
  generatedAt: string
}

export type EventSourceEventSummary = {
  title: string
  start: string
  calendarLink?: string
}

export type EventSourceBreakdown = {
  key: MapCalendarKey
  label: string
  count: number
  eventSources: {
    label: string
    count: number
    events: EventSourceEventSummary[]
  }[]
}

export type EventSourcesResponse = {
  calendars: EventSourceBreakdown[]
  totalCount: number
  totalSourceCount: number
  generatedAt: string
}
