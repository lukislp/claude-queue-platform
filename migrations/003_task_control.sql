-- New statuses for user control: PAUSED (paused manually, resumable) and CANCELED
-- (cancelled manually, final). Idempotent (runs on every startup).
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('QUEUED','RUNNING','PAUSED_RATE_LIMIT','PAUSED','CANCELED','COMPLETED','FAILED'));
