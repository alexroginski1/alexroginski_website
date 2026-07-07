'use client'

import { useState } from 'react'

export type CalendarSource = {
  label: string
  emoji: string
  display_url?: string
  location?: string
  location_link?: string
}

export default function CalendarSourceGroup({
  label,
  sources,
}: {
  label: string
  sources: CalendarSource[]
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="calendar-source-group">
      <button
        type="button"
        className="calendar-link-row calendar-source-toggle"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="calendar-link-toggle">{expanded ? '−' : '+'}</span>
        <span>{label}</span>
      </button>
      {expanded && (
        <ul className="calendar-link-sources">
          {sources.map((source) => (
            <li key={source.display_url ?? source.label}>
              {source.emoji}{' '}
              {source.display_url ? (
                <a href={source.display_url}>{source.label}</a>
              ) : (
                source.label
              )}
              {source.location && (
                <>
                  {' '}
                  (
                  {source.location_link ? (
                    <a href={source.location_link}>{source.location}</a>
                  ) : (
                    source.location
                  )}
                  )
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
