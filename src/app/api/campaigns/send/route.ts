import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { runCampaignBatch } from '@/lib/campaign-runner'

// Give each batch as much room as the platform allows. The runner itself keeps
// the actual work under ~40s so this is just a safety ceiling.
export const maxDuration = 60

export async function POST(request: NextRequest) {
  let campaignId: string | undefined
  try {
    const user = await requireUser()
    const body = await request.json()
    campaignId = body?.campaignId

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: user.userId },
      include: { template: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!campaign.template) {
      return NextResponse.json({ error: 'Campaign has no template assigned' }, { status: 400 })
    }

    const result = await runCampaignBatch(campaignId)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Campaign send failed'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Campaign send failed:', error)

    // Mark the campaign failed so it isn't stuck on "sending" forever.
    if (campaignId) {
      try {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'failed' },
        })
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
