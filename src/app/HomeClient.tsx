'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import typewriterBg from './backgrounds/typewriter.png'

// Coordinates of the paper slot in the typewriter image (% of image dimensions).
// Image is 740x1014. The carriage/paper-feed is at roughly (50%, 42%).
// With object-fit:contain on a landscape viewport the image fills the full height,
// so these percentages map directly to viewport percentages.
const SLOT_X = 50   // % from left
const SLOT_Y = 51   // % from top

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

export default function HomeClient() {
  const [charsShown, setCharsShown] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const ratio = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0
      setCharsShown(Math.round(ratio * TOTAL_CHARS))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Split charsShown into completed lines + a partial current line
  const completedLines: string[] = []
  let partialLine: string | null = null
  let acc = 0

  for (let i = 0; i < LINES.length; i++) {
    const lineLen = LINES[i].length + 1 // +1 for implicit newline unit
    if (acc + lineLen <= charsShown) {
      completedLines.push(LINES[i])
      acc += lineLen
    } else {
      const remaining = charsShown - acc
      partialLine = LINES[i].slice(0, remaining)
      break
    }
  }

  const hasContent = completedLines.length > 0 || (partialLine !== null && partialLine.length > 0)
  const atStart = charsShown === 0

  return (
    // Scroll container — fixed bg means the user scrolls "through" the typewriter
    <div style={{ height: '350vh', position: 'relative' }}>

      {/* Fixed typewriter background */}
      <div className="fixed inset-0 bg-stone-900" style={{ zIndex: 0 }}>
        <Image
          src={typewriterBg}
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
            // Bottom edge sits exactly at the paper slot
            bottom: `${100 - SLOT_Y}%`,
            left: `${SLOT_X}%`,
            transform: 'translateX(-50%)',
            width: 'min(320px, 72vw)',
          }}
        >
          {/* Paper strip — grows upward as lines accumulate */}
          <div
            style={{
              background: '#f5f0e5',
              boxShadow: '2px 0 6px rgba(0,0,0,0.18), -2px 0 6px rgba(0,0,0,0.18)',
              padding: '10px 18px 0 18px',
              // Fade the very bottom edge so paper looks like it emerges from the slot
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
    </div>
  )
}
