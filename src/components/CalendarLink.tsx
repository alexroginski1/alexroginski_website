'use client'

function getVisitorId(): string {
  const key = 'visitor_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export default function CalendarLink({ href, label }: { href: string; label: string }) {
  function handleClick() {
    window.zaraz?.track('calendar_add_click', { calendar: label })

    const visitorId = getVisitorId()
    fetch('/api/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendar: label, visitorId }),
      keepalive: true,
    }).catch(() => {})
  }

  return (
    <a href={href} onClick={handleClick}>
      {label}
    </a>
  )
}
