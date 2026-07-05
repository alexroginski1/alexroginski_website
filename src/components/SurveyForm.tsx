'use client'

import { useState } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function SurveyForm() {
  const [useful, setUseful] = useState('')
  const [events, setEvents] = useState('')
  const [other, setOther] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setStatus('submitting')
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useful, events, other }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="survey-success">
        <p className="survey-success-title">Thank you so much for sharing!</p>
        <p className="survey-success-sub">Your response means a lot.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="survey-form">

      <div className="survey-question">
        <label className="survey-question-label">Do you find these calendars useful?</label>
        <div className="survey-radio-group">
          {['Yes', 'Kind of', 'Not yet'].map((opt) => (
            <label key={opt} className="survey-radio-option">
              <input
                type="radio"
                name="useful"
                value={opt}
                checked={useful === opt}
                onChange={() => setUseful(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="survey-question">
        <label className="survey-question-label">
          What are your favorite community spaces in the city? Where have you made your friends?
          <br />
          <span className="survey-question-label-hint">I will add it to the calendar :)</span>
        </label>
        <textarea
          value={events}
          onChange={(e) => setEvents(e.target.value)}
          rows={4}
          className="survey-textarea"
          placeholder="Tell me about your favorite spots, events, communities..."
        />
      </div>

      <div className="survey-question">
        <label className="survey-question-label">
          Any other feedback? Any out-of-date events on the calendar?
        </label>
        <textarea
          value={other}
          onChange={(e) => setOther(e.target.value)}
          rows={3}
          className="survey-textarea"
          placeholder="Let me know..."
        />
      </div>

      {status === 'error' && (
        <p className="survey-error">Something went wrong — please try again.</p>
      )}

      <button type="submit" className="survey-submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
