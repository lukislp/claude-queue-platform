-- Optional model per task; NULL = the default model (CLI default or API default).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS model TEXT;
