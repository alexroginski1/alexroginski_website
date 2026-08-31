-- A single shared row that callers atomically bump forward to reserve the
-- next allowed Nominatim request time, so concurrent Cloudflare Pages
-- Function invocations (a background /api/events geocode batch overlapping
-- a live /api/geocode search, or two overlapping batches from different
-- edge colos) stay collectively under Nominatim's ~1 request/second usage
-- policy instead of each throttling only against its own clock.
CREATE TABLE IF NOT EXISTS geocode_throttle (
  id INTEGER PRIMARY KEY,
  next_allowed_at INTEGER NOT NULL
);
