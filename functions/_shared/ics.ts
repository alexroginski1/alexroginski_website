import ICAL from 'ical.js'

export type RawOccurrence = {
  uid: string
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
}

// Safety bound so a pathological RRULE (e.g. sub-daily frequency with no
// COUNT/UNTIL) can't blow up CPU time in a single Worker invocation.
const MAX_OCCURRENCES_PER_EVENT = 200

export function parseIcsOccurrences(icsText: string, windowStart: Date, windowEnd: Date): RawOccurrence[] {
  let jcalData: unknown
  try {
    jcalData = ICAL.parse(icsText)
  } catch {
    return []
  }

  const comp = new ICAL.Component(jcalData as never)

  // Google's ICS exports use TZID=America/Los_Angeles; ical.js won't resolve
  // those correctly unless the VTIMEZONE blocks are registered first.
  for (const vtz of comp.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(vtz)
    } catch {
      // ignore malformed timezone blocks
    }
  }

  const out: RawOccurrence[] = []

  for (const vevent of comp.getAllSubcomponents('vevent')) {
    let event: ICAL.Event
    try {
      event = new ICAL.Event(vevent)
    } catch {
      continue
    }

    const base = {
      uid: event.uid ?? crypto.randomUUID(),
      title: event.summary || '(untitled)',
      description: event.description || undefined,
      location: event.location || undefined,
    }

    if (!event.isRecurring()) {
      try {
        const start = event.startDate.toJSDate()
        const end = (event.endDate ?? event.startDate).toJSDate()
        if (end >= windowStart && start <= windowEnd) {
          out.push({ ...base, start, end })
        }
      } catch {
        // skip events with unparseable dates
      }
      continue
    }

    try {
      const iterator = event.iterator()
      let next: ICAL.Time | null
      let count = 0
      while (count < MAX_OCCURRENCES_PER_EVENT && (next = iterator.next())) {
        count++
        const occStart = next.toJSDate()
        if (occStart > windowEnd) break

        const details = event.getOccurrenceDetails(next)
        const occEnd = details.endDate.toJSDate()
        if (occEnd < windowStart) continue

        out.push({
          uid: `${base.uid}:${details.startDate.toICALString()}`,
          title: details.item.summary || base.title,
          description: details.item.description || base.description,
          location: details.item.location || base.location,
          start: details.startDate.toJSDate(),
          end: occEnd,
        })
      }
    } catch {
      // skip events whose recurrence rule ical.js can't expand
    }
  }

  return out
}
