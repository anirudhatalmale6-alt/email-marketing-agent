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

export type WhatsAppProvider = 'twilio' | 'mittos'

/**
 * Which WhatsApp provider to send through. Explicit 'whatsapp_provider' setting wins;
 * otherwise we auto-detect: if Twilio creds are present use Twilio, else fall back to mittos.
 */
export async function getProvider(): Promise<WhatsAppProvider> {
  const explicit = (await getSetting('whatsapp_provider')).toLowerCase()
  if (explicit === 'twilio' || explicit === 'mittos') return explicit
  const sid = await getSetting('twilio_account_sid')
  return sid ? 'twilio' : 'mittos'
}

// ---------------------------------------------------------------------------
// Twilio WhatsApp (official Meta WhatsApp Business API BSP)
// ---------------------------------------------------------------------------

async function getTwilioCreds(): Promise<{ accountSid: string; authToken: string; from: string }> {
  const accountSid = await getSetting('twilio_account_sid')
  const authToken = await getSetting('twilio_auth_token')
  const from = await getSetting('twilio_whatsapp_from')
  if (!accountSid || !authToken) {
    throw new Error('Twilio Account SID / Auth Token not configured. Add them in Settings > WhatsApp.')
  }
  if (!from) {
    throw new Error('Twilio WhatsApp sender number not configured. Add it in Settings > WhatsApp.')
  }
  return { accountSid, authToken, from }
}

// Twilio expects addresses like "whatsapp:+919812345678".
function twilioAddr(num: string): string {
  const s = (num || '').trim()
  if (s.toLowerCase().startsWith('whatsapp:')) return 'whatsapp:' + s.slice(9).replace(/[^0-9+]/g, '')
  const cleaned = s.replace(/[^0-9+]/g, '')
  const withPlus = cleaned.startsWith('+') ? cleaned : '+' + cleaned.replace(/^\+*/, '')
  return 'whatsapp:' + withPlus
}

async function sendTwilio(
  to: string,
  params: { body?: string; contentSid?: string; contentVariables?: Record<string, string> }
): Promise<SendResult> {
  let creds
  try {
    creds = await getTwilioCreds()
  } catch (e) {
    return { ok: false, status: 'failed', raw: '', error: e instanceof Error ? e.message : 'Twilio not configured.' }
  }

  const toAddr = twilioAddr(to)
  if (toAddr === 'whatsapp:+' || toAddr === 'whatsapp:') {
    return { ok: false, status: 'failed', raw: '', error: 'Recipient phone number is empty or invalid.' }
  }

  const form = new URLSearchParams()
  form.set('From', twilioAddr(creds.from))
  form.set('To', toAddr)
  if (params.contentSid) {
    form.set('ContentSid', params.contentSid)
    if (params.contentVariables && Object.keys(params.contentVariables).length) {
      form.set('ContentVariables', JSON.stringify(params.contentVariables))
    }
  } else {
    if (!params.body || !params.body.trim()) {
      return { ok: false, status: 'failed', raw: '', error: 'Message is empty.' }
    }
    form.set('Body', params.body)
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64')

  let raw = ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    })
    raw = await res.text()
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }

    // Twilio success -> { sid, status: 'queued'|'sent'|... }; error -> { code, message, status: <http> }
    if (!res.ok || !parsed || parsed.sid === undefined) {
      const errMsg = parsed ? String(parsed.message ?? parsed.error_message ?? raw) : raw
      return { ok: false, status: 'failed', raw, error: (errMsg || `Twilio HTTP ${res.status}`).slice(0, 300) }
    }

    const sid = String(parsed.sid ?? '')
    const tStatus = String(parsed.status ?? '').toLowerCase()
    const failed = ['failed', 'undelivered'].includes(tStatus)
    return {
      ok: !failed,
      status: failed ? 'failed' : 'sent',
      providerRef: sid || undefined,
      raw,
      error: failed ? String(parsed.error_message ?? 'Message failed') : undefined,
    }
  } catch (err) {
    return {
      ok: false,
      status: 'failed',
      raw,
      error: err instanceof Error ? err.message : 'Network error contacting Twilio.',
    }
  }
}

/**
 * Send an approved WhatsApp template (marketing/utility) to a recipient.
 * Twilio: uses a Content Template (ContentSid) + merge variables keyed "1","2",...
 * mittos: falls back to the template URL send (best-effort).
 */
export async function sendWhatsAppTemplate(
  to: string,
  contentSid: string,
  variables: Record<string, string> = {}
): Promise<SendResult> {
  const provider = await getProvider()
  if (provider === 'twilio') {
    if (!contentSid || !contentSid.trim()) {
      return { ok: false, status: 'failed', raw: '', error: 'No approved template selected (Twilio ContentSid is empty).' }
    }
    return sendTwilio(to, { contentSid: contentSid.trim(), contentVariables: variables })
  }
  // mittos template path is provider-specific and configured via whatsapp_template_url;
  // left as a text send fallback until the mittos template payload is confirmed.
  return { ok: false, status: 'failed', raw: '', error: 'Template sending is only wired for Twilio right now.' }
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
  const provider = await getProvider()
  if (provider === 'twilio') {
    return sendTwilio(to, { body: message })
  }

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
  buttons: string[],
  opts: { header?: string; footer?: string } = {}
): Promise<SendResult> {
  const provider = await getProvider()
  if (provider === 'twilio') {
    // Twilio bakes buttons into an approved Content Template, so freeform quick-reply
    // isn't available in a session send - deliver the body as text (buttons arrive via
    // sendWhatsAppTemplate once the client has an approved ContentSid).
    return sendTwilio(to, { body: bodyText })
  }

  const url = await getSessionUrl()
  const phone = normalizePhone(to)
  if (!phone) {
    return { ok: false, status: 'failed', raw: '', error: 'Recipient phone number is empty or invalid.' }
  }
  if (!bodyText || !bodyText.trim()) {
    return { ok: false, status: 'failed', raw: '', error: 'Message is empty.' }
  }

  const payload = buildQuickReplyPayload(phone, bodyText, buttons, opts)

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

// mittosapi Quick Reply structure (confirmed from panel 2026-07-15):
// { type:'quick_reply', header, body, footer, buttons:[str,str,str], sender_phone }
function buildQuickReplyPayload(
  phone: string,
  bodyText: string,
  buttons: string[],
  opts: { header?: string; footer?: string } = {}
): Record<string, unknown> {
  const cleanButtons = buttons.map((b) => b.trim()).filter(Boolean).slice(0, 3)
  const payload: Record<string, unknown> = {
    type: 'quick_reply',
    body: bodyText,
    buttons: cleanButtons,
    sender_phone: phone,
  }
  if (opts.header && opts.header.trim()) payload.header = opts.header.trim()
  if (opts.footer && opts.footer.trim()) payload.footer = opts.footer.trim()
  return payload
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
