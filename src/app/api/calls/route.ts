import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { sendBlandCall, buildCallTask, buildFirstSentence, getSummaryPrompt } from '@/lib/bland'

// List recent calls for the current user (most recent first).
export async function GET() {
  try {
    const user = await requireUser()
    const calls = await prisma.call.findMany({
      where: { userId: user.userId },
      include: { lead: { select: { id: true, firstName: true, lastName: true, company: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(calls)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch calls'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Failed to fetch calls:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Place an outbound AI call to a lead (or an ad-hoc number).
export async function POST(request: NextRequest) {
  let callRecordId: string | undefined
  try {
    const user = await requireUser()
    const body = await request.json()
    const allowedTypes = ['prospect', 'customer', 'feedback']
    const callType: string = allowedTypes.includes(body?.callType) ? body.callType : 'prospect'
    const leadId: string | undefined = body?.leadId || undefined

    let name = ''
    let company = ''
    let toNumber: string = (body?.toNumber || '').trim()

    if (leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId, userId: user.userId } })
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
      company = lead.company || ''
      if (!toNumber) toNumber = (lead.phone || '').trim()
    }

    if (!toNumber) {
      return NextResponse.json({ error: 'No phone number to call. Add a phone number for this lead or enter one.' }, { status: 400 })
    }

    // Basic E.164 sanity check - must start with + and country code.
    const normalized = toNumber.replace(/[\s()-]/g, '')
    if (!/^\+\d{7,15}$/.test(normalized)) {
      return NextResponse.json(
        { error: `"${toNumber}" is not a valid international number. Use the full format with country code, e.g. +14155550123 or +919812345678.` },
        { status: 400 }
      )
    }

    const appUrlSetting = await prisma.setting.findUnique({ where: { key: 'app_url' } })
    const baseUrl = appUrlSetting?.value

    // Create the local record first so the webhook can match it via metadata.
    const call = await prisma.call.create({
      data: {
        leadId: leadId || null,
        userId: user.userId,
        callType,
        toNumber: normalized,
        status: 'queued',
      },
    })
    callRecordId = call.id

    const task = buildCallTask(callType, name, company)
    const firstSentence = buildFirstSentence(callType, name.split(' ')[0] || '')

    const { callId } = await sendBlandCall({
      phoneNumber: normalized,
      task,
      firstSentence,
      requestData: { name, company },
      summaryPrompt: getSummaryPrompt(callType),
      metadata: { callRecordId: call.id },
      // Only pass a webhook if we have a public base URL (localhost won't work).
      webhook: baseUrl && baseUrl.startsWith('https://') ? `${baseUrl}/api/calls/webhook` : undefined,
    })

    const updated = await prisma.call.update({
      where: { id: call.id },
      data: { blandCallId: callId, status: 'initiated' },
    })

    return NextResponse.json({ success: true, call: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to place call'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Failed to place call:', error)
    if (callRecordId) {
      try {
        await prisma.call.update({ where: { id: callRecordId }, data: { status: 'failed', summary: message } })
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
