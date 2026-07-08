import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Bland posts the completed call data here when a call ends. No user auth -
// Bland is the caller - so we match the call by the callRecordId we passed in
// metadata (falling back to the Bland call_id).
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}))

    const metadata = (payload?.metadata || {}) as Record<string, unknown>
    const callRecordId = typeof metadata.callRecordId === 'string' ? metadata.callRecordId : undefined
    const blandCallId = payload?.call_id as string | undefined

    let call = null
    if (callRecordId) {
      call = await prisma.call.findUnique({ where: { id: callRecordId } })
    }
    if (!call && blandCallId) {
      call = await prisma.call.findFirst({ where: { blandCallId } })
    }
    if (!call) {
      // Nothing to attach this to - acknowledge so Bland stops retrying.
      return NextResponse.json({ received: true })
    }

    const answeredBy = (payload?.answered_by as string | undefined) || undefined
    const summary = (payload?.summary as string | undefined) || undefined
    const transcript =
      (payload?.concatenated_transcript as string | undefined) ||
      (Array.isArray(payload?.transcripts)
        ? payload.transcripts
            .map((t: { user?: string; text?: string }) => `${t.user || 'speaker'}: ${t.text || ''}`)
            .join('\n')
        : undefined)
    const recordingUrl = (payload?.recording_url as string | undefined) || undefined

    const callLength = typeof payload?.call_length === 'number' ? payload.call_length : undefined
    const durationSec = callLength !== undefined ? Math.round(callLength * 60) : undefined

    // Simple outcome for the obvious cases; the summary carries the detail.
    let outcome: string | undefined
    if (answeredBy && ['voicemail', 'no-answer', 'unknown'].includes(answeredBy)) {
      outcome = 'no_answer'
    }

    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: 'completed',
        ...(answeredBy !== undefined && { answeredBy }),
        ...(summary !== undefined && { summary }),
        ...(transcript !== undefined && { transcript }),
        ...(recordingUrl !== undefined && { recordingUrl }),
        ...(durationSec !== undefined && { durationSec }),
        ...(outcome !== undefined && { outcome }),
      },
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Call webhook error:', error)
    // Still 200 so Bland doesn't hammer us with retries.
    return NextResponse.json({ received: false })
  }
}
