-- Snapshot of files the local agent found in the task's working directory after a
-- terminal run (COMPLETED/FAILED), so the dashboard can show what was produced without
-- the user having to check the filesystem directly. NULL = not reported (e.g. API-key
-- mode, which never touches a filesystem).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_files JSONB;
