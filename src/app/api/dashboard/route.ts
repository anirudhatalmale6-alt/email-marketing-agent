import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireUser()
    const userFilter = { userId: user.userId }

    const [
      totalLeads,
      totalCampaigns,
      totalSent,
      totalOpened,
      totalClicked,
      recentCampaigns,
      leadsByStatus,
      recentLeads,
    ] = await Promise.all([
      prisma.lead.count({ where: userFilter }),
      prisma.campaign.count({ where: userFilter }),
      prisma.campaignLead.count({ where: { status: 'sent', campaign: userFilter } }),
      prisma.campaignLead.count({ where: { openedAt: { not: null }, campaign: userFilter } }),
      prisma.campaignLead.count({ where: { clickedAt: { not: null }, campaign: userFilter } }),
      prisma.campaign.findMany({
        where: userFilter,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { campaignLeads: true } },
          campaignLeads: {
            select: {
              status: true,
              openedAt: true,
              clickedAt: true,
            },
          },
        },
      }),
      prisma.lead.groupBy({
        by: ['status'],
        where: userFilter,
        _count: { status: true },
      }),
      prisma.lead.findMany({
        where: userFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
          createdAt: true,
        },
      }),
    ])

    const formattedCampaigns = recentCampaigns.map((c) => {
      const sent = c.campaignLeads.filter((cl) => cl.status === 'sent').length
      const opened = c.campaignLeads.filter((cl) => cl.openedAt !== null).length
      const clicked = c.campaignLeads.filter((cl) => cl.clickedAt !== null).length

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        createdAt: c.createdAt,
        stats: {
          total: c.campaignLeads.length,
          sent,
          opened,
          clicked,
          openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0',
          clickRate: sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0',
        },
      }
    })

    return NextResponse.json({
      totalLeads,
      totalCampaigns,
      emailsSent: totalSent,
      openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      recentCampaigns: formattedCampaigns.map(c => ({
        ...c,
        sentCount: c.stats.sent,
        openCount: c.stats.opened,
        clickCount: c.stats.clicked,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}
