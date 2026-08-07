import type { MapCalendarKey } from './calendarIds'

export type ApiEvent = {
  id: string
  calendar: MapCalendarKey
  title: string
  description?: string
  location?: string
  start: string
  end: string
  lat: number
  lng: number
}

export type EventsResponse = {
  weekCount: number
  events: ApiEvent[]
  generatedAt: string
  calendarsFetched: MapCalendarKey[]
  errors: { calendar: MapCalendarKey; error: string }[]
}
