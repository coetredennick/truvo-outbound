-- TRUVO OUTBOUND MIGRATION
-- STATUS: ALREADY APPLIED (2024-12-29)
-- This migration has been run. Kept for reference only.
--
-- Current schema matches supabase-schema.sql:
--   status: ready, calling, answered, no_answer, failed, exhausted
--   outcome: answered, no_answer, NULL

-- 1. Update contact status options
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_status_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_status_check
  CHECK (status IN ('ready', 'calling', 'answered', 'no_answer', 'failed', 'exhausted'));

-- 2. Migrate existing statuses to new values
UPDATE contacts SET status = 'ready' WHERE status IN ('pending', 'queued', 'completed');
UPDATE contacts SET status = 'failed' WHERE status = 'dnc';

-- 3. Rename attempts to call_count for clarity
ALTER TABLE contacts RENAME COLUMN attempts TO call_count;

-- 4. Update outcome options (simpler)
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_outcome_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_outcome_check
  CHECK (outcome IN ('answered', 'no_answer', NULL));
