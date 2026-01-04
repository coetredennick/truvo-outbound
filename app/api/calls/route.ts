import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createVapiCall } from '@/lib/vapi'
import type { Contact, Campaign } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Format phone to E.164
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return `+${digits}`
}

export async function POST(request: NextRequest) {
  try {
    const { contactIds, campaignId } = await request.json()

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'No contacts selected' }, { status: 400 })
    }

    // Get campaign for assistant/phone config
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
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
        // 1. Increment call_count and set status to 'calling' FIRST (before API call)
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
          assistantId: (campaign as Campaign).assistant_id,
          phoneNumberId: (campaign as Campaign).phone_number_id,
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
          campaign_id: campaignId,
          vapi_call_id: vapiResponse.id,
          status: 'initiated'
        })

        results.push({
          id: contact.id,
          success: true,
          vapiCallId: vapiResponse.id
        })

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
