'use client'

import { useState } from 'react'

export default function SurveyForm() {
  const [useful, setUseful] = useState('')
  const [events, setEvents] = useState('')
  const [other, setOther] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const subject = encodeURIComponent('Stuff To Do SF — Survey Response')
    const body = encodeURIComponent(
      `Do you find this useful? ${useful}\n\nFavorite community events / where have you made friends:\n${events}\n\nOther feedback / out-of-date events:\n${other}`
    )
    window.open(`mailto:roginskialexr@gmail.com?subject=${subject}&body=${body}`, '_blank')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="survey-success">
        <p className="survey-success-title">Thank you so much for sharing!</p>
        <p className="survey-success-sub">Your response means a lot.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="survey-form">
      <p className="survey-header">Quick survey if you have time</p>

      <div className="survey-question">
        <label className="survey-question-label">Do you find this useful?</label>
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
          What are your favorite community events in the city? Where have you made your friends?{' '}
          <span className="survey-question-label-hint">I will add it to the calendar : )</span>
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

      <button type="submit" className="survey-submit">
        Submit
      </button>
    </form>
  )
}
