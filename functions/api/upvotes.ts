interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const visitorId = new URL(request.url).searchParams.get('visitorId')

  try {
    const { results } = await env.DB.prepare(
      `SELECT event_id, COUNT(*) as count FROM event_upvotes GROUP BY event_id`
    ).all<{ event_id: string; count: number }>()

    const counts: Record<string, number> = {}
    for (const row of results ?? []) counts[row.event_id] = row.count

    let voted: string[] = []
    if (visitorId) {
      const { results: votedRows } = await env.DB.prepare(
        `SELECT event_id FROM event_upvotes WHERE visitor_id = ?`
      )
        .bind(visitorId)
        .all<{ event_id: string }>()
      voted = (votedRows ?? []).map((r) => r.event_id)
    }

    return Response.json({ counts, voted })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}

interface ToggleUpvoteBody {
  eventId: string
  visitorId: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  let body: ToggleUpvoteBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.eventId || !body.visitorId) {
    return Response.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }

  try {
    const existing = await env.DB.prepare(
      `SELECT id FROM event_upvotes WHERE event_id = ? AND visitor_id = ?`
    )
      .bind(body.eventId, body.visitorId)
      .first<{ id: number }>()

    let voted: boolean
    if (existing) {
      await env.DB.prepare(`DELETE FROM event_upvotes WHERE id = ?`).bind(existing.id).run()
      voted = false
    } else {
      await env.DB.prepare(
        `INSERT INTO event_upvotes (event_id, visitor_id, created_at) VALUES (?, ?, ?)`
      )
        .bind(body.eventId, body.visitorId, new Date().toISOString())
        .run()
      voted = true
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM event_upvotes WHERE event_id = ?`
    )
      .bind(body.eventId)
      .first<{ count: number }>()

    return Response.json({ ok: true, voted, count: countRow?.count ?? 0 })
  } catch (err) {
    console.error(err)
    return Response.json({ ok: false, error: 'Database error' }, { status: 500 })
  }
}
