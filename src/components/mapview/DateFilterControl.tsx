'use client'

import { useEffect, useRef, useState } from 'react'

export type DatePreset = 'today' | 'tomorrow' | 'next7' | 'weekend' | 'custom'

const PRESET_OPTIONS: { preset: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { preset: 'today', label: 'today' },
  { preset: 'tomorrow', label: 'tomorrow' },
  { preset: 'next7', label: 'next 7 days' },
  { preset: 'weekend', label: 'this weekend' },
]

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "YYYY-MM-DD" -> "Nov 7"
export function formatDateKeyShort(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${MONTH_ABBR[m - 1]} ${d}`
}

// "YYYY-MM-DD" -> "11/7/26" (the format the user types in).
function dateKeyToInput(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return `${m}/${d}/${String(y).slice(-2)}`
}

// "11/7/26" (or "11/7/2026", or "11/7" for the current year) -> "2026-11-07".
// Null for anything that isn't a real calendar date.
function parseInputDate(raw: string, fallbackYear: number): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  let year = match[3] ? Number(match[3]) : fallbackYear
  if (match[3]?.length === 2) year += 2000
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null
  return dt.toISOString().slice(0, 10)
}

export default function DateFilterControl({
  label,
  activePreset,
  dateFrom,
  dateTo,
  onSelectPreset,
  onSelectRange,
  toggleClassName,
}: {
  label: string
  activePreset: DatePreset
  dateFrom: string
  dateTo: string
  onSelectPreset: (preset: Exclude<DatePreset, 'custom'>) => void
  onSelectRange: (from: string, to: string) => void
  toggleClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Prefill the range inputs with the current dates each time the menu
  // opens, so tweaking one end of an existing range doesn't mean retyping both.
  useEffect(() => {
    if (!open) return
    setFromText(dateKeyToInput(dateFrom))
    setToText(dateKeyToInput(dateTo))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function applyRange(e: React.FormEvent) {
    e.preventDefault()
    const year = Number(dateFrom.slice(0, 4))
    const from = parseInputDate(fromText, year)
    const to = parseInputDate(toText, from ? Number(from.slice(0, 4)) : year)
    if (!from || !to) {
      setError('Use a date like 11/7/26')
      return
    }
    if (to < from) {
      setError('End date is before start date')
      return
    }
    onSelectRange(from, to)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="std-map-calendar-control">
      <button
        type="button"
        className={toggleClassName ?? 'std-map-calendar-toggle'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label}
      </button>
      {open && (
        <div className="std-map-calendar-panel std-map-date-panel" role="menu">
          {PRESET_OPTIONS.map(({ preset, label: optionLabel }) => (
            <button
              key={preset}
              type="button"
              role="menuitemradio"
              aria-checked={activePreset === preset}
              className={`std-map-date-option${activePreset === preset ? ' std-map-date-option-active' : ''}`}
              onClick={() => {
                onSelectPreset(preset)
                setOpen(false)
              }}
            >
              {optionLabel}
            </button>
          ))}
          <form
            className={`std-map-date-range${activePreset === 'custom' ? ' std-map-date-option-active' : ''}`}
            onSubmit={applyRange}
          >
            <span>from</span>
            <input
              type="text"
              inputMode="numeric"
              className="std-map-date-range-input"
              placeholder="11/7/26"
              value={fromText}
              onChange={(e) => setFromText(e.target.value)}
              aria-label="Start date (M/D/YY)"
            />
            <span>to</span>
            <input
              type="text"
              inputMode="numeric"
              className="std-map-date-range-input"
              placeholder="11/9/26"
              value={toText}
              onChange={(e) => setToText(e.target.value)}
              aria-label="End date (M/D/YY)"
            />
            <button type="submit" className="std-map-legend-action">
              Go
            </button>
            {error && <p className="std-map-date-range-error">{error}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
