import type { MapCalendarKey } from './calendarIds'

export type ApiEvent = {
  id: string
  calendar: MapCalendarKey
  title: string
  description?: string
  location?: string
  // The venue's original, uncleaned text (e.g. "The Function") — often more
  // recognizable than the geocoded address in `location`, so it's shown
  // alongside it rather than in place of it.
  rawLocation?: string
  start: string
  end: string
  lat: number
  lng: number
  calendarLink?: string
}

export type UnknownLocationEvent = Pick<
  ApiEvent,
  'id' | 'calendar' | 'title' | 'description' | 'rawLocation' | 'start' | 'end' | 'calendarLink'
>

export type EventsResponse = {
  events: ApiEvent[]
  unknownLocationEvents: UnknownLocationEvent[]
  generatedAt: string
}
