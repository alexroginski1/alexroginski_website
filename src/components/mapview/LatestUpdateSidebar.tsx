'use client'

import { useEffect, useRef, useState } from 'react'

type LatestUpdateResponse = { message: string | null; date: string | null }

// The "!" popup — the latest entry from the "Latest Update" tab of the
// project spreadsheet, read back via /api/latest-update.
export default function LatestUpdateSidebar({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [update, setUpdate] = useState<LatestUpdateResponse | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    fetch('/api/latest-update')
      .then((res) => {
        if (!res.ok) throw new Error('failed to load latest update')
        return res.json() as Promise<LatestUpdateResponse>
      })
      .then((data) => {
        if (!cancelled) setUpdate(data)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div ref={rootRef} className="std-map-sidebar std-map-sidebar-right std-map-latest-update-sidebar">
      <button type="button" className="std-map-sidebar-close" onClick={onClose} aria-label="Close Latest Update">
        ×
      </button>

      <h2 className="stories-title">Latest Update</h2>

      {loadError ? (
        <p className="std-map-empty">Couldn&apos;t load the latest update right now — try again shortly.</p>
      ) : update === null ? (
        <p className="std-map-empty">Loading…</p>
      ) : !update.message ? (
        <p className="std-map-empty">No updates yet.</p>
      ) : (
        <div className="stories-card latest-update-card">
          {update.message}
          {update.date && <p className="stories-card-timestamp">-{update.date}</p>}
        </div>
      )}
    </div>
  )
}
