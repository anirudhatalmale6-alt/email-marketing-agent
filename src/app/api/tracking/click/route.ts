import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const campaignLeadId = searchParams.get('id')
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  const decodedUrl = decodeURIComponent(url)

  try {
    if (campaignLeadId) {
      const campaignLead = await prisma.campaignLead.findUnique({
        where: { id: campaignLeadId },
      })

      if (campaignLead) {
        // Only set clickedAt if not already recorded
        if (!campaignLead.clickedAt) {
          await prisma.campaignLead.update({
            where: { id: campaignLeadId },
            data: { clickedAt: new Date() },
          })
        }

        // Always create an EmailEvent for each click
        await prisma.emailEvent.create({
          data: {
            campaignLeadId,
            leadId: campaignLead.leadId,
            type: 'click',
            metadata: JSON.stringify({ url: decodedUrl }),
          },
        })
      }
    }
  } catch (error) {
    console.error('Tracking click error:', error)
  }

  // Always redirect to the original URL
  return NextResponse.redirect(decodedUrl, 302)
}
