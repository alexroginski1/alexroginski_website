'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type DatePreset = 'today' | 'tomorrow' | 'next7' | 'weekend' | 'custom'

const PRESET_OPTIONS: { preset: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { preset: 'today', label: 'Today' },
  { preset: 'tomorrow', label: 'Tomorrow' },
  { preset: 'weekend', label: 'This weekend' },
  { preset: 'next7', label: 'Next 7 days' },
]

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseKey(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number)
  return [y, m, d]
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// "YYYY-MM-DD" -> "Mon, Nov 3"
export function formatDateKeyShort(key: string): string {
  const [y, m, d] = parseKey(key)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${WEEKDAY_ABBR[dow]}, ${MONTH_ABBR[m - 1]} ${d}`
}

function formatSelection(from: string, to: string | null): string {
  if (!to || to === from) return formatDateKeyShort(from)
  return `${formatDateKeyShort(from)} – ${formatDateKeyShort(to)}`
}

// Cells for a Sunday-first month grid; null = blank leading cell.
function monthCells(year: number, month: number): (string | null)[] {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (string | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toKey(year, month, d))
  return cells
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' | 'down' }) {
  const d = dir === 'left' ? 'M10 3L5 8l5 5' : dir === 'right' ? 'M6 3l5 5-5 5' : 'M3 6l5 5 5-5'
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DateFilterControl({
  label,
  today,
  activePreset,
  dateFrom,
  dateTo,
  onSelectPreset,
  onSelectRange,
  toggleClassName,
}: {
  label: string
  /** Today's "YYYY-MM-DD" key; earlier days can't be picked. */
  today: string
  activePreset: DatePreset
  dateFrom: string
  dateTo: string
  onSelectPreset: (preset: Exclude<DatePreset, 'custom'>) => void
  onSelectRange: (from: string, to: string) => void
  toggleClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // In-progress selection in the calendar. First click sets start; a second
  // click on a later day sets end (a range); clicking again starts over.
  const [start, setStart] = useState<string | null>(null)
  const [end, setEnd] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [viewYear, setViewYear] = useState(() => parseKey(today)[0])
  const [viewMonth, setViewMonth] = useState(() => parseKey(today)[1])
  const rootRef = useRef<HTMLDivElement>(null)

  // Each time the menu opens, reflect the current filter: a custom range
  // opens straight into the calendar with that range selected.
  useEffect(() => {
    if (!open) return
    const isCustom = activePreset === 'custom'
    setPickerOpen(isCustom)
    setStart(isCustom ? dateFrom : null)
    setEnd(isCustom && dateTo !== dateFrom ? dateTo : null)
    setHover(null)
    const [y, m] = parseKey(isCustom ? dateFrom : today)
    setViewYear(y)
    setViewMonth(m)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const cells = useMemo(() => monthCells(viewYear, viewMonth), [viewYear, viewMonth])
  const [todayY, todayM] = parseKey(today)
  const canGoPrev = viewYear > todayY || (viewYear === todayY && viewMonth > todayM)

  function shiftMonth(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  function clickDay(key: string) {
    if (!start || end || key < start) {
      setStart(key)
      setEnd(null)
    } else if (key === start) {
      setEnd(null)
    } else {
      setEnd(key)
    }
  }

  function apply() {
    if (!start) return
    onSelectRange(start, end ?? start)
    setOpen(false)
  }

  // Range shown in the grid: the committed end, or a hover preview while
  // the user is choosing the second day.
  const previewEnd = end ?? (start && hover && hover > start ? hover : null)

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
        <div className="std-date-menu" role="menu">
          {PRESET_OPTIONS.map(({ preset, label: optionLabel }) => {
            const active = activePreset === preset
            return (
              <button
                key={preset}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`std-date-menu-item${active ? ' std-date-menu-item-active' : ''}`}
                onClick={() => {
                  onSelectPreset(preset)
                  setOpen(false)
                }}
              >
                <span className="std-date-menu-check">{active && <Check />}</span>
                <span className="flex-1">{optionLabel}</span>
              </button>
            )
          })}

          <div className="std-date-menu-divider" />

          <button
            type="button"
            role="menuitemradio"
            aria-checked={activePreset === 'custom'}
            aria-expanded={pickerOpen}
            className={`std-date-menu-item${activePreset === 'custom' ? ' std-date-menu-item-active' : ''}`}
            onClick={() => setPickerOpen((v) => !v)}
          >
            <span className="std-date-menu-check">{activePreset === 'custom' && <Check />}</span>
            <span className="flex-1">Specific date…</span>
            <span className={`std-date-menu-chevron${pickerOpen ? ' rotate-180' : ''}`}>
              <Chevron dir="down" />
            </span>
          </button>

          {pickerOpen && (
            <div className="std-date-picker">
              <div className="std-date-picker-header">
                <button
                  type="button"
                  className="std-date-picker-nav"
                  onClick={() => shiftMonth(-1)}
                  disabled={!canGoPrev}
                  aria-label="Previous month"
                >
                  <Chevron dir="left" />
                </button>
                <span className="std-date-picker-month">
                  {MONTH_FULL[viewMonth - 1]} {viewYear}
                </span>
                <button
                  type="button"
                  className="std-date-picker-nav"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                >
                  <Chevron dir="right" />
                </button>
              </div>

              <div className="std-date-picker-grid" onMouseLeave={() => setHover(null)}>
                {WEEKDAY_ABBR.map((w) => (
                  <span key={w} className="std-date-picker-weekday">
                    {w.slice(0, 2)}
                  </span>
                ))}
                {cells.map((key, i) => {
                  if (!key) return <span key={`blank-${i}`} />
                  const past = key < today
                  const isStart = key === start
                  const isEnd = key === previewEnd
                  const inRange = !!start && !!previewEnd && key > start && key < previewEnd
                  const cls = [
                    'std-date-picker-day',
                    key === today && 'std-date-picker-today',
                    inRange && 'std-date-picker-in-range',
                    (isStart || isEnd) && 'std-date-picker-selected',
                    isEnd && !end && 'std-date-picker-preview',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <button
                      key={key}
                      type="button"
                      className={cls}
                      disabled={past}
                      onClick={() => clickDay(key)}
                      onMouseEnter={() => setHover(key)}
                      aria-label={formatDateKeyShort(key)}
                      aria-pressed={isStart || key === end}
                    >
                      {parseKey(key)[2]}
                    </button>
                  )
                })}
              </div>

              <div className="std-date-picker-footer">
                <span className="std-date-picker-summary">
                  {start
                    ? formatSelection(start, end)
                    : 'Pick a day'}
                  <span className="std-date-picker-hint">
                    {!start
                      ? 'Tap a second day for a range'
                      : end
                        ? 'Tap a day to start over'
                        : 'Tap a later day to make a range'}
                  </span>
                </span>
                <button type="button" className="std-date-picker-apply" onClick={apply} disabled={!start}>
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
