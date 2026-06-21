'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

const SLOT_X = 50
const SLOT_Y = 52

const LINES = [
  'Lorem ipsum dolor sit amet,',
  'consectetur adipiscing elit.',
  'Sed do eiusmod tempor',
  'incididunt ut labore et dolore',
  'magna aliqua.',
  '',
  'Ut enim ad minim veniam,',
  'quis nostrud exercitation',
  'ullamco laboris nisi ut aliquip',
  'ex ea commodo consequat.',
  '',
  'Duis aute irure dolor in',
  'reprehenderit in voluptate velit',
  'esse cillum dolore eu fugiat',
  'nulla pariatur.',
  '',
  'Excepteur sint occaecat',
  'cupidatat non proident,',
  'sunt in culpa qui officia',
  'deserunt mollit anim',
  'id est laborum.',
  '',
  'Sed ut perspiciatis unde omnis',
  'iste natus error sit voluptatem',
  'accusantium doloremque',
  'laudantium, totam rem aperiam.',
  '',
  'Eaque ipsa quae ab illo',
  'inventore veritatis et quasi',
  'architecto beatae vitae dicta',
  'sunt explicabo.',
  '',
  'Nemo enim ipsam voluptatem',
  'quia voluptas sit aspernatur',
  'aut odit aut fugit.',
  '',
  '— ❖ —',
]

const TOTAL_CHARS = LINES.reduce((sum, l) => sum + l.length + 1, 0)

// Cumulative char count at the end of each line (including the implicit newline unit)
const LINE_BOUNDARIES = LINES.reduce<number[]>((acc, line, i) => {
  acc.push((acc[i - 1] ?? 0) + line.length + 1)
  return acc
}, [])

function snapToLineBoundary(chars: number): number {
  let snapped = 0
  for (let i = 0; i < LINE_BOUNDARIES.length; i++) {
    if (LINE_BOUNDARIES[i] <= chars) {
      snapped = LINE_BOUNDARIES[i]
    } else {
      break
    }
  }
  return snapped
}

export default function HomeClient() {
  const [displayedChars, setDisplayedChars] = useState(0)
  const prevScrollRef = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const ratio = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0
      const exactChars = Math.round(ratio * TOTAL_CHARS)
      const scrollingDown = window.scrollY >= prevScrollRef.current

      setDisplayedChars(scrollingDown ? exactChars : snapToLineBoundary(exactChars))
      prevScrollRef.current = window.scrollY
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Split displayedChars into completed lines + a partial current line
  const completedLines: string[] = []
  let partialLine: string | null = null
  let acc = 0

  for (let i = 0; i < LINES.length; i++) {
    const lineLen = LINES[i].length + 1
    if (acc + lineLen <= displayedChars) {
      completedLines.push(LINES[i])
      acc += lineLen
    } else {
      const remaining = displayedChars - acc
      partialLine = LINES[i].slice(0, remaining)
      break
    }
  }

  const hasContent = completedLines.length > 0 || (partialLine !== null && partialLine.length > 0)
  const atStart = displayedChars === 0

  return (
    <div style={{ height: '350vh', position: 'relative' }}>

      {/* Fixed typewriter background */}
      <div className="fixed inset-0 bg-stone-900" style={{ zIndex: 0 }}>
        <Image
          src="/typewriter.png"
          alt="Vintage typewriter"
          fill
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      {/* Scroll-to-start hint — fades once typing begins */}
      <div
        className="fixed bottom-10 w-full flex justify-center pointer-events-none"
        style={{
          zIndex: 20,
          opacity: atStart ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-rough-typewriter)',
            fontSize: '13px',
            letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.65)',
          }}
        >
          scroll to type
        </span>
      </div>

      {/* Paper emerging from the typewriter slot */}
      {hasContent && (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 10,
            bottom: `${100 - SLOT_Y}%`,
            left: `${SLOT_X}%`,
            transform: 'translateX(-50%)',
            width: 'min(310px, 72vw)',
          }}
        >
          <div
            style={{
              background: '#f5f0e5',
              boxShadow: '2px 0 6px rgba(0,0,0,0.18), -2px 0 6px rgba(0,0,0,0.18)',
              padding: '10px 18px 0 18px',
              WebkitMaskImage: 'linear-gradient(to top, transparent 0px, black 14px)',
              maskImage: 'linear-gradient(to top, transparent 0px, black 14px)',
            }}
          >
            {completedLines.map((line, i) => (
              <div
                key={i}
                style={{
                  fontFamily: 'var(--font-rough-typewriter)',
                  fontSize: '13.5px',
                  lineHeight: '1.75',
                  color: '#1a1712',
                  minHeight: line === '' ? '1.75em' : undefined,
                  whiteSpace: 'pre',
                }}
              >
                {line || ' '}
              </div>
            ))}

            {partialLine !== null && (
              <div
                style={{
                  fontFamily: 'var(--font-rough-typewriter)',
                  fontSize: '13.5px',
                  lineHeight: '1.75',
                  color: '#1a1712',
                  whiteSpace: 'pre',
                }}
              >
                {partialLine}
                <span className="typewriter-cursor">&#x2588;</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom fade to black — sits above everything so the page bleeds into darkness */}
      <div
        className="fixed bottom-0 left-0 right-0 pointer-events-none"
        style={{
          zIndex: 30,
          height: '18vh',
          background: 'linear-gradient(to bottom, transparent 0%, black 100%)',
        }}
      />
    </div>
  )
}
