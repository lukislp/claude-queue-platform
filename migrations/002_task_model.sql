-- Optionales Modell pro Task; NULL = Standardmodell (CLI-Default bzw. API-Default).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS model TEXT;
