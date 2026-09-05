'use client'

import { useEffect, useRef, useState } from 'react'

export type DatePreset = 'today' | 'tomorrow' | 'weekend' | 'next3' | 'next7' | 'all' | 'custom'

// The presets offered in the dropdown, in menu order. 'custom' is omitted —
// it isn't something you pick, it's what the sentence falls back to when the
// date range doesn't match any preset.
const DATE_PRESET_OPTIONS: { preset: DatePreset; label: string }[] = [
  { preset: 'today', label: 'today' },
  { preset: 'tomorrow', label: 'tomorrow' },
  { preset: 'weekend', label: 'this weekend' },
  { preset: 'next3', label: 'in the next 3 days' },
  { preset: 'next7', label: 'in the next 7 days' },
  { preset: 'all', label: 'any day' },
]

export default function DatePresetControl({
  label,
  activePreset,
  onSelect,
  toggleClassName,
}: {
  label: string
  activePreset: DatePreset
  onSelect: (preset: DatePreset) => void
  toggleClassName?: string
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

  return (
    <div ref={rootRef} className="std-map-calendar-control">
      <button
        type="button"
        className={toggleClassName ?? 'std-map-calendar-toggle'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <div className="std-map-calendar-panel">
          {DATE_PRESET_OPTIONS.map(({ preset, label: optionLabel }) => (
            <button
              key={preset}
              type="button"
              className={`std-map-legend-item text-left${preset === activePreset ? ' font-semibold text-orange-600' : ''}`}
              onClick={() => {
                onSelect(preset)
                setOpen(false)
              }}
            >
              {optionLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
