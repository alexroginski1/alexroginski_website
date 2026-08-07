CREATE TABLE IF NOT EXISTS event_upvotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(event_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_event_upvotes_event ON event_upvotes(event_id);
