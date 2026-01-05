import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyLongCall, notifyVapiError } from '@/lib/notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const MAX_ATTEMPTS = 2

// Map Vapi endedReason to simple status: answered or no_answer
function mapEndedReasonToStatus(endedReason: string): 'answered' | 'no_answer' {
  switch (endedReason) {
    case 'customer-ended-call':
    case 'assistant-ended-call':
    case 'assistant-ended-call-after-message-spoken':
      return 'answered'
    default:
      return 'no_answer'
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Vapi sends message wrapper or direct payload
    const message = body.message || body
    const eventType = message.type || body.type

    console.log('Webhook received:', { eventType, body: JSON.stringify(body).slice(0, 500) })

    // Handle error events
    if (eventType === 'call-failed' || (eventType === 'status-update' && message.status === 'error')) {
      await notifyVapiError(
        message.endedReason || message.error || body.error || 'Unknown error',
        { source: 'webhook-error', callId: message.call?.id || body.call?.id }
      )
      return NextResponse.json({ received: true })
    }

    // Process call-ended or end-of-call-report
    if (eventType !== 'call-ended' && eventType !== 'end-of-call-report') {
      return NextResponse.json({ received: true })
    }

    // Extract call data - handle different payload structures
    const call = message.call || body.call || body
    const vapiCallId = call.id || message.callId || body.callId
    const endedReason = message.endedReason || body.endedReason || call.endedReason
    const duration = call.duration || message.duration || message.durationSeconds || 0

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

    // Update call log: status + duration
    await supabase
      .from('call_logs')
      .update({
        status: status,
        ended_reason: endedReason,
        duration_seconds: Math.round(duration)
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

    // Notify if call was longer than 30 seconds
    if (duration > 30) {
      await notifyLongCall(contact, Math.round(duration))
    }

    return NextResponse.json({ received: true, status: finalStatus })
  } catch (error) {
    console.error('Webhook error:', error)

    // Notify of Vapi error
    await notifyVapiError(
      error instanceof Error ? error.message : 'Unknown error',
      { source: 'webhook' }
    )

    // Always return 200 per Vapi requirements
    return NextResponse.json({ received: true, error: 'Processing failed' })
  }
}

// Handle Vapi verification
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
