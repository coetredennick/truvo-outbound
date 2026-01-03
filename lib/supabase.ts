import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types
export interface Campaign {
  id: string
  name: string
  assistant_id: string
  phone_number_id: string
  status: 'active' | 'paused'
  calls_per_minute: number
  call_window_start: string
  call_window_end: string
  timezone: string
  max_attempts: number
  retry_delay_minutes: number
  created_at: string
}

export interface Contact {
  id: string
  campaign_id: string
  phone: string
  first_name: string
  last_name: string
  company: string
  location: string
  industry: string
  custom_data: Record<string, any>
  status: 'pending' | 'queued' | 'calling' | 'completed' | 'failed' | 'dnc'
  outcome: string | null
  attempts: number
  last_attempt_at: string | null
  next_attempt_at: string
  created_at: string
}

export interface CallLog {
  id: string
  contact_id: string
  campaign_id: string
  vapi_call_id: string
  status: string
  ended_reason: string
  duration_seconds: number
  transcript: string
  recording_url: string
  cost: number
  created_at: string
}
