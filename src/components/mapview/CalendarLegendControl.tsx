'use client'

import { useEffect, useRef, useState } from 'react'
import type { MapCalendarKey } from '@/lib/calendarIds'
import { MAP_CALENDAR_LEGEND } from '@/lib/mapCalendarLegend'

export default function CalendarLegendControl({
  calendarKeys,
  selectedTypes,
  eventCounts,
  onToggle,
  onSelectAll,
  onClear,
  className,
}: {
  calendarKeys: MapCalendarKey[]
  selectedTypes: Set<MapCalendarKey>
  eventCounts: Record<MapCalendarKey, number>
  onToggle: (key: MapCalendarKey) => void
  onSelectAll: () => void
  onClear: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const allSelected = selectedTypes.size === calendarKeys.length

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
        className="std-map-calendar-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {allSelected ? 'all calendars' : `${selectedTypes.size} ${selectedTypes.size === 1 ? 'calendar' : 'calendars'}`}
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
          {calendarKeys.map((key) => {
            const { label, color, emoji } = MAP_CALENDAR_LEGEND[key]
            return (
              <label key={key} className="std-map-legend-item">
                <input type="checkbox" checked={selectedTypes.has(key)} onChange={() => onToggle(key)} />
                <span className="std-map-legend-dot" style={{ backgroundColor: color }}>
                  {emoji}
                </span>
                <span className="std-map-legend-label">{label}</span>
                <span className="std-map-legend-count">{eventCounts[key] ?? 0}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
