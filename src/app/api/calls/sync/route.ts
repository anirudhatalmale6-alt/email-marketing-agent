import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { getBlandCall } from '@/lib/bland'

// Pulls the latest status/result of any still-in-progress calls directly from
// Bland and updates our records. Used as a fallback / refresh so results show
// even if the completion webhook isn't wired up (e.g. during local testing).
export async function POST() {
  try {
    const user = await requireUser()

    const pending = await prisma.call.findMany({
      where: { userId: user.userId, status: { in: ['queued', 'initiated'] }, blandCallId: { not: null } },
      take: 25,
    })

    let updated = 0
    for (const call of pending) {
      if (!call.blandCallId) continue
      try {
        const data = await getBlandCall(call.blandCallId)
        const completed = data.completed === true || data.status === 'completed'
        if (!completed) continue

        const answeredBy = (data.answered_by as string | undefined) || undefined
        const summary = (data.summary as string | undefined) || undefined
        const transcript = (data.concatenated_transcript as string | undefined) || undefined
        const recordingUrl = (data.recording_url as string | undefined) || undefined
        const callLength = typeof data.call_length === 'number' ? data.call_length : undefined
        const durationSec = callLength !== undefined ? Math.round(callLength * 60) : undefined

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
        updated++
      } catch {
        // skip this one; try again next refresh
      }
    }

    return NextResponse.json({ success: true, updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Call sync failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
