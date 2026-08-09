'use client'

import { useMemo } from 'react'
import type { ApiEvent } from '@/lib/mapTypes'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function UpvoteButton({
  count,
  voted,
  onToggle,
}: {
  count: number
  voted: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`std-upvote-btn${voted ? ' std-upvote-btn-active' : ''}`}
      onClick={onToggle}
      aria-pressed={voted}
      aria-label={voted ? 'Remove upvote' : 'Upvote this event'}
    >
      <span className="std-upvote-arrow" aria-hidden="true">
        ▲
      </span>
      <span className="std-upvote-count">{count}</span>
    </button>
  )
}

// A subset of ApiEvent's fields — also satisfied by UnknownLocationEvent,
// so this list can render either without needing lat/lng.
type EventListItem = Pick<ApiEvent, 'id' | 'calendar' | 'title' | 'start' | 'location'>

export default function EventsList({
  events,
  upvoteCounts,
  votedEventIds,
  onToggleUpvote,
}: {
  events: EventListItem[]
  upvoteCounts: Record<string, number>
  votedEventIds: Set<string>
  onToggleUpvote: (eventId: string) => void
}) {
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events]
  )

  if (sortedEvents.length === 0) return null

  return (
    <ul className="std-event-list">
      {sortedEvents.map((event) => {
        const legend = MAP_CALENDAR_LEGEND[event.calendar]
        return (
          <li key={event.id} className="std-event-item">
            <div className="std-event-item-main">
              <div className="std-event-item-title-row">
                <span className="std-event-item-dot" style={{ backgroundColor: legend.color }} />
                <span className="std-event-item-title">{event.title}</span>
              </div>
              <div className="std-event-item-meta">
                {dateTimeFormatter.format(new Date(event.start))}
                {event.location ? ` · ${event.location}` : ''}
              </div>
            </div>
            <UpvoteButton
              count={upvoteCounts[event.id] ?? 0}
              voted={votedEventIds.has(event.id)}
              onToggle={() => onToggleUpvote(event.id)}
            />
          </li>
        )
      })}
    </ul>
  )
}
