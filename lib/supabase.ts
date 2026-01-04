import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types
export interface Contact {
  id: string
  phone: string
  first_name: string
  last_name: string
  company: string
  location: string
  industry: string
  custom_data: Record<string, any>
  status: 'ready' | 'calling' | 'answered' | 'no_answer' | 'voicemail' | 'failed' | 'exhausted'
  outcome: 'answered' | 'voicemail' | 'no_answer' | 'failed' | null
  call_count: number
  last_attempt_at: string | null
  created_at: string
}

export interface CallLog {
  id: string
  contact_id: string
  vapi_call_id: string
  status: string
  ended_reason: string
  duration_seconds: number
  created_at: string
}
