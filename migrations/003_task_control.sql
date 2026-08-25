-- Neue Status für Nutzer-Kontrolle: PAUSED (manuell pausiert, fortsetzbar)
-- und CANCELED (manuell abgebrochen, endgültig). Idempotent (läuft bei jedem Start).
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('QUEUED','RUNNING','PAUSED_RATE_LIMIT','PAUSED','CANCELED','COMPLETED','FAILED'));
