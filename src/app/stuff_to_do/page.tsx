import type { Metadata } from 'next'
import EventsMapSection from '@/components/mapview/EventsMapSection'

export const metadata: Metadata = {
  title: 'Stuff To Do SF',
  description: 'Making it easier to find free community events in San Francisco.',
}

export default function StuffToDo() {
  return <EventsMapSection />
}
