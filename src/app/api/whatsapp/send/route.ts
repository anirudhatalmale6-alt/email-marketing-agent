import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppText, sendWhatsAppQuickReply, sendWhatsAppTemplate, logWhatsAppMessage, fillTokens, normalizePhone } from '@/lib/whatsapp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawTo: string = body.to || ''
    let message: string = body.message || ''
    const leadId: string | undefined = body.leadId || undefined
    const mode: string = ['buttons', 'template'].includes(body.mode) ? body.mode : 'text'
    const buttons: string[] = Array.isArray(body.buttons) ? body.buttons : []
    const header: string = typeof body.header === 'string' ? body.header : ''
    const footer: string = typeof body.footer === 'string' ? body.footer : ''
    const contentSid: string = typeof body.contentSid === 'string' ? body.contentSid.trim() : ''
    const variablesIn: Record<string, string> =
      body.variables && typeof body.variables === 'object' && !Array.isArray(body.variables) ? body.variables : {}

    // Template mode carries no free-form message (the body lives in the approved template).
    if (mode !== 'template' && !message.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    }
    if (mode === 'template' && !contentSid) {
      return NextResponse.json({ error: 'An approved template (Content SID) is required for template sends.' }, { status: 400 })
    }

    let to = rawTo
    let lead = null
    const tokenVars: Record<string, string> = { date: body.date || '' }

    // If a lead is chosen, pull its number (unless an explicit number was given) and
    // resolve personalisation tokens from the lead's fields.
    if (leadId) {
      lead = await prisma.lead.findUnique({ where: { id: leadId } })
      if (!lead) {
        return NextResponse.json({ error: 'Selected customer not found.' }, { status: 404 })
      }
      if (!to.trim()) to = lead.phone || ''
      Object.assign(tokenVars, {
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        company: lead.company || '',
        email: lead.email || '',
      })
    }
    message = fillTokens(message, tokenVars)
    // Resolve any {{token}} left inside template variable values too.
    const variables: Record<string, string> = {}
    for (const [k, v] of Object.entries(variablesIn)) variables[k] = fillTokens(String(v ?? ''), tokenVars)

    if (!normalizePhone(to)) {
      return NextResponse.json(
        { error: 'No valid phone number. Enter a number (with country code) or pick a customer who has a phone saved.' },
        { status: 400 }
      )
    }

    const useButtons = mode === 'buttons' && buttons.length > 0
    const result =
      mode === 'template'
        ? await sendWhatsAppTemplate(to, contentSid, variables)
        : useButtons
        ? await sendWhatsAppQuickReply(to, message, buttons, { header, footer })
        : await sendWhatsAppText(to, message)

    await logWhatsAppMessage({
      leadId: lead?.id,
      direction: 'outbound',
      toNumber: normalizePhone(to),
      messageType: mode === 'template' ? 'template' : useButtons ? 'buttons' : 'text',
      body: mode === 'template' ? (message.trim() || `[template ${contentSid}] ${JSON.stringify(variables)}`) : message,
      status: result.status,
      providerRef: result.providerRef,
      rawResponse: result.raw,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'WhatsApp provider rejected the message.', raw: result.raw },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, status: result.status, providerRef: result.providerRef, raw: result.raw })
  } catch (error) {
    console.error('WhatsApp send failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send WhatsApp message.' },
      { status: 500 }
    )
  }
}
