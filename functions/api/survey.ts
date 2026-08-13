interface Env {
  DB: D1Database
}

interface SurveyBody {
  visitorId?: string
  useful?: string
  events?: string
  other?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  let body: SurveyBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.visitorId) {
    return Response.json({ ok: false, error: 'Missing visitorId' }, { status: 400 })
  }

  try {
    // One row per visitor, upserted on every answer — the popup saves
    // progressively as the visitor steps through the questions rather than
    // waiting for a final submit, so an abandoned survey still keeps
    // whatever was answered so far.
    await env.DB.prepare(
      `INSERT INTO survey_responses (visitor_id, useful, events, other, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(visitor_id) DO UPDATE SET
         useful = excluded.useful,
         events = excluded.events,
         other = excluded.other`
    )
      .bind(body.visitorId, body.useful ?? '', body.events ?? '', body.other ?? '', new Date().toISOString())
      .run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error(err)
    return Response.json({ ok: false, error: 'Database error' }, { status: 500 })
  }
}
