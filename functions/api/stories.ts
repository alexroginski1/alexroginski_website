const SHEET_ID = '1t5ZpSFk9YQgCfiXyGPivEDmNIKxb2EPIphyORbP1TAQ'
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`

const CACHE_TTL_SECONDS = 300

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type Story = { text: string; timestamp: string | null }
type StoriesResponse = { stories: Story[] }

// "8/17/2026 14:32:15" -> "August 17" — Google Forms writes the sheet's
// Timestamp column as M/D/YYYY in the form owner's locale; parsed directly
// off the string (rather than via `new Date`) so the displayed day never
// shifts across a UTC/Pacific boundary the way a timezone-converting parse
// could near midnight.
function formatTimestamp(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${MONTH_NAMES[month - 1]} ${day}`
}

// Minimal CSV row parser for gviz's quoted-field output (every field
// wrapped in "...", embedded quotes doubled) — no need for a full CSV
// library for a two-column sheet.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export const onRequestGet: PagesFunction = async (context) => {
  const { request } = context
  const cache = caches.default
  const cacheKey = new Request(new URL(request.url).toString(), request)

  const cached = await cache.match(cacheKey)
  if (cached) return cached

  let stories: Story[]
  try {
    const res = await fetch(SHEET_CSV_URL)
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`)
    const csv = await res.text()
    const [header, ...dataRows] = parseCsv(csv)
    const storyIndex = header?.findIndex((h) => h.trim().toLowerCase() === 'story') ?? -1
    const timestampIndex = header?.findIndex((h) => h.trim().toLowerCase() === 'timestamp') ?? -1

    stories =
      storyIndex === -1
        ? []
        : dataRows
            .map((r) => ({
              text: (r[storyIndex] ?? '').trim(),
              timestamp: timestampIndex === -1 ? null : formatTimestamp(r[timestampIndex] ?? ''),
            }))
            .filter((s) => s.text.length > 0)
            .reverse() // newest submission first
  } catch {
    // Source is temporarily unreachable — skip caching so the next request retries fresh.
    return Response.json({ stories: [] } satisfies StoriesResponse, { status: 502 })
  }

  const response = new Response(JSON.stringify({ stories } satisfies StoriesResponse), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  })

  context.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
