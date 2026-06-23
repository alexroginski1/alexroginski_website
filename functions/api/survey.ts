interface Env {
  DB: D1Database
}

interface SurveyBody {
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

  try {
    await env.DB.prepare(
      `INSERT INTO survey_responses (useful, events, other, created_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(body.useful ?? '', body.events ?? '', body.other ?? '', new Date().toISOString())
      .run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error(err)
    return Response.json({ ok: false, error: 'Database error' }, { status: 500 })
  }
}
