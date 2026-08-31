// Nominatim's usage policy caps free-text search at ~1 request/second —
// system-wide, not per caller. Each caller used to throttle itself against
// its own local clock (a `sleep` between its own successive requests), but
// Cloudflare Pages Functions run as independent, potentially-concurrent
// invocations — a background geocode batch from one `/api/events` request
// can overlap another from a different edge colo, or a live `/api/geocode`
// search — so the real aggregate request rate could run well above 1/sec.
// Nominatim doesn't distinguish "rejected for exceeding the rate limit"
// from "no results", so an app that overruns the limit sees addresses it
// knows are resolvable get treated as unresolvable indefinitely.
//
// This reserves a globally-serialized time slot in D1 instead: every
// caller (regardless of which invocation it's in) atomically bumps a
// single shared "next allowed" timestamp forward by THROTTLE_MS and waits
// for the slot it was given, so the combined request rate across every
// concurrent invocation stays under the limit.
const THROTTLE_MS = 1100

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForGeocodeSlot(db: D1Database): Promise<void> {
  const now = Date.now()

  await db
    .prepare(`INSERT INTO geocode_throttle (id, next_allowed_at) VALUES (1, ?1) ON CONFLICT(id) DO NOTHING`)
    .bind(now)
    .run()

  // MAX(next_allowed_at, now) is the earliest slot nobody else has already
  // claimed; bumping it forward by THROTTLE_MS before any other caller can
  // read it is what makes the reservation atomic (D1 serializes writes to
  // a single database), rather than every caller racing to read-then-write
  // the same value.
  const row = await db
    .prepare(
      `UPDATE geocode_throttle
       SET next_allowed_at = MAX(next_allowed_at, ?1) + ?2
       WHERE id = 1
       RETURNING next_allowed_at - ?2 AS slot_start`
    )
    .bind(now, THROTTLE_MS)
    .first<{ slot_start: number }>()

  const waitMs = (row?.slot_start ?? now) - Date.now()
  if (waitMs > 0) await sleep(waitMs)
}
