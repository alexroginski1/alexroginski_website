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
  calendarLink?: string
}

export type UnknownLocationEvent = Pick<
  ApiEvent,
  'id' | 'calendar' | 'title' | 'description' | 'start' | 'end' | 'calendarLink'
>

export type EventsResponse = {
  events: ApiEvent[]
  unknownLocationEvents: UnknownLocationEvent[]
  generatedAt: string
}
