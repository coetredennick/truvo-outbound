import { Resend } from 'resend'

const NOTIFY_EMAIL = 'coe@gettruvo.com'
const FROM_EMAIL = 'onboarding@resend.dev'

// Lazy initialization to avoid build errors
let resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

interface NotifyOptions {
  subject: string
  body: string
}

export async function notify({ subject, body }: NotifyOptions) {
  const client = getResend()
  if (!client) {
    console.warn('RESEND_API_KEY not set, skipping notification')
    return
  }

  try {
    await client.emails.send({
      from: `Truvo Outbound <${FROM_EMAIL}>`,
      to: NOTIFY_EMAIL,
      subject,
      text: body
    })
  } catch (err) {
    console.error('Failed to send notification:', err)
  }
}

export async function notifyLongCall(contact: { first_name: string; last_name: string; company: string; phone: string }, duration: number) {
  await notify({
    subject: `Call > 30s: ${contact.first_name} ${contact.last_name}`,
    body: `A call lasted ${duration} seconds.

Contact: ${contact.first_name} ${contact.last_name}
Company: ${contact.company}
Phone: ${contact.phone}
Duration: ${duration}s`
  })
}

export async function notifyVapiError(error: string, context?: Record<string, any>) {
  await notify({
    subject: `Vapi Error`,
    body: `An error occurred with Vapi.

Error: ${error}

Context:
${JSON.stringify(context, null, 2)}`
  })
}
