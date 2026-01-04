const VAPI_BASE_URL = 'https://api.vapi.ai'

function getApiKey(): string {
  const key = process.env.VAPI_API_KEY
  if (!key) throw new Error('VAPI_API_KEY not set')
  return key
}

export interface VapiCallRequest {
  assistantId: string
  phoneNumberId: string
  customerNumber: string
  variables: {
    leadName: string
    companyName: string
    location: string
    industry: string
    [key: string]: string
  }
}

export interface VapiCallResponse {
  id: string
  status: string
  createdAt: string
}

export async function createVapiCall(request: VapiCallRequest): Promise<VapiCallResponse> {
  const response = await fetch(`${VAPI_BASE_URL}/call`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      assistantId: request.assistantId,
      phoneNumberId: request.phoneNumberId,
      customer: {
        number: request.customerNumber
      },
      assistantOverrides: {
        variableValues: request.variables
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vapi API error: ${response.status} - ${error}`)
  }

  return response.json()
}
