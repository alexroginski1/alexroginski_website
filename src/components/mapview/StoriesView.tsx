'use client'

import { useEffect, useRef, useState } from 'react'

// Opens the Google Form in a new tab rather than embedding it — the
// sidebar is only 360px wide, too narrow for the form to read well inline.
// Responses land directly in the linked Google Sheet, which /api/stories
// reads back out below.
const STORY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScRiuI8iFmpQKyQwSsiDeaMWOnrQht_Kv4XmFhlgFTT7kyGyw/viewform'

const PASTEL_COLORS = ['#FDE2E4', '#DFE7FD', '#E2F0CB', '#FFF1E6', '#E2ECE9', '#FDE2FF', '#F0EFEB', '#BEE1E6']

type StoriesResponse = { stories: string[] }

export default function StoriesView({ onClose }: { onClose: () => void }) {
  const [stories, setStories] = useState<string[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    fetch('/api/stories')
      .then((res) => {
        if (!res.ok) throw new Error('failed to load stories')
        return res.json() as Promise<StoriesResponse>
      })
      .then((data) => {
        if (!cancelled) setStories(data.stories)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div ref={rootRef} className="std-map-sidebar std-map-sidebar-right std-map-stories-sidebar">
      <button type="button" className="std-map-sidebar-close" onClick={onClose} aria-label="Close Our Stories">
        ×
      </button>

      <h2 className="stories-title">Our Stories</h2>

      <a href={STORY_FORM_URL} target="_blank" rel="noopener noreferrer" className="stories-submit-btn">
        Submit Story
      </a>

      {loadError ? (
        <p className="std-map-empty">Couldn&apos;t load stories right now — try again shortly.</p>
      ) : stories === null ? (
        <p className="std-map-empty">Loading stories…</p>
      ) : stories.length === 0 ? (
        <p className="std-map-empty">No stories yet — be the first to share one!</p>
      ) : (
        <div className="stories-list">
          {stories.map((story, i) => (
            <div key={i} className="stories-card" style={{ backgroundColor: PASTEL_COLORS[i % PASTEL_COLORS.length] }}>
              {story}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
