import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runCampaign } from '@/lib/campaign-runner'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { template: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Campaign is already being sent' }, { status: 400 })
    }

    if (!campaign.template) {
      return NextResponse.json({ error: 'Campaign has no template assigned' }, { status: 400 })
    }

    const result = await runCampaign(id)

    return NextResponse.json({
      success: true,
      stats: {
        totalLeads: result.total,
        sent: result.sent,
      },
    })
  } catch (error) {
    console.error('Campaign send failed:', error)

    try {
      const { id } = await params
      await prisma.campaign.update({
        where: { id },
        data: { status: 'failed' },
      })
    } catch {
      // Ignore
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Campaign send failed' },
      { status: 500 }
    )
  }
}
