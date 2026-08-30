const SHEET_ID = '1x1EeFDPKNDULmW1_EE-4xsTcPV0RQ7pdZd4oK_fh0Dg'
const SHEET_GID = '1332678680'
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`

const CACHE_TTL_SECONDS = 300

type LatestUpdateResponse = { message: string | null; date: string | null }

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

  let result: LatestUpdateResponse
  try {
    const res = await fetch(SHEET_CSV_URL)
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`)
    const csv = await res.text()
    const [header, ...dataRows] = parseCsv(csv)
    const messageIndex = header?.findIndex((h) => h.trim().toLowerCase() === 'message') ?? -1
    const dateIndex = header?.findIndex((h) => h.trim().toLowerCase() === 'date') ?? -1

    const lastRow = dataRows[dataRows.length - 1]
    result = {
      message: lastRow && messageIndex !== -1 ? (lastRow[messageIndex] ?? '').trim() || null : null,
      date: lastRow && dateIndex !== -1 ? (lastRow[dateIndex] ?? '').trim() || null : null,
    }
  } catch {
    // Source is temporarily unreachable — skip caching so the next request retries fresh.
    return Response.json({ message: null, date: null } satisfies LatestUpdateResponse, { status: 502 })
  }

  const response = new Response(JSON.stringify(result satisfies LatestUpdateResponse), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  })

  context.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
