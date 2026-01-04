import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const MAX_ATTEMPTS = 2

// Map Vapi endedReason to contact status
function mapEndedReasonToStatus(endedReason: string): 'answered' | 'no_answer' | 'voicemail' | 'failed' {
  switch (endedReason) {
    case 'customer-ended-call':
    case 'assistant-ended-call':
    case 'assistant-ended-call-after-message-spoken':
      return 'answered'
    case 'voicemail':
      return 'voicemail'
    case 'customer-did-not-answer':
    case 'customer-busy':
      return 'no_answer'
    default:
      return 'failed'
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Vapi sends message wrapper
    const message = body.message || body

    // Only process end-of-call-report
    if (message.type !== 'end-of-call-report') {
      return NextResponse.json({ received: true })
    }

    const vapiCallId = message.call?.id
    const endedReason = message.endedReason
    const duration = message.call?.duration || message.durationSeconds || 0
    const transcript = message.artifact?.transcript || ''
    const recordingUrl = message.artifact?.recording?.url || ''
    const cost = message.cost || 0

    if (!vapiCallId) {
      console.error('No call ID in webhook payload')
      return NextResponse.json({ received: true })
    }

    // Find the call log by vapi_call_id
    const { data: callLog, error: findError } = await supabase
      .from('call_logs')
      .select('*, contacts(*)')
      .eq('vapi_call_id', vapiCallId)
      .single()

    if (findError || !callLog) {
      console.error('Call log not found for:', vapiCallId)
      return NextResponse.json({ received: true })
    }

    const status = mapEndedReasonToStatus(endedReason)
    const contact = callLog.contacts

    // Update call log with results
    await supabase
      .from('call_logs')
      .update({
        status: endedReason,
        ended_reason: endedReason,
        duration_seconds: Math.round(duration),
        transcript,
        recording_url: recordingUrl,
        cost
      })
      .eq('id', callLog.id)

    // Determine final contact status
    let finalStatus: string = status
    if (status !== 'answered' && contact.call_count >= MAX_ATTEMPTS) {
      finalStatus = 'exhausted'
    }

    // Update contact status
    await supabase
      .from('contacts')
      .update({
        status: finalStatus,
        outcome: status
      })
      .eq('id', callLog.contact_id)

    return NextResponse.json({ received: true, status: finalStatus })
  } catch (error) {
    console.error('Webhook error:', error)
    // Always return 200 per Vapi requirements
    return NextResponse.json({ received: true, error: 'Processing failed' })
  }
}

// Handle Vapi verification
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
