import type { MapCalendarKey } from '../../src/lib/calendarIds'

export type StatsApiRow = {
  id: string
  calendar: MapCalendarKey
  title: string
  description?: string
  rawLocation?: string
  cleanedLocation: string
  unknownLocation: boolean
  // "inexact" means the source only pinned down a neighborhood (e.g.
  // "Mission District"), not an exact address — geocoding that name still
  // lands roughly in the right place, but the map should flag it as
  // approximate rather than implying a precise venue.
  locationType: 'exact' | 'inexact'
  start: Date
  end: Date
  calendarLink?: string
  eventSource: string
  // "Hayes Valley", "Mission", etc. — the source's own neighborhood label,
  // shown alongside the geocoded address since the two occasionally
  // disagree (a neighborhood name is coarser but more human-recognizable).
  neighborhood?: string
  // The original event listing (Eventbrite/Luma/Meetup/etc.), pulled out of
  // the description's own "Event Link" anchor — distinct from calendarLink,
  // which only ever points at the "+ Add to Google Calendar" page.
  eventLink?: string
}

const STATS_API_URL = 'https://stuff-to-do-stats-api-5ycp65uliq-uw.a.run.app/'
const FETCH_TIMEOUT_MS = 8000
const FETCH_CACHE_TTL_SECONDS = 300

// The "Source Google Calendar" column is the source of truth for which
// calendars exist — every distinct value becomes a MapCalendarKey (its
// leading "SF " is cosmetic, so it's stripped for display). New calendars
// added upstream show up automatically instead of being silently dropped
// for lacking an entry in a hardcoded map.
const SF_PREFIX_RE = /^SF\s+/

function calendarKeyFromSourceLabel(label: string): MapCalendarKey {
  return label.replace(SF_PREFIX_RE, '')
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function decodeText(cellHtml: string): string {
  return decodeEntities(cellHtml.replace(/<[^>]+>/g, '')).trim()
}

// The Bars calendar's source prefixes some titles with a category label
// like "Live Music: " or "Karaoke: " — strip that label, keeping only the
// actual event name.
const BARS_TITLE_PREFIX_RE = /^[A-Z][A-Za-z&/'-]*(?:\s[A-Z][A-Za-z&/'-]*){0,2}:\s+/

function stripBarsTitlePrefix(title: string): string {
  return title.replace(BARS_TITLE_PREFIX_RE, '')
}

// The "Calendar Link" cell holds an <a href="...">Open</a> tag — unlike the
// other cells, what we need is the href, not the visible text.
function extractHref(cellHtml: string): string | undefined {
  const match = cellHtml.match(/<a[^>]*\shref="([^"]*)"/i)
  return match ? decodeEntities(match[1]) : undefined
}

// The description HTML usually embeds a link back to the original listing
// as `<a href="...">Event Link</a>` (alongside other links, e.g. to the
// source calendar's homepage) — pull out that specific one by its visible
// text rather than just grabbing the first href in the cell.
function extractEventLink(descriptionHtml: string): string | undefined {
  const match = descriptionHtml.match(/<a[^>]*\shref="([^"]*)"[^>]*>\s*Event Link\s*<\/a>/i)
  return match ? decodeEntities(match[1]) : undefined
}

function hashString(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

const DATE_LABEL_RE = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i

// The debug table prints times like "August 9, 9:00 AM" with no year and no
// explicit timezone — these are San Francisco wall-clock times, so they need
// to be interpreted in America/Los_Angeles before converting to UTC.
function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  )
  return (asUtc - date.getTime()) / 60000
}

function laWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month, day, hour, minute))
  const offsetMinutes = getTimeZoneOffsetMinutes('America/Los_Angeles', guess)
  return new Date(guess.getTime() - offsetMinutes * 60000)
}

// The table has no year, so assume "now"'s year unless that lands the date
// more than 30 days in the past — which only happens near a year boundary
// (e.g. today is late December, event is early January).
function parseEventDate(label: string, now: Date): Date | null {
  const match = DATE_LABEL_RE.exec(label.trim())
  if (!match) return null
  const [, monthName, dayStr, hourStr, minuteStr, ampm] = match
  const month = MONTH_INDEX[monthName.toLowerCase()]
  if (month === undefined) return null
  const day = Number(dayStr)
  let hour = Number(hourStr) % 12
  if (ampm.toUpperCase() === 'PM') hour += 12
  const minute = Number(minuteStr)

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const year = now.getFullYear()
  let dt = laWallTimeToUtc(year, month, day, hour, minute)
  if (dt.getTime() < now.getTime() - THIRTY_DAYS_MS) {
    dt = laWallTimeToUtc(year + 1, month, day, hour, minute)
  }
  return dt
}

