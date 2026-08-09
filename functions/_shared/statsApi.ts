import type { MapCalendarKey } from '../../src/lib/calendarIds'

export type StatsApiRow = {
  id: string
  calendar: MapCalendarKey
  title: string
  description?: string
  rawLocation?: string
  cleanedLocation: string
  unknownLocation: boolean
  start: Date
  end: Date
}

const STATS_API_URL = 'https://stuff-to-do-stats-api-5ycp65uliq-uw.a.run.app/'
const FETCH_TIMEOUT_MS = 8000
const FETCH_CACHE_TTL_SECONDS = 300

// The debug table's "Source Google Calendar" column values, mapped to the
// same MapCalendarKey union the map legend/filters already use.
const SOURCE_CALENDAR_TO_KEY: Record<string, MapCalendarKey> = {
  'SF Arts/Culture': 'sf_arts_culture',
  'SF Community': 'sf_community',
  'SF Fun Cheap': 'sf_fun_cheap',
  'SF Partiful': 'sf_partiful',
  'SF Tech': 'sf_tech',
  'SF Bars': 'sf_bars',
  'SF Dancing': 'sf_dancing',
  'SF Sports/Exercise': 'sf_sports_exercise',
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

function parseRow(cells: string[], now: Date): StatsApiRow | null {
  if (cells.length !== 9) return null
  const [titleCell, descCell, startCell, endCell, rawLocCell, cleanedCell, , sourceCalCell] = cells

  const title = decodeText(titleCell)
  if (!title) return null

  const calendar = SOURCE_CALENDAR_TO_KEY[decodeText(sourceCalCell)]
  if (!calendar) return null

  const start = parseEventDate(decodeText(startCell), now)
  const end = parseEventDate(decodeText(endCell), now)
  if (!start || !end) return null

  const rawLocation = decodeText(rawLocCell) || undefined
  const cleanedLocation = decodeText(cleanedCell)
  const unknownLocation = !cleanedLocation || cleanedLocation.toLowerCase() === 'location not found'

  // Description cells hold raw HTML (some sources embed literal <a> tags),
  // preserved as-is so the client's sanitizeDescriptionHtml() can allowlist
  // it the same way it already does for calendar-sourced descriptions.
  const description = descCell.trim() || undefined

  const id = `${calendar}:${hashString(`${title}|${start.toISOString()}|${rawLocation ?? ''}`)}`

  return { id, calendar, title, description, rawLocation, cleanedLocation, unknownLocation, start, end }
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

  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/)
  if (!tbodyMatch) return []
  const rowMatches = tbodyMatch[1].match(/<tr>[\s\S]*?<\/tr>/g) ?? []

  const rows: StatsApiRow[] = []
  for (const rowHtml of rowMatches) {
    const cells = [...rowHtml.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1])
    const row = parseRow(cells, now)
    if (row) rows.push(row)
  }
  return rows
}
