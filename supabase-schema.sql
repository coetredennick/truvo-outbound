-- TRUVO OUTBOUND SCHEMA
-- Run this in Supabase SQL Editor for fresh setup

-- Contacts (leads to call)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  location TEXT,
  industry TEXT,
  website TEXT,
  details TEXT,
  custom_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'calling', 'answered', 'no_answer', 'failed', 'exhausted')),
  outcome TEXT CHECK (outcome IN ('answered', 'no_answer', NULL)),
  call_count INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call logs (history)
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  vapi_call_id TEXT,
  status TEXT,
  ended_reason TEXT,
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_call_logs_contact ON call_logs(contact_id);

-- Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Allow all (single user mode)
CREATE POLICY "Allow all" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all" ON call_logs FOR ALL USING (true);
