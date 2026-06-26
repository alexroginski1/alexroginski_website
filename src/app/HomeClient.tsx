'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

// Corners of the paper area as fractions of the image's natural dimensions (4187×2722).
// Adjust these to reposition or resize the paper overlay relative to the typewriter photo.
const PAPER_BL = { x: 0.512, y: 0.607 } // bottom-left corner of the paper slot
const PAPER_TR = { x: 0.718, y: 0.350 } // top-right corner of the paper slot
const IMAGE_W = 4187
const IMAGE_H = 2722

type SlotPos = { leftPx: number; widthPx: number; maxHeightPx: number; bottomPx: number }

function calcDesktopSlot(vpW: number, vpH: number): SlotPos {
  const scale = Math.max(vpW / IMAGE_W, vpH / IMAGE_H)
  const rendW = IMAGE_W * scale
  const rendH = IMAGE_H * scale
  const offsetX = (vpW - rendW) / 2
  const offsetY = (vpH - rendH) / 2
  return {
    leftPx: offsetX + PAPER_BL.x * rendW,
    widthPx: (PAPER_TR.x - PAPER_BL.x) * rendW,
    maxHeightPx: (PAPER_BL.y - PAPER_TR.y) * rendH,
    bottomPx: vpH - (offsetY + PAPER_BL.y * rendH),
  }
}

function calcMobileSlot(vpW: number, vpH: number): SlotPos {
  // cover: scale so the image fills the viewport, centered
  const scale = Math.max(vpW / IMAGE_W, vpH / IMAGE_H)
  const rendW = IMAGE_W * scale
  const rendH = IMAGE_H * scale
  const offsetX = (vpW - rendW) / 2
  const offsetY = (vpH - rendH) / 2
  return {
    leftPx: offsetX + PAPER_BL.x * rendW,
    widthPx: (PAPER_TR.x - PAPER_BL.x) * rendW,
    maxHeightPx: (PAPER_BL.y - PAPER_TR.y) * rendH,
    bottomPx: vpH - (offsetY + PAPER_BL.y * rendH),
  }
}


type Line = { text: string; href?: string; font?: 'moms' | 'rough'; newTab?: boolean }

const LINES: Line[] = [
  { text: 'BANK STATEMENT', font: 'moms' },
  { text: '---------------', font: 'moms' },
  { text: 'ACCOUNT HOLDER', font: 'rough' },
  { text: '  ALEX ROGINSKI', font: 'moms' },
  { text: '  SAN FRANCISCO, CA', font: 'moms' },
  { text: '---------------', font: 'moms' },
  { text: 'ACCOUNT SUMMARY', font: 'rough' },
  { text: '  SF STUFF TO DO', href: '/stuff_to_do', font: 'moms', newTab: true },
  { text: '  APP BLOCKER SETUP', href: '/screenzen_iphone', font: 'moms' },
  { text: '---------------', font: 'moms' },
  { text: '  LINKEDIN', href: 'https://linkedin.com/in/alex-roginski-68b40219a', font: 'moms' },
  { text: '  RESUME', href: '/resume', font: 'moms', newTab: true },
  { text: '---------------', font: 'moms' },

]

const MUSIC_VOLUME = 0.03
const CAFE_NOISE_VOLUME = 0.1
const TYPEWRITER_VOLUME = 0.1

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

function lineStyle(font: 'moms' | 'rough' = 'moms'): React.CSSProperties {
  return {
    fontFamily: font === 'moms' ? 'var(--font-moms-typewriter)' : 'var(--font-rough-typewriter)',
    fontSize: '12px',
    lineHeight: '1.85',
    color: '#1a1712',
    whiteSpace: 'pre-wrap',
    letterSpacing: '0.03em',
  }
}

