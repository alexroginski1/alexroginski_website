const SHEET_ID = '1t5ZpSFk9YQgCfiXyGPivEDmNIKxb2EPIphyORbP1TAQ'
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`

const CACHE_TTL_SECONDS = 300

type StoriesResponse = { stories: string[] }

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

  let stories: string[]
  try {
    const res = await fetch(SHEET_CSV_URL)
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`)
    const csv = await res.text()
    const [header, ...dataRows] = parseCsv(csv)
    const storyIndex = header?.findIndex((h) => h.trim().toLowerCase() === 'story') ?? -1

    stories =
      storyIndex === -1
        ? []
        : dataRows
            .map((r) => (r[storyIndex] ?? '').trim())
            .filter((s) => s.length > 0)
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
