import { prisma } from './prisma'

// Reads the mittosapi endpoint URLs (which include the API key in the path)
// from Settings. The user pastes the full URL from their mittosapi panel.
async function getSetting(key: string): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key } })
  return setting?.value?.trim() || ''
}

export async function getSessionUrl(): Promise<string> {
  const url = await getSetting('whatsapp_session_url')
  if (!url) {
    throw new Error('WhatsApp Session API URL not configured. Add it in Settings > WhatsApp.')
  }
  return url
}

export async function getTemplateUrl(): Promise<string> {
  return getSetting('whatsapp_template_url')
}

// Normalise a phone number to the format mittosapi expects: country code + number,
// digits only, no plus sign or spaces (e.g. "44xxxxxxxxxx").
export function normalizePhone(input: string): string {
  return (input || '').replace(/[^0-9]/g, '')
}

export interface SendResult {
  ok: boolean
  status: string // 'sent' | 'failed'
  providerRef?: string
  raw: string
  error?: string
}

interface SessionPayload {
  type: string
  message: string
  caption?: string
  sender_phone: string
}

/**
 * Send a free-form (session) WhatsApp message via mittosapi.
 * `to` is the recipient's number; it is normalised to digits-only.
 */
export async function sendWhatsAppText(
  to: string,
  message: string,
  opts: { type?: string; caption?: string } = {}
): Promise<SendResult> {
  const url = await getSessionUrl()
  const phone = normalizePhone(to)
  if (!phone) {
    return { ok: false, status: 'failed', raw: '', error: 'Recipient phone number is empty or invalid.' }
  }
  if (!message || !message.trim()) {
    return { ok: false, status: 'failed', raw: '', error: 'Message is empty.' }
  }

  const payload: SessionPayload = {
    type: opts.type || 'text',
    message,
    caption: opts.caption || '',
    sender_phone: phone,
  }

  let raw = ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    raw = await res.text()

    // mittosapi returns JSON; be defensive since some gateways return plain text.
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }

    const success = interpretSuccess(res.ok, parsed, raw)
    const providerRef = extractRef(parsed)

    return {
      ok: success,
      status: success ? 'sent' : 'failed',
      providerRef,
      raw,
      error: success ? undefined : extractError(parsed, raw),
    }
  } catch (err) {
    return {
      ok: false,
      status: 'failed',
      raw,
      error: err instanceof Error ? err.message : 'Network error contacting WhatsApp provider.',
    }
  }
}

/**
 * Send a Quick Reply (button) WhatsApp message via mittosapi, e.g. Yes / No / Call Back.
 *
 * NOTE: the exact JSON shape for the "Quick Reply" tab is being confirmed from the
 * client's mittosapi panel. The button structure is isolated in buildQuickReplyPayload()
 * so it can be adjusted in one place once the exact format is known.
 */
export async function sendWhatsAppQuickReply(
  to: string,
  bodyText: string,
  buttons: string[]
): Promise<SendResult> {
  const url = await getSessionUrl()
  const phone = normalizePhone(to)
  if (!phone) {
    return { ok: false, status: 'failed', raw: '', error: 'Recipient phone number is empty or invalid.' }
  }
  if (!bodyText || !bodyText.trim()) {
    return { ok: false, status: 'failed', raw: '', error: 'Message is empty.' }
  }

  const payload = buildQuickReplyPayload(phone, bodyText, buttons)

  let raw = ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    raw = await res.text()
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
    const success = interpretSuccess(res.ok, parsed, raw)
    return {
      ok: success,
      status: success ? 'sent' : 'failed',
      providerRef: extractRef(parsed),
      raw,
      error: success ? undefined : extractError(parsed, raw),
    }
  } catch (err) {
    return {
      ok: false,
      status: 'failed',
      raw,
      error: err instanceof Error ? err.message : 'Network error contacting WhatsApp provider.',
    }
  }
}

// Best-effort mittosapi Quick Reply structure. Adjust here when the exact
// "Quick Reply" payload from the panel is confirmed.
function buildQuickReplyPayload(phone: string, bodyText: string, buttons: string[]): Record<string, unknown> {
  const cleanButtons = buttons.map((b) => b.trim()).filter(Boolean).slice(0, 3)
  return {
    type: 'button',
    message: bodyText,
    button: {
      body: bodyText,
      buttons: cleanButtons.map((title, i) => ({ id: `btn_${i + 1}`, title })),
    },
    buttons: cleanButtons.map((title, i) => ({ id: `btn_${i + 1}`, title })),
    sender_phone: phone,
  }
}

function interpretSuccess(httpOk: boolean, parsed: Record<string, unknown> | null, raw: string): boolean {
  if (parsed) {
    // Common shapes: { status: "success" }, { success: true }, { message_status: "..." }
    const status = String(parsed.status ?? parsed.Status ?? '').toLowerCase()
    if (status) {
      if (['success', 'sent', 'queued', 'ok', 'true', 'delivered'].includes(status)) return true
      if (['error', 'failed', 'fail', 'false'].includes(status)) return false
    }
    if (typeof parsed.success === 'boolean') return parsed.success
  }
  const lower = raw.toLowerCase()
  if (lower.includes('"success"') || lower.includes('message sent') || lower.includes('queued')) return true
  if (lower.includes('error') || lower.includes('invalid') || lower.includes('fail')) return false
  return httpOk
}

function extractRef(parsed: Record<string, unknown> | null): string | undefined {
  if (!parsed) return undefined
  const ref = parsed.id ?? parsed.message_id ?? parsed.messageId ?? parsed.msg_id ?? parsed.reference
  return ref !== undefined && ref !== null ? String(ref) : undefined
}

function extractError(parsed: Record<string, unknown> | null, raw: string): string {
  if (parsed) {
    const msg = parsed.message ?? parsed.error ?? parsed.msg ?? parsed.description
    if (msg) return String(msg)
  }
  return raw ? raw.slice(0, 300) : 'Unknown error from WhatsApp provider.'
}

/**
 * Persist a message to the log. Never throws (logging must not break sending).
 */
export async function logWhatsAppMessage(data: {
  leadId?: string | null
  direction?: 'outbound' | 'inbound'
  toNumber: string
  fromNumber?: string | null
  messageType?: string
  body: string
  status: string
  providerRef?: string | null
  rawResponse?: string | null
}): Promise<void> {
  try {
    await prisma.whatsAppMessage.create({
      data: {
        leadId: data.leadId || null,
        direction: data.direction || 'outbound',
        toNumber: data.toNumber,
        fromNumber: data.fromNumber || null,
        messageType: data.messageType || 'text',
        body: data.body,
        status: data.status,
        providerRef: data.providerRef || null,
        rawResponse: data.rawResponse ? data.rawResponse.slice(0, 2000) : null,
      },
    })
  } catch (err) {
    console.error('Failed to log WhatsApp message:', err)
  }
}

/**
 * Fill {{firstName}} / {{lastName}} / {{company}} / {{date}} style tokens.
 */
export function fillTokens(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key]
    return v !== undefined && v !== null ? v : ''
  })
}
