'use client'

export default function CalendarLink({ href, label }: { href: string; label: string }) {
  function handleClick() {
    window.zaraz?.track('calendar_add_click', { calendar: label })
  }

  return (
    <a href={href} onClick={handleClick}>
      {label}
    </a>
  )
}
