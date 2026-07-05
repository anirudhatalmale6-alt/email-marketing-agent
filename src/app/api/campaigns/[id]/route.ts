import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        template: true,
        campaignLeads: {
          include: {
            lead: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                company: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const total = campaign.campaignLeads.length
    const sent = campaign.campaignLeads.filter((cl) => cl.status === 'sent').length
    const opened = campaign.campaignLeads.filter((cl) => cl.openedAt !== null).length
    const clicked = campaign.campaignLeads.filter((cl) => cl.clickedAt !== null).length
    const replied = campaign.campaignLeads.filter((cl) => cl.repliedAt !== null).length
    const failed = campaign.campaignLeads.filter((cl) => cl.status === 'failed').length

    return NextResponse.json({
      ...campaign,
      stats: {
        total,
        sent,
        opened,
        clicked,
        replied,
        failed,
        openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0',
        clickRate: sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0',
      },
    })
  } catch (error) {
    console.error('Failed to fetch campaign:', error)
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      name,
      subject,
      status,
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
      smtpConfigId,
    } = body

    const existing = await prisma.campaign.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(subject !== undefined && { subject }),
        ...(status !== undefined && { status }),
        ...(templateId !== undefined && { templateId }),
        ...(segmentTags !== undefined && {
          segmentTags: Array.isArray(segmentTags) ? JSON.stringify(segmentTags) : segmentTags,
        }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
        ...(dailyLimit !== undefined && { dailyLimit }),
        ...(delaySeconds !== undefined && { delaySeconds }),
        ...(aiPersonalize !== undefined && { aiPersonalize }),
        ...(followUpEnabled !== undefined && { followUpEnabled }),
        ...(followUpDays !== undefined && { followUpDays }),
        ...(followUpMaxCount !== undefined && { followUpMaxCount }),
        ...(fromName !== undefined && { fromName }),
        ...(fromEmail !== undefined && { fromEmail }),
        ...(smtpConfigId !== undefined && { smtpConfigId }),
      },
      include: { template: true },
    })

    return NextResponse.json(campaign)
  } catch (error) {
    console.error('Failed to update campaign:', error)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.campaign.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    await prisma.campaign.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete campaign:', error)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
