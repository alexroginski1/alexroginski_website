'use client'

import { useEffect, useRef, useState } from 'react'
import { LIST_CRITERION_LABELS, type ListCriterion } from '@/lib/mapListGrouping'

const ALL_CRITERIA: ListCriterion[] = ['time', 'source', 'distance']

// Lets the user layer multiple sort/group criteria on the list view at once.
// Click order sets priority: the first pick becomes the outermost group
// header, the last just settles final ordering — so "Distance" then "Event
// source" reads as distance bands, each split into per-source groups.
export default function SortGroupControl({
  order,
  onToggle,
  distanceAvailable,
}: {
  order: ListCriterion[]
  onToggle: (criterion: ListCriterion) => void
  distanceAvailable: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const toggleLabel =
    order.length === 0 ? 'Sort: time' : `Sort: ${order.map((criterion) => LIST_CRITERION_LABELS[criterion]).join(' → ')}`

  return (
    <div ref={rootRef} className="std-map-calendar-control">
      <button type="button" className="std-map-calendar-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {toggleLabel}
      </button>
      {open && (
        <div className="std-map-calendar-panel">
          <p className="std-map-sort-hint">Pick order sets priority — broadest group first, finest sort last.</p>
          {ALL_CRITERIA.map((criterion) => {
            const disabled = criterion === 'distance' && !distanceAvailable
            const priority = order.indexOf(criterion)
            return (
              <label
                key={criterion}
                className={`std-map-legend-item${disabled ? ' std-map-legend-item-disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={priority !== -1}
                  disabled={disabled}
                  onChange={() => onToggle(criterion)}
                />
                <span className="std-map-legend-label">{LIST_CRITERION_LABELS[criterion]}</span>
                {priority !== -1 && <span className="std-map-legend-order-badge">{priority + 1}</span>}
                {disabled && <span className="std-map-legend-count">needs +location</span>}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
