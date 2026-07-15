import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logWhatsAppMessage, normalizePhone } from '@/lib/whatsapp'

// Inbound webhook for mittosapi. The exact payload field names vary by gateway,
// so we defensively read the common ones. Configure this URL as the "webhook" /
// "callback" in the mittosapi panel to capture customer replies (e.g. "received").
//
// Some gateways verify the endpoint with a GET first — answer 200 so setup passes.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // Echo a verification challenge if the provider sends one.
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  return ''
}

export async function POST(request: NextRequest) {
  try {
    let payload: Record<string, unknown> = {}
    const ct = request.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      payload = await request.json().catch(() => ({}))
    } else {
      const form = await request.formData().catch(() => null)
      if (form) {
        for (const [k, v] of form.entries()) payload[k] = typeof v === 'string' ? v : ''
      }
    }

    // Unwrap one level of nesting if the provider wraps in { data: {...} } / { message: {...} }
    const inner =
      (payload.data as Record<string, unknown>) ||
      (payload.message as Record<string, unknown>) ||
      payload

    const from = normalizePhone(pick(inner, ['from', 'sender', 'sender_phone', 'phone', 'number', 'wa_id', 'mobile']))
    // A button reply may arrive as plain text (the button title) or in a dedicated field.
    const text = pick(inner, [
      'button', 'button_text', 'button_reply', 'button_title', 'reply', 'payload', 'selected',
      'message', 'text', 'body', 'content', 'msg',
    ])
    const to = normalizePhone(pick(inner, ['to', 'receiver', 'recipient', 'display_phone_number']))

    if (!from && !text) {
      // Nothing usable — acknowledge so the provider doesn't retry forever.
      return NextResponse.json({ ok: true, ignored: true })
    }

    // Try to link the reply to a known lead by phone number (match on trailing digits).
    let leadId: string | null = null
    if (from) {
      const last8 = from.slice(-8)
      const lead = await prisma.lead.findFirst({
        where: { phone: { contains: last8 } },
        select: { id: true },
      })
      leadId = lead?.id || null
    }

    await logWhatsAppMessage({
      leadId,
      direction: 'inbound',
      toNumber: to || 'us',
      fromNumber: from || null,
      messageType: 'text',
      body: text || '(no text)',
      status: 'received',
      rawResponse: JSON.stringify(payload).slice(0, 2000),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    // Always 200 so the provider considers delivery successful and doesn't spam retries.
    return NextResponse.json({ ok: true })
  }
}
