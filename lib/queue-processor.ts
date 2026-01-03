import { createClient } from '@supabase/supabase-js'
import { createVapiCall } from './vapi'
import type { Campaign, Contact } from './supabase'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load env vars from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Use service key for server-side
)

// Check if current time is within calling window
function isWithinCallingWindow(campaign: Campaign): boolean {
  const now = new Date()
  const tz = campaign.timezone || 'America/Chicago'
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  const currentTime = formatter.format(now)
  const [currentHour, currentMin] = currentTime.split(':').map(Number)
  const currentMinutes = currentHour * 60 + currentMin
  
  const [startHour, startMin] = campaign.call_window_start.split(':').map(Number)
  const [endHour, endMin] = campaign.call_window_end.split(':').map(Number)
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

// Format phone to E.164
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return `+${digits}`
}

// Process queue for a single campaign
async function processCampaign(campaign: Campaign) {
  if (campaign.status !== 'active') {
    console.log(`Campaign ${campaign.name} is paused, skipping`)
    return
  }
  
  if (!isWithinCallingWindow(campaign)) {
    console.log(`Campaign ${campaign.name} outside calling window, skipping`)
    return
  }
  
  // Get contacts ready to call
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('campaign_id', campaign.id)
    .in('status', ['pending', 'failed'])
    .lt('attempts', campaign.max_attempts)
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(campaign.calls_per_minute)
  
  if (error) {
    console.error(`Error fetching contacts for ${campaign.name}:`, error)
    return
  }
  
  if (!contacts || contacts.length === 0) {
    console.log(`No contacts ready for ${campaign.name}`)
    return
  }
  
  console.log(`Processing ${contacts.length} contacts for ${campaign.name}`)
  
  for (const contact of contacts as Contact[]) {
    try {
      // Mark as calling
      await supabase
        .from('contacts')
        .update({ status: 'calling' })
        .eq('id', contact.id)
      
      // Fire the call
      const vapiResponse = await createVapiCall({
        assistantId: campaign.assistant_id,
        phoneNumberId: campaign.phone_number_id,
        customerNumber: formatPhone(contact.phone),
        variables: {
          leadName: contact.first_name || 'there',
          companyName: contact.company || 'your company',
          location: contact.location || '',
          industry: contact.industry || 'business'
        }
      })
      
      console.log(`Call initiated for ${contact.first_name} (${contact.phone}): ${vapiResponse.id}`)
      
      // Log the call
      await supabase.from('call_logs').insert({
        contact_id: contact.id,
        campaign_id: campaign.id,
        vapi_call_id: vapiResponse.id,
        status: 'initiated'
      })
      
      // Update contact
      await supabase
        .from('contacts')
        .update({
          status: 'completed', // Will be updated by webhook later
          attempts: contact.attempts + 1,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', contact.id)
      
    } catch (err) {
      console.error(`Error calling ${contact.phone}:`, err)
      
      // Mark as failed, schedule retry
      const nextAttempt = new Date()
      nextAttempt.setMinutes(nextAttempt.getMinutes() + campaign.retry_delay_minutes)
      
      await supabase
        .from('contacts')
        .update({
          status: 'failed',
          attempts: contact.attempts + 1,
          last_attempt_at: new Date().toISOString(),
          next_attempt_at: nextAttempt.toISOString()
        })
        .eq('id', contact.id)
    }
  }
}

// Main loop
async function runQueue() {
  console.log('Starting queue processor...')
  
  while (true) {
    try {
      // Get all active campaigns
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'active')
      
      if (error) {
        console.error('Error fetching campaigns:', error)
      } else if (campaigns) {
        for (const campaign of campaigns) {
          await processCampaign(campaign as Campaign)
        }
      }
    } catch (err) {
      console.error('Queue error:', err)
    }
    
    // Wait 30 seconds before next run
    await new Promise(resolve => setTimeout(resolve, 30000))
  }
}

// Run
runQueue()
