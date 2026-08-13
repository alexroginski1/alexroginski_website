ALTER TABLE survey_responses ADD COLUMN visitor_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_visitor ON survey_responses(visitor_id);
