'use client'

import { useMemo } from 'react'
import type { ApiEvent } from '@/lib/mapTypes'
import { MAP_CALENDAR_LEGEND, RADIUS_HIGHLIGHT_COLOR } from '@/lib/mapCalendarLegend'

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

// "Mon 5:30 PM" / "Sat 10 AM" — used for the map marker labels, which are
// too small for the fuller `dateTimeFormatter` output.
export function shortEventDateTime(iso: string): string {
  const date = new Date(iso)
  const time = shortTimeFormatter.format(date).replace(':00 ', ' ')
  return `${shortWeekdayFormatter.format(date)} ${time}`
}

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
export type EventListItem = Pick<
  ApiEvent,
  'id' | 'calendar' | 'title' | 'start' | 'end' | 'location' | 'description'
>

export default function EventsList({
  events,
  upvoteCounts,
  votedEventIds,
  onToggleUpvote,
  onSelectEvent,
  highlightedEventIds = null,
}: {
  events: EventListItem[]
  upvoteCounts: Record<string, number>
  votedEventIds: Set<string>
  onToggleUpvote: (eventId: string) => void
  onSelectEvent: (event: EventListItem) => void
  // Events within the travel radius — shown bolded and pinned to the top.
  highlightedEventIds?: Set<string> | null
}) {
  const sortedEvents = useMemo(() => {
    const byStart = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    if (!highlightedEventIds) return byStart
    const within = byStart.filter((event) => highlightedEventIds.has(event.id))
    const outside = byStart.filter((event) => !highlightedEventIds.has(event.id))
    return [...within, ...outside]
  }, [events, highlightedEventIds])

  if (sortedEvents.length === 0) return null

  return (
    <ul className="std-event-list">
      {sortedEvents.map((event) => {
        const legend = MAP_CALENDAR_LEGEND[event.calendar]
        const highlighted = highlightedEventIds?.has(event.id) ?? false
        return (
          <li
            key={event.id}
            className="std-event-item"
            style={highlighted ? { backgroundColor: RADIUS_HIGHLIGHT_COLOR } : undefined}
          >
            <button type="button" className="std-event-item-main" onClick={() => onSelectEvent(event)}>
              <div className="std-event-item-title-row">
                <span className="std-event-item-dot" style={{ backgroundColor: legend.color }} />
                <span className={`std-event-item-title${highlighted ? ' font-bold' : ''}`}>{event.title}</span>
              </div>
              <div className="std-event-item-meta">
                {dateTimeFormatter.format(new Date(event.start))}
                {event.location ? ` · ${event.location}` : ''}
              </div>
            </button>
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
