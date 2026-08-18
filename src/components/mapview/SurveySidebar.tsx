'use client'

import { useEffect, useRef } from 'react'

const SURVEY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdQuwAss0dcSKJIjshpGflb-fBXi3msfpcc7FCUPqr8nKstQg/viewform?embedded=true'

// The raised-hand popup — an embedded Google Form for quick feedback.
export default function SurveySidebar({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [onClose])

  return (
    <div ref={rootRef} className="std-map-sidebar std-map-sidebar-right std-map-survey-sidebar">
      <button type="button" className="std-map-sidebar-close" onClick={onClose} aria-label="Close survey">
        ×
      </button>

      <iframe
        src={SURVEY_FORM_URL}
        className="std-map-survey-iframe"
        title="Quick feedback survey"
      >
        Loading…
      </iframe>
    </div>
  )
}
