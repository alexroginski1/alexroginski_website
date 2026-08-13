'use client'

import { useEffect, useRef, useState } from 'react'
import { getVisitorId } from '@/lib/visitorId'

type Answers = { useful: string; events: string; other: string }

const EMPTY_ANSWERS: Answers = { useful: '', events: '', other: '' }

// Saves the cumulative answers so far, keyed by visitor — each call upserts
// the same row, so an answer is never lost even if the visitor closes the
// popup partway through.
async function saveAnswers(answers: Answers) {
  try {
    await fetch('/api/survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId(), ...answers }),
    })
  } catch {
    // best-effort — nothing actionable to do here, the next answer will retry
  }
}

// The raised-hand popup — a quick, one-question-at-a-time survey that saves
// after every answer instead of a single submit at the end.
export default function SurveySidebar({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS)
  const [eventsDraft, setEventsDraft] = useState('')
  const [otherDraft, setOtherDraft] = useState('')
  const [done, setDone] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [onClose])

  function chooseUseful(value: string) {
    const next = { ...answers, useful: value }
    setAnswers(next)
    saveAnswers(next)
    setStep(1)
  }

  function submitEvents() {
    const next = { ...answers, events: eventsDraft.trim() }
    setAnswers(next)
    saveAnswers(next)
    setStep(2)
  }

  function submitOther() {
    const next = { ...answers, other: otherDraft.trim() }
    setAnswers(next)
    saveAnswers(next)
    setDone(true)
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div ref={rootRef} className="std-map-sidebar std-map-sidebar-right std-map-survey-sidebar">
      <button type="button" className="std-map-sidebar-close" onClick={onClose} aria-label="Close survey">
        ×
      </button>

      {done ? (
        <div className="survey-success">
          <p className="survey-success-title">Thank you so much for sharing!</p>
          <p className="survey-success-sub">Your response means a lot.</p>
        </div>
      ) : (
        <div className="survey-form">
          <p className="std-map-survey-step">Question {step + 1} of 3</p>

          {step === 0 && (
            <div className="survey-question">
              <label className="survey-question-label">Do you find these calendars useful?</label>
              <div className="survey-radio-group">
                {['Yes', 'Kind of', 'Not yet'].map((opt) => (
                  <label key={opt} className="survey-radio-option">
                    <input
                      type="radio"
                      name="useful"
                      value={opt}
                      checked={answers.useful === opt}
                      onChange={() => chooseUseful(opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="survey-question">
              <label className="survey-question-label">
                What are your favorite community spaces in the city? Where have you made your
                friends?
                <br />
                <span className="survey-question-label-hint">I will add it to the calendar :)</span>
              </label>
              <textarea
                value={eventsDraft}
                onChange={(e) => setEventsDraft(e.target.value)}
                rows={4}
                className="survey-textarea"
                placeholder="Tell me about your favorite spots, events, communities..."
                autoFocus
              />
              <div className="std-map-survey-actions">
                <button type="button" className="std-map-survey-back" onClick={goBack}>
                  Back
                </button>
                <button type="button" className="survey-submit" onClick={submitEvents}>
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="survey-question">
              <label className="survey-question-label">
                Any other feedback? Any out-of-date events on the calendar?
              </label>
              <textarea
                value={otherDraft}
                onChange={(e) => setOtherDraft(e.target.value)}
                rows={3}
                className="survey-textarea"
                placeholder="Let me know..."
                autoFocus
              />
              <div className="std-map-survey-actions">
                <button type="button" className="std-map-survey-back" onClick={goBack}>
                  Back
                </button>
                <button type="button" className="survey-submit" onClick={submitOther}>
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
