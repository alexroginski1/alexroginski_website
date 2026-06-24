interface Env {
  DB: D1Database
}

interface TrackClickBody {
  calendar: string
  visitorId: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  let body: TrackClickBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.calendar || !body.visitorId) {
    return Response.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }

  try {
    await env.DB.prepare(
      `INSERT INTO calendar_clicks (calendar, visitor_id, clicked_at) VALUES (?, ?, ?)`
    )
      .bind(body.calendar, body.visitorId, new Date().toISOString())
      .run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error(err)
    return Response.json({ ok: false, error: 'Database error' }, { status: 500 })
  }
}
