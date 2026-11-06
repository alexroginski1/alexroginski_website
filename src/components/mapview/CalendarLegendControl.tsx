'use client'

import { useEffect, useRef, useState } from 'react'
import type { MapCalendarKey } from '@/lib/calendarIds'
import { getCalendarStyle } from '@/lib/mapCalendarLegend'

// Composite key joining a calendar and one of its event sources — keeps
// per-source selection state flat (a single Set) instead of a nested map,
// since sources are only ever looked up by (calendar, source) together.
export function eventSourceKey(calendar: MapCalendarKey, source: string): string {
  return `${calendar}::${source}`
}

export default function CalendarLegendControl({
  calendarKeys,
  selectedTypes,
  eventCounts,
  onToggle,
  onSelectAll,
  onClear,
  eventSourcesByCalendar,
  eventSourceCounts,
  excludedEventSources,
  onToggleEventSource,
  className,
  toggleClassName,
}: {
  calendarKeys: MapCalendarKey[]
  selectedTypes: Set<MapCalendarKey>
  eventCounts: Record<MapCalendarKey, number>
  onToggle: (key: MapCalendarKey) => void
  onSelectAll: () => void
  onClear: () => void
  // Per-calendar list of its distinct event sources that currently have at
  // least one matching event — sources with zero events are pre-filtered
  // out by the caller rather than hidden here, so this list is exactly
  // what should render.
  eventSourcesByCalendar: Record<MapCalendarKey, string[]>
  eventSourceCounts: Record<string, number>
  excludedEventSources: Set<string>
  onToggleEventSource: (calendar: MapCalendarKey, source: string) => void
  className?: string
  toggleClassName?: string
}) {
  const [open, setOpen] = useState(false)
  // Any number of calendars' source lists can be open at once — the panel
  // scrolls (see .std-map-calendar-panel's max-height) rather than limiting
  // expansion to one at a time.
  const [expandedCalendars, setExpandedCalendars] = useState<Set<MapCalendarKey>>(() => new Set())
  const rootRef = useRef<HTMLDivElement>(null)
  const allSelected = selectedTypes.size === calendarKeys.length

  function toggleExpanded(key: MapCalendarKey) {
    setExpandedCalendars((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Busiest calendars (and sources within a calendar) first. Sorted on
  // per-source counts, which ignore the source checkboxes, rather than on
  // eventCounts, which don't — otherwise unchecking a source would shrink
  // its calendar's count and make the row jump out from under the cursor.
  const sourceTotal = (key: MapCalendarKey) =>
    (eventSourcesByCalendar[key] ?? []).reduce((sum, source) => sum + (eventSourceCounts[eventSourceKey(key, source)] ?? 0), 0)
  const sortedCalendarKeys = [...calendarKeys].sort((a, b) => sourceTotal(b) - sourceTotal(a) || a.localeCompare(b))
  const sortedSources = (key: MapCalendarKey) =>
    [...(eventSourcesByCalendar[key] ?? [])].sort(
      (a, b) =>
        (eventSourceCounts[eventSourceKey(key, b)] ?? 0) - (eventSourceCounts[eventSourceKey(key, a)] ?? 0) ||
        a.localeCompare(b),
    )

  let toggleLabel: string
  if (allSelected) {
    toggleLabel = 'all types of'
  } else if (selectedTypes.size === 1) {
    const [onlyKey] = selectedTypes
    toggleLabel = getCalendarStyle(onlyKey).label
  } else if (selectedTypes.size > 1) {
    toggleLabel = `${selectedTypes.size} types of`
  } else {
    toggleLabel = '0 calendars'
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className={`std-map-calendar-control${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={toggleClassName ?? 'std-map-calendar-toggle'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {toggleLabel}
      </button>
      {open && (
        <div className="std-map-calendar-panel">
          <div className="std-map-legend-actions">
            <button type="button" className="std-map-legend-action" onClick={onSelectAll}>
              Select all
            </button>
            <button type="button" className="std-map-legend-action" onClick={onClear}>
              Clear
            </button>
          </div>
          {sortedCalendarKeys.map((key) => {
            const { label, color, emoji } = getCalendarStyle(key)
            const sources = sortedSources(key)
            const hasSubfilter = sources.length > 0
            const isExpanded = expandedCalendars.has(key)
            return (
              <div key={key}>
                <div className="std-map-legend-row">
                  <label className="std-map-legend-item flex-1">
                    <input type="checkbox" checked={selectedTypes.has(key)} onChange={() => onToggle(key)} />
                    <span className="std-map-legend-dot" style={{ backgroundColor: color }}>
                      {emoji}
                    </span>
                    <span className="std-map-legend-label">{label}</span>
                    <span className="std-map-legend-count">{eventCounts[key] ?? 0}</span>
                  </label>
                  {/* Always reserve this slot's width, even when there's no subfilter to
                      expand — otherwise a row without the button renders its count column
                      ~28px further right than rows that have one, breaking the vertical
                      alignment of counts across the whole legend. */}
                  {hasSubfilter ? (
                    <button
                      type="button"
                      className="std-map-legend-expand"
                      onClick={() => toggleExpanded(key)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `Hide ${label} event sources` : `Show ${label} event sources`}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  ) : (
                    <span className="std-map-legend-expand-spacer" aria-hidden="true" />
                  )}
                </div>
                {hasSubfilter && isExpanded && (
                  <div className="std-map-legend-subpanel">
                    {sources.map((source) => {
                      const compositeKey = eventSourceKey(key, source)
                      return (
                        <label key={source} className="std-map-legend-subitem">
                          <input
                            type="checkbox"
                            checked={!excludedEventSources.has(compositeKey)}
                            onChange={() => onToggleEventSource(key, source)}
                          />
                          <span className="std-map-legend-label">{source}</span>
                          <span className="std-map-legend-count">{eventSourceCounts[compositeKey] ?? 0}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
