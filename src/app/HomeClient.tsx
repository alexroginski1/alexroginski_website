'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const SLOT_X = 50
const SLOT_Y = 52

type Line = { text: string; href?: string }

const LINES: Line[] = [
  { text: '  FIRST NATIONAL BANK' },
  { text: '    OF CALIFORNIA' },
  { text: '  SAN FRANCISCO BRANCH' },
  { text: '' },
  { text: '---' },
  { text: '' },
  { text: '  STATEMENT OF ACCOUNT' },
  { text: '' },
  { text: '---' },
  { text: '' },
  { text: 'ACCOUNT HOLDER:' },
  { text: '' },
  { text: '  ROGINSKI, ALEX' },
  { text: '  SAN FRANCISCO, CA' },
  { text: '' },
  { text: 'DATE:     JUNE 1950' },
  { text: 'ACCT NO:  SF-0042-7719' },
  { text: '' },
  { text: '---' },
  { text: '' },
  { text: 'ACCOUNT SUMMARY' },
  { text: '' },
  { text: '  OPENING BAL... $   0.00' },
  { text: '  DEPOSITS...... $   0.00' },
  { text: '  WITHDRAWALS... $   0.00' },
  { text: '  CLOSING BAL... $   0.00' },
  { text: '' },
  { text: '---' },
  { text: '' },
  { text: 'OUTSTANDING BILLS' },
  { text: '' },
  { text: '  THINGS TO ACCOMPLISH' },
  { text: '  AMT: CONSIDERABLE' },
  { text: '' },
  { text: '  >> VIEW BILL <<', href: '/stuff_to_do' },
  { text: '' },
  { text: '---' },
  { text: '' },
  { text: '  FIRST NATIONAL BANK' },
  { text: '    OF CALIFORNIA' },
  { text: '  EST. 1906' },
  { text: '  * MEMBER FDIC *' },
]

const TOTAL_CHARS = LINES.reduce((sum, l) => sum + l.text.length + 1, 0)

const LINE_BOUNDARIES = LINES.reduce<number[]>((acc, line, i) => {
  acc.push((acc[i - 1] ?? 0) + line.text.length + 1)
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

const BANK_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-f25)',
  fontSize: '12px',
  lineHeight: '1.85',
  color: '#1a1712',
  whiteSpace: 'pre',
  letterSpacing: '0.03em',
}

function renderLine(line: Line, displayText: string, showCursor: boolean, key: number) {
  const isLink = !!line.href && !showCursor

  const inner = isLink ? (
    <Link
      href={line.href!}
      style={{ color: '#1a1712', textDecoration: 'underline', pointerEvents: 'auto' }}
    >
      {displayText || ' '}
    </Link>
  ) : (
    <>
      {displayText || ' '}
      {showCursor && <span className="typewriter-cursor">&#x2588;</span>}
    </>
  )

  return (
    <div
      key={key}
      style={{
        ...BANK_STYLE,
        minHeight: displayText === '' ? '1.85em' : undefined,
        pointerEvents: isLink ? 'auto' : undefined,
      }}
    >
      {inner}
    </div>
  )
}

export default function HomeClient() {
  const [displayedChars, setDisplayedChars] = useState(0)
  const prevCharsRef = useRef(0)
  const prevScrollRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const lastPlayedRef = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      // Bootstrap AudioContext on first user scroll (required by browser policy)
      if (!audioCtxRef.current) {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        audioCtxRef.current = ctx
        fetch('/sounds/typewriter_keypress.wav')
          .then(r => r.arrayBuffer())
          .then(buf => ctx.decodeAudioData(buf))
          .then(decoded => { audioBufferRef.current = decoded })
          .catch(() => {})
      }

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

  // Play keypress sound whenever new characters are revealed
  useEffect(() => {
    if (displayedChars <= prevCharsRef.current) {
      prevCharsRef.current = displayedChars
      return
    }
    prevCharsRef.current = displayedChars

    if (!audioCtxRef.current || !audioBufferRef.current || displayedChars === 0) return
    const now = Date.now()
    if (now - lastPlayedRef.current < 50) return
    lastPlayedRef.current = now

    const source = audioCtxRef.current.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(audioCtxRef.current.destination)
    source.start()
  }, [displayedChars])

  const completedLines: Line[] = []
  let partialEntry: { line: Line; partial: string } | null = null
  let acc = 0

  for (let i = 0; i < LINES.length; i++) {
    const lineLen = LINES[i].text.length + 1
    if (acc + lineLen <= displayedChars) {
      completedLines.push(LINES[i])
      acc += lineLen
    } else {
      const remaining = displayedChars - acc
      partialEntry = { line: LINES[i], partial: LINES[i].text.slice(0, remaining) }
      break
    }
  }

  const hasContent = completedLines.length > 0 || (partialEntry !== null && partialEntry.partial.length > 0)
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

      {/* Scroll hint */}
      <div
        className="fixed bottom-10 w-full flex justify-center pointer-events-none"
        style={{ zIndex: 20, opacity: atStart ? 1 : 0, transition: 'opacity 0.6s ease' }}
      >
        <span style={{
          fontFamily: 'var(--font-rough-typewriter)',
          fontSize: '13px',
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.65)',
        }}>
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
            {completedLines.map((line, i) => renderLine(line, line.text, false, i))}
            {partialEntry !== null && renderLine(partialEntry.line, partialEntry.partial, true, completedLines.length)}
          </div>
        </div>
      )}

      {/* Bottom fade to black */}
      <div
        className="fixed bottom-0 left-0 right-0 pointer-events-none"
        style={{ zIndex: 30, height: '18vh', background: 'linear-gradient(to bottom, transparent 0%, black 100%)' }}
      />
    </div>
  )
}
