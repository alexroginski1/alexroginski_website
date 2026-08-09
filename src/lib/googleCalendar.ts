type CalendarEventLike = {
  title: string
  start: string
  end: string
  location?: string
  description?: string
}

function toGoogleDateTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Descriptions may contain HTML (see sanitizeHtml.ts) — Google Calendar's
// details field expects plain text.
function stripHtml(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
}

export function googleCalendarUrl(event: CalendarEventLike): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGoogleDateTime(event.start)}/${toGoogleDateTime(event.end)}`,
  })
  if (event.location) params.set('location', event.location)
  if (event.description) params.set('details', stripHtml(event.description))
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