// The debug table's columns, keyed by header text rather than a fixed
// position — the source app has added/reordered columns before (e.g. the
// "Calendar Link" column) and a positional cells.length check silently
// dropped every row when that happened. Only these columns are consumed;
// unknown columns (extra or reordered) are ignored rather than breaking
// parsing.
const REQUIRED_COLUMNS = [
  'Event Title',
  'Event Description',
  'Start',
  'End',
  'Raw Location',
  'Cleaned Location',
  'Location Type',
  'Neighborhood',
  'Source Google Calendar',
  'Event Source',
] as const

function parseHeaderIndex(html: string): Record<string, number> | null {
  const theadMatch = html.match(/<thead>([\s\S]*?)<\/thead>/)
  if (!theadMatch) return null
  const headers = [...theadMatch[1].matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => decodeText(m[1]))
  const index: Record<string, number> = {}
  headers.forEach((name, i) => {
    index[name] = i
  })
  return index
}

function parseRow(cells: string[], columnIndex: Record<string, number>, now: Date): StatsApiRow | null {
  const cell = (name: string): string => {
    const i = columnIndex[name]
    return i === undefined ? '' : (cells[i] ?? '')
  }

  const calendar = calendarKeyFromSourceLabel(decodeText(cell('Source Google Calendar')))
  if (!calendar) return null

  const rawTitle = decodeText(cell('Event Title'))
  if (!rawTitle) return null
  const title = calendar === 'Bars' ? stripBarsTitlePrefix(rawTitle) : rawTitle

  const start = parseEventDate(decodeText(cell('Start')), now)
  const end = parseEventDate(decodeText(cell('End')), now)
  if (!start || !end) return null

  const rawLocation = decodeText(cell('Raw Location')) || undefined
  const cleanedLocation = decodeText(cell('Cleaned Location'))
  const unknownLocation = !cleanedLocation || cleanedLocation.toLowerCase() === 'location not found'
  const locationType: 'exact' | 'inexact' = decodeText(cell('Location Type')).toLowerCase() === 'inexact' ? 'inexact' : 'exact'

  // Description cells hold raw HTML (some sources embed literal <a> tags),
  // preserved as-is so the client's sanitizeDescriptionHtml() can allowlist
  // it the same way it already does for calendar-sourced descriptions.
  const description = cell('Event Description').trim() || undefined
  const calendarLink = extractHref(cell('Calendar Link'))
  const eventSource = decodeText(cell('Event Source')) || 'Unknown'
  const neighborhood = decodeText(cell('Neighborhood')) || undefined
  const eventLink = description ? extractEventLink(description) : undefined

  const id = `${calendar}:${hashString(`${title}|${start.toISOString()}|${rawLocation ?? ''}`)}`

  return {
    id,
    calendar,
    title,
    description,
    rawLocation,
    cleanedLocation,
    unknownLocation,
    locationType,
    start,
    end,
    calendarLink,
    eventSource,
    neighborhood,
    eventLink,
  }
}

export async function fetchStatsApiEvents(now: Date): Promise<StatsApiRow[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let html: string
  try {
    const res = await fetch(STATS_API_URL, {
      signal: controller.signal,
      cf: { cacheTtl: FETCH_CACHE_TTL_SECONDS, cacheEverything: true },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } finally {
    clearTimeout(timeout)
  }

  const columnIndex = parseHeaderIndex(html)
  if (!columnIndex) return []

  // If the source table drops a column this code depends on, fail loudly
  // (caller treats a thrown error as "source unreachable" and skips caching
  // the empty result) rather than silently returning zero events again.
  const missingColumns = REQUIRED_COLUMNS.filter((name) => !(name in columnIndex))
  if (missingColumns.length) {
    throw new Error(`stats API table is missing expected column(s): ${missingColumns.join(', ')}`)
  }

  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/)
  if (!tbodyMatch) return []
  const rowMatches = tbodyMatch[1].match(/<tr>[\s\S]*?<\/tr>/g) ?? []

  const rows: StatsApiRow[] = []
  for (const rowHtml of rowMatches) {
    const cells = [...rowHtml.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1])
    const row = parseRow(cells, columnIndex, now)
    if (row) rows.push(row)
  }
  return rows
}
