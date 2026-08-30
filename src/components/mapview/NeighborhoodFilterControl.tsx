'use client'

import { useEffect, useRef, useState } from 'react'

export default function NeighborhoodFilterControl({
  neighborhoods,
  selected,
  eventCounts,
  onToggle,
  onSelectAll,
  onClear,
}: {
  neighborhoods: string[]
  selected: Set<string>
  eventCounts: Record<string, number>
  onToggle: (key: string) => void
  onSelectAll: () => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const allSelected = selected.size === neighborhoods.length

  let toggleLabel: string
  if (allSelected) {
    toggleLabel = 'all neighborhoods'
  } else if (selected.size === 1) {
    const [onlyKey] = selected
    toggleLabel = onlyKey
  } else if (selected.size > 1) {
    toggleLabel = `${selected.size} neighborhoods`
  } else {
    toggleLabel = '0 neighborhoods'
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
    <div ref={rootRef} className="std-map-calendar-control">
      <button type="button" className="std-map-sentence-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
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
          {neighborhoods.map((key) => (
            <label key={key} className="std-map-legend-item">
              <input type="checkbox" checked={selected.has(key)} onChange={() => onToggle(key)} />
              <span className="std-map-legend-label">{key}</span>
              <span className="std-map-legend-count">{eventCounts[key] ?? 0}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
