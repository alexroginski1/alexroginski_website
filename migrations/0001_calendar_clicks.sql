CREATE TABLE IF NOT EXISTS calendar_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  clicked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_clicks_calendar ON calendar_clicks(calendar);
CREATE INDEX IF NOT EXISTS idx_calendar_clicks_visitor ON calendar_clicks(visitor_id);
