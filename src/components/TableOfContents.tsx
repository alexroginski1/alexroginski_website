'use client'

import { useEffect, useState } from 'react'

type Heading = { id: string; text: string; level: number }

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function TableOfContents() {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeId, setActiveId] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const container = document.querySelector('.std-container')
    if (!container) return

    const nodes = Array.from(container.querySelectorAll<HTMLHeadingElement>('h1, h2')).filter(
      (node) => Boolean(node.textContent?.trim()) && !node.closest('.std-hero-title')
    )

    const seen = new Map<string, number>()
    const items = nodes.map((node) => {
      const text = node.textContent!.trim()
      const base = slugify(text) || 'section'
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      if (!node.id) node.id = count === 0 ? base : `${base}-${count + 1}`
      return { id: node.id, text, level: node.tagName === 'H1' ? 1 : 2 }
    })
    setHeadings(items)

    const visibleIds = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleIds.add(entry.target.id)
          else visibleIds.delete(entry.target.id)
        })
        const topMost = nodes.find((node) => visibleIds.has(node.id))
        if (topMost) setActiveId(topMost.id)
      },
      { rootMargin: '-96px 0px -70% 0px' }
    )
    nodes.forEach((node) => observer.observe(node))

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  if (headings.length === 0) return null

  return (
    <>
      <button
        type="button"
        className="std-toc-toggle"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Hide outline' : 'Show outline'}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="14" y2="18" />
        </svg>
      </button>

      {isOpen && <div className="std-toc-backdrop" onClick={() => setIsOpen(false)} />}

      <nav className={`std-toc-panel${isOpen ? ' std-toc-panel-open' : ''}`} aria-label="Table of contents">
        <p className="std-toc-title">On this page</p>
        <ul>
          {headings.map((heading) => (
            <li key={heading.id} className={heading.level === 2 ? 'std-toc-item-nested' : undefined}>
              <a
                href={`#${heading.id}`}
                className={`std-toc-link${activeId === heading.id ? ' std-toc-link-active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  history.replaceState(null, '', `#${heading.id}`)
                  setIsOpen(false)
                }}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
