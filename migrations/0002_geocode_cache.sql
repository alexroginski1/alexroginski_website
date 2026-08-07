CREATE TABLE IF NOT EXISTS geocode_cache (
  location_key TEXT PRIMARY KEY,
  raw_location TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  display_name TEXT,
  source TEXT NOT NULL DEFAULT 'nominatim',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_geocode_cache_updated_at ON geocode_cache(updated_at);
