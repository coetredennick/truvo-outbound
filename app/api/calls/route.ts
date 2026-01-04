import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createVapiCall } from '@/lib/vapi'
import type { Contact } from '@/lib/supabase'

// Allow up to 5 minutes for batch calls with delays
export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const ASSISTANT_ID = process.env.NEXT_PUBLIC_DEFAULT_ASSISTANT_ID!
const PHONE_NUMBER_ID = process.env.NEXT_PUBLIC_DEFAULT_PHONE_NUMBER_ID!
const CALL_DELAY_MS = 30000 // 30 seconds between calls

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Format phone to E.164
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return `+${digits}`
}

export async function POST(request: NextRequest) {
  try {
    const { contactIds } = await request.json()

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'No contacts selected' }, { status: 400 })
    }

    // Get contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', contactIds)

    if (contactsError || !contacts) {
      return NextResponse.json({ error: 'Contacts not found' }, { status: 404 })
    }

    const results: { id: string; success: boolean; error?: string; vapiCallId?: string }[] = []

    for (const contact of contacts as Contact[]) {
      try {
        // 1. Increment call_count and set status to 'calling' FIRST
        const newCallCount = contact.call_count + 1
        await supabase
          .from('contacts')
          .update({
            status: 'calling',
            call_count: newCallCount,
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', contact.id)

        // 2. Fire the Vapi call
        const vapiResponse = await createVapiCall({
          assistantId: ASSISTANT_ID,
          phoneNumberId: PHONE_NUMBER_ID,
          customerNumber: formatPhone(contact.phone),
          variables: {
            leadName: contact.first_name || 'there',
            companyName: contact.company || 'your company',
            location: contact.location || '',
            industry: contact.industry || 'business'
          }
        })

        // 3. Create call log entry
        await supabase.from('call_logs').insert({
          contact_id: contact.id,
          vapi_call_id: vapiResponse.id,
          status: 'initiated'
        })

        results.push({
          id: contact.id,
          success: true,
          vapiCallId: vapiResponse.id
        })

        // Wait 30 seconds before next call (except for last one)
        if (contacts.indexOf(contact) < contacts.length - 1) {
          await delay(CALL_DELAY_MS)
        }

      } catch (err) {
        console.error(`Error calling contact ${contact.id}:`, err)

        // Mark as failed if call didn't go through
        await supabase
          .from('contacts')
          .update({ status: 'failed' })
          .eq('id', contact.id)

        results.push({
          id: contact.id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `${successCount} calls initiated, ${failCount} failed`,
      results
    })

  } catch (error) {
    console.error('Calls API error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
