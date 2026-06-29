import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: {
        template: { select: { id: true, name: true } },
        _count: {
          select: { campaignLeads: true },
        },
        campaignLeads: {
          select: {
            status: true,
            openedAt: true,
            clickedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = campaigns.map((campaign) => {
      const total = campaign.campaignLeads.length
      const sent = campaign.campaignLeads.filter((cl) => cl.status === 'sent').length
      const opened = campaign.campaignLeads.filter((cl) => cl.openedAt !== null).length
      const clicked = campaign.campaignLeads.filter((cl) => cl.clickedAt !== null).length

      return {
        ...campaign,
        campaignLeads: undefined,
        _count: undefined,
        stats: {
          total,
          sent,
          opened,
          clicked,
          openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0',
          clickRate: sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0',
        },
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch campaigns:', error)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      subject,
      templateId,
      segmentTags,
      scheduledAt,
      dailyLimit,
      delaySeconds,
      aiPersonalize,
      followUpEnabled,
      followUpDays,
      followUpMaxCount,
      fromName,
      fromEmail,
    } = body

    if (!name || !subject) {
      return NextResponse.json({ error: 'name and subject are required' }, { status: 400 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        subject,
        templateId: templateId || null,
        segmentTags: Array.isArray(segmentTags) ? JSON.stringify(segmentTags) : segmentTags || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        dailyLimit: dailyLimit || 1000,
        delaySeconds: delaySeconds ?? 30,
        aiPersonalize: aiPersonalize || false,
        followUpEnabled: followUpEnabled || false,
        followUpDays: followUpDays || 3,
        followUpMaxCount: followUpMaxCount || 2,
        fromName: fromName || null,
        fromEmail: fromEmail || null,
      },
      include: {
        template: true,
      },
    })

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    console.error('Failed to create campaign:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}
