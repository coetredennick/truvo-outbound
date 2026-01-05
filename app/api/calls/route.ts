import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createVapiCall } from '@/lib/vapi'
import { notifyVapiError } from '@/lib/notify'
import type { Contact } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const ASSISTANT_ID = process.env.NEXT_PUBLIC_DEFAULT_ASSISTANT_ID!
const PHONE_NUMBER_ID = process.env.NEXT_PUBLIC_DEFAULT_PHONE_NUMBER_ID!
const CALL_INTERVAL_MS = 30000 // 30 seconds between calls

// Format phone to E.164, strip all non-digits including Unicode junk
function formatPhone(phone: string): string | null {
  // Strip everything except digits 0-9
  const digits = phone.replace(/[^0-9]/g, '')

  // Validate we have a real phone number
  if (digits.length < 10) return null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  if (digits.length > 15) return null  // Too long

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

    const results: { id: string; success: boolean; error?: string; vapiCallId?: string; scheduledAt?: string }[] = []

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i] as Contact

      // Skip contacts that shouldn't be called
      if (['exhausted', 'answered', 'calling'].includes(contact.status)) {
        results.push({
          id: contact.id,
          success: false,
          error: `Skipped: status is ${contact.status}`
        })
        continue
      }

      // Validate phone number
      const formattedPhone = formatPhone(contact.phone)
      if (!formattedPhone) {
        results.push({
          id: contact.id,
          success: false,
          error: `Invalid phone number: ${contact.phone}`
        })
        continue
      }

      try {
        // Schedule call: first one now, rest staggered 30s apart
        const scheduledAt = i === 0
          ? undefined  // First call fires immediately
          : new Date(Date.now() + (i * CALL_INTERVAL_MS)).toISOString()

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

        // 2. Fire the Vapi call (with optional scheduledAt)
        console.log('Calling Vapi with:', {
          assistantId: ASSISTANT_ID,
          phoneNumberId: PHONE_NUMBER_ID,
          customerNumber: formattedPhone,
          scheduledAt
        })
        const vapiResponse = await createVapiCall({
          assistantId: ASSISTANT_ID,
          phoneNumberId: PHONE_NUMBER_ID,
          customerNumber: formattedPhone,
          scheduledAt,
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
          vapiCallId: vapiResponse.id,
          scheduledAt
        })

      } catch (err) {
        console.error(`Error calling contact ${contact.id}:`, err)
        console.error('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)))

        // Notify of Vapi error
        await notifyVapiError(
          err instanceof Error ? err.message : 'Unknown error',
          { source: 'calls', contactId: contact.id, phone: contact.phone }
        )

        // Rollback: restore original call_count and set status to failed
        await supabase
          .from('contacts')
          .update({
            status: 'failed',
            call_count: contact.call_count  // Restore original count
          })
          .eq('id', contact.id)

        results.push({
          id: contact.id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })

        // Stop on first failure - don't schedule remaining calls
        break
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const skippedCount = contacts.length - results.length

    let message = `${successCount} calls initiated`
    if (failCount > 0) message += `, ${failCount} failed`
    if (skippedCount > 0) message += `, ${skippedCount} cancelled`

    return NextResponse.json({
      success: failCount === 0,
      message,
      results
    })

  } catch (error) {
    console.error('Calls API error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