function renderLine(line: Line, displayText: string, showCursor: boolean, key: number) {
  const isLink = !!line.href && !showCursor
  const style = lineStyle(line.font)

  const opensNewTab = !!line.href
  const inner = isLink ? (
    <Link
      href={line.href!}
      {...(opensNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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
        ...style,
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
  const [slotPos, setSlotPos] = useState<SlotPos>({ leftPx: 0, widthPx: 0, maxHeightPx: 0, bottomPx: 0 })
  const prevCharsRef = useRef(0)
  const maxCharsRef = useRef(0)
  const prevScrollRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const dingBufferRef = useRef<AudioBuffer | null>(null)
  const lastPlayedRef = useRef(0)
  const dingPlayedRef = useRef(false)
  const everFullyTypedRef = useRef(false)
  const cafeRef = useRef<HTMLAudioElement | null>(null)
  const cafeNoiseRef = useRef<HTMLAudioElement | null>(null)
  const cafeStartedRef = useRef(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.documentElement.classList.add('no-scrollbar')
    return () => document.documentElement.classList.remove('no-scrollbar')
  }, [])

  useEffect(() => {
    const update = () => {
      const vpW = window.innerWidth
      const vpH = window.innerHeight
      setSlotPos(vpW < 768 ? calcMobileSlot(vpW, vpH) : calcDesktopSlot(vpW, vpH))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    audioCtxRef.current = ctx
    fetch('/sounds/typewriter_keypress.wav')
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => { audioBufferRef.current = decoded })
      .catch(() => {})
    fetch('/sounds/typewriter_ding.wav')
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => { dingBufferRef.current = decoded })
      .catch(() => {})

    const FADE_STEP_MS = 50
    const FADE_IN_MS = 5000

    const music = new Audio('/music/homepage_background_music/tunetank-cafe-music-349477.mp3')
    music.loop = true
    music.volume = 0
    cafeRef.current = music

    const cafeNoise = new Audio('/music/background_cafe_noise.mp3')
    cafeNoise.loop = true
    cafeNoise.volume = 0
    cafeNoiseRef.current = cafeNoise

    let fadeTimer: ReturnType<typeof setInterval> | null = null

    const clearFadeTimer = () => {
      if (fadeTimer !== null) { clearInterval(fadeTimer); fadeTimer = null }
    }

    const fadeIn = () => {
      clearFadeTimer()
      const musicStep = MUSIC_VOLUME / (FADE_IN_MS / FADE_STEP_MS)
      const noiseStep = CAFE_NOISE_VOLUME / (FADE_IN_MS / FADE_STEP_MS)
      fadeTimer = setInterval(() => {
        const music = cafeRef.current
        const noise = cafeNoiseRef.current
        if (!music && !noise) return clearFadeTimer()
        if (music) music.volume = Math.min(music.volume + musicStep, MUSIC_VOLUME)
        if (noise) noise.volume = Math.min(noise.volume + noiseStep, CAFE_NOISE_VOLUME)
        if ((!music || music.volume >= MUSIC_VOLUME) && (!noise || noise.volume >= CAFE_NOISE_VOLUME)) clearFadeTimer()
      }, FADE_STEP_MS)
    }

    const startCafe = () => {
      if (cafeStartedRef.current) return
      cafeStartedRef.current = true
      Promise.all([
        cafeRef.current?.play() ?? Promise.resolve(),
        cafeNoiseRef.current?.play() ?? Promise.resolve(),
      ]).then(() => fadeIn()).catch(() => {})
    }

    const gestureEvents = ['scroll', 'click', 'keydown', 'touchstart'] as const
    const onGesture = () => {
      startCafe()
      gestureEvents.forEach(e => window.removeEventListener(e, onGesture))
    }
    gestureEvents.forEach(e => window.addEventListener(e, onGesture, { passive: true, once: true }))

    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const ratio = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0
      const exactChars = Math.round(ratio * TOTAL_CHARS)
      const scrollingDown = window.scrollY >= prevScrollRef.current
      prevScrollRef.current = window.scrollY

      const desired = everFullyTypedRef.current
        ? snapToLineBoundary(exactChars)
        : scrollingDown ? exactChars : snapToLineBoundary(exactChars)
      const clamped = Math.max(desired, maxCharsRef.current)
      maxCharsRef.current = clamped
      setDisplayedChars(clamped)
    }

    const CHARS_PER_KEY = 3
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key.length !== 1 && e.key !== 'Enter') || e.metaKey || e.ctrlKey || e.altKey) return
      const next = Math.min(maxCharsRef.current + CHARS_PER_KEY, TOTAL_CHARS)
      maxCharsRef.current = next
      setDisplayedChars(next)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    onScroll()
    return () => {
      gestureEvents.forEach(e => window.removeEventListener(e, onGesture))
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKeyDown)
      clearFadeTimer()
      cafeRef.current?.pause()
      cafeNoiseRef.current?.pause()
      cafeStartedRef.current = false
    }
  }, [])

  

  // Play keypress sound whenever new characters are revealed
  useEffect(() => {
    if (displayedChars <= prevCharsRef.current) {
      prevCharsRef.current = displayedChars
      if (displayedChars < TOTAL_CHARS) dingPlayedRef.current = false
      return
    }
    prevCharsRef.current = displayedChars

    // Suppress all sounds after text has been fully typed once
    if (everFullyTypedRef.current) return

    if (!audioCtxRef.current || displayedChars === 0) return

    if (displayedChars >= TOTAL_CHARS && !dingPlayedRef.current && dingBufferRef.current) {
      dingPlayedRef.current = true
      everFullyTypedRef.current = true
      const ding = audioCtxRef.current.createBufferSource()
      ding.buffer = dingBufferRef.current
      const dingGain = audioCtxRef.current.createGain()
      dingGain.gain.value = TYPEWRITER_VOLUME
      ding.connect(dingGain)
      dingGain.connect(audioCtxRef.current.destination)
      ding.start()
      return
    }

    if (!audioBufferRef.current) return
    const now = Date.now()
    if (now - lastPlayedRef.current < 150) return
    lastPlayedRef.current = now

    const source = audioCtxRef.current.createBufferSource()
    source.buffer = audioBufferRef.current
    const keypressGain = audioCtxRef.current.createGain()
    keypressGain.gain.value = TYPEWRITER_VOLUME
    source.connect(keypressGain)
    keypressGain.connect(audioCtxRef.current.destination)
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
      <div className="fixed inset-0 bg-stone-900 pointer-events-none" style={{ zIndex: 0, overflow: 'hidden' }}>
        {/* Mobile: cover the viewport, centered on the image */}
        <div className="md:hidden absolute inset-0">
          <Image
            src="/pictures/homepage/new_typewriter.jpg"
            alt="Vintage typewriter"
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
        {/* Desktop: cover the viewport */}
        <div className="hidden md:block absolute inset-0">
          <Image
            src="/pictures/homepage/new_typewriter.jpg"
            alt="Vintage typewriter"
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
      </div>

      {/* Scroll hint */}
      <div
        className="fixed bottom-10 w-full flex justify-center pointer-events-none"
        style={{ zIndex: 20, opacity: atStart ? 1 : 0, transition: 'opacity 0.6s ease' }}
      >
        <span style={{
          fontFamily: 'var(--font-rough-typewriter)',
          fontSize: '16px',
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.9)',
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}>
          scroll or type
        </span>
      </div>

      {/* Paper emerging from the typewriter slot */}
      {hasContent && (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 10,
            bottom: `${slotPos.bottomPx}px`,
            left: `${slotPos.leftPx}px`,
            width: `${slotPos.widthPx}px`,
          }}
        >
          <div
            style={{
              background: '#f5f0e5',
              boxShadow: '2px 0 6px rgba(0,0,0,0.18), -2px 0 6px rgba(0,0,0,0.18)',
              padding: '10px 18px 0 18px',
            }}
          >
            {completedLines.map((line, i) => renderLine(line, line.text, false, i))}
            {partialEntry !== null && renderLine(partialEntry.line, partialEntry.partial, false, completedLines.length)}
          </div>
        </div>
      )}


    </div>
  )
}
