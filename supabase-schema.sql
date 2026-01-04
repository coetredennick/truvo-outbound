-- TRUVO OUTBOUND SCHEMA
-- Run this in Supabase SQL Editor for fresh setup

-- Campaigns (calling rules)
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  assistant_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  status TEXT DEFAULT 'paused' CHECK (status IN ('active', 'paused')),
  calls_per_minute INT DEFAULT 5,
  call_window_start TIME DEFAULT '09:00',
  call_window_end TIME DEFAULT '17:00',
  timezone TEXT DEFAULT 'America/Chicago',
  max_attempts INT DEFAULT 2,
  retry_delay_minutes INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts (leads to call)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  location TEXT,
  industry TEXT,
  custom_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'calling', 'answered', 'no_answer', 'voicemail', 'failed', 'exhausted')),
  outcome TEXT CHECK (outcome IN ('answered', 'voicemail', 'no_answer', 'failed', NULL)),
  call_count INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call logs (history)
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  vapi_call_id TEXT,
  status TEXT,
  ended_reason TEXT,
  duration_seconds INT,
  transcript TEXT,
  recording_url TEXT,
  cost DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contacts_campaign ON contacts(campaign_id);
CREATE INDEX idx_call_logs_contact ON call_logs(contact_id);

-- Row Level Security
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Allow all (single user mode)
CREATE POLICY "Allow all" ON campaigns FOR ALL USING (true);
CREATE POLICY "Allow all" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all" ON call_logs FOR ALL USING (true);
