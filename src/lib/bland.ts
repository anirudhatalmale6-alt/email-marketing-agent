import { prisma } from './prisma'

const BLAND_BASE = 'https://api.bland.ai'

async function getBlandKey(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: 'bland_api_key' } })
  if (!setting?.value) {
    throw new Error('Bland API key not configured. Add it in Settings first.')
  }
  return setting.value
}

async function getBlandVoice(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: 'bland_voice' } })
  return setting?.value || 'josh'
}

export interface SendCallParams {
  phoneNumber: string
  task: string
  firstSentence?: string
  webhook?: string
  requestData?: Record<string, string>
  metadata?: Record<string, unknown>
  summaryPrompt?: string
}

interface BlandSendResponse {
  status: string
  call_id?: string
  message?: string
  errors?: unknown
}

// Places an outbound AI call through Bland. Returns Bland's call_id.
export async function sendBlandCall(params: SendCallParams): Promise<{ callId: string }> {
  const apiKey = await getBlandKey()
  const voice = await getBlandVoice()

  const body: Record<string, unknown> = {
    phone_number: params.phoneNumber,
    task: params.task,
    voice,
    wait_for_greeting: true,
    record: true,
    max_duration: 10,
  }
  if (params.firstSentence) body.first_sentence = params.firstSentence
  if (params.webhook) body.webhook = params.webhook
  if (params.requestData) body.request_data = params.requestData
  if (params.metadata) body.metadata = params.metadata
  if (params.summaryPrompt) body.summary_prompt = params.summaryPrompt

  const res = await fetch(`${BLAND_BASE}/v1/calls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as BlandSendResponse

  if (!res.ok || data.status === 'error' || !data.call_id) {
    const detail = data.message || (data.errors ? JSON.stringify(data.errors) : '') || `HTTP ${res.status}`
    throw new Error(`Bland could not place the call: ${detail}`)
  }

  return { callId: data.call_id }
}

// Fetches the current state / result of a call from Bland.
export async function getBlandCall(callId: string): Promise<Record<string, unknown>> {
  const apiKey = await getBlandKey()
  const res = await fetch(`${BLAND_BASE}/v1/calls/${callId}`, {
    headers: { Authorization: apiKey },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch call status from Bland (HTTP ${res.status})`)
  }
  return res.json()
}

export const SUMMARY_PROMPT =
  'In 2-3 short sentences, summarize the outcome of this sales call. State clearly whether the person was interested, whether they want a brochure/samples/quotation sent (and capture any email address they gave), whether they need a reorder (with rough quantity/timing if mentioned), whether they asked to be called back (and when), or whether they were not interested.'

export const FEEDBACK_SUMMARY_PROMPT =
  'In 2-4 short sentences, summarize this customer feedback call. Capture: (1) their feedback on the key cards recently supplied - were they happy, any quality/fit issues or complaints; (2) any update or feedback on the sample that was made for them; (3) their feedback on the recent salesman visit; and (4) any follow-up action requested (callback, send someone, quotation, complaint to resolve). If they were unavailable or asked to be called back, say so and note when.'

// Returns the right summary prompt for the call type.
export function getSummaryPrompt(callType: string): string {
  return callType === 'feedback' ? FEEDBACK_SUMMARY_PROMPT : SUMMARY_PROMPT
}

// Builds the AI instructions (task prompt) for a given call type and lead.
// callType: 'prospect' (new lead, pitch Wooden RFID Key Cards) or
// 'customer' (existing customer, check reorder + pitch Wooden Door Hangers).
export function buildCallTask(callType: string, name: string, company: string): string {
  const who = name || 'there'
  const org = company || 'their hotel'

  if (callType === 'feedback') {
    return [
      `You are Priya, a warm, polite and professional customer care representative from Dennison Business Solutions (DBS), a supplier of premium cards and hotel products. You speak English clearly with a natural Indian accent. You are making an OUTBOUND customer feedback call to an existing customer.`,
      `You are calling ${who}${company ? ` from ${org}` : ''}.`,
      ``,
      `This is NOT a sales call - it is a friendly feedback and relationship call. Your goals, covered naturally in conversation:`,
      `1. Ask for their feedback on the cards we recently supplied - are they happy with the quality, did everything arrive correctly, and is there any issue or complaint you should note.`,
      `2. Ask if they have had a chance to review the sample we made for them, and get their thoughts or any update on it.`,
      `3. Ask for their feedback on the recent visit from our salesman - how it went and whether their needs were looked after.`,
      ``,
      `How to speak: warm, respectful and unhurried, like a real person genuinely interested in their opinion. Ask one question at a time and listen. Thank them sincerely for their feedback. If they raise a problem or complaint, acknowledge it, assure them you will pass it to the team to resolve, and note the details. If they ask for a callback or want someone to visit, capture that. Do not pitch or sell anything. Keep the call short and polite, and thank them warmly before ending.`,
    ].join('\n')
  }

  if (callType === 'customer') {
    return [
      `You are Tobjee, a warm and professional account manager from Dennison Business Solutions (DBS), a supplier of premium hotel products. You are making an OUTBOUND check-in call to an EXISTING customer.`,
      `You are calling ${who} at ${org}.`,
      ``,
      `Your two goals: (1) find out if they need to reorder RFID hotel key cards this week or this month, and capture any rough quantity or timing they mention; (2) introduce our NEW product, premium Wooden Door Hangers - made from sustainable wood, with a premium look and feel, great for enhancing the guest experience - and see if they are interested. If they show interest in either, offer to send a brochure, samples, and a quotation, and confirm the best email address to send them to.`,
      ``,
      `How to speak: warm, natural and concise, like a real person - not a script. Ask one question at a time and genuinely respond to their answers. If they are busy, politely ask for a better time to call back, then end the call. If they are not interested, thank them warmly and end the call. Never invent prices or specifics you do not know - offer to send details by email instead. Keep the whole call under a few minutes, and end it politely once you have your answer.`,
    ].join('\n')
  }

  // default: new prospect
  return [
    `You are Tobjee, a warm and professional sales representative from Dennison Business Solutions (DBS), a supplier of premium hotel products. You are making an OUTBOUND call to a potential new customer at a hotel.`,
    `You are calling ${who} at ${org}.`,
    ``,
    `Your goal: find out whether their hotel uses or buys RFID / key-card room access, and introduce our premium Wooden RFID Hotel Key Cards - fully compatible with most major hotel locking systems, the same security and performance as standard PVC cards, and a premium, eco-friendly alternative that enhances the hotel's brand image. If they show interest, offer to send a brochure, samples, and a quotation, and confirm the best email address to send them to.`,
    ``,
    `How to speak: warm, natural and concise, like a real person - not a script. Ask one question at a time and genuinely respond to their answers. If they are busy, politely ask for a better time to call back, then end the call. If they are not interested, thank them warmly and end the call. Never invent prices or specifics you do not know - offer to send details by email instead. Keep the whole call under a few minutes, and end it politely once you have your answer.`,
  ].join('\n')
}

export function buildFirstSentence(callType: string, name: string): string {
  const who = name || 'there'
  if (callType === 'feedback') {
    return `Hello ${who}, this is Priya calling from Dennison Business Solutions - hope I've caught you at a good time? I just wanted to get a little feedback from you, it will only take a minute.`
  }
  if (callType === 'customer') {
    return `Hi ${who}, this is Tobjee calling from Dennison Business Solutions - hope you're doing well, is now an okay time for a quick check-in?`
  }
  return `Hi, this is Tobjee calling from Dennison Business Solutions - am I speaking with ${who}?`
}
