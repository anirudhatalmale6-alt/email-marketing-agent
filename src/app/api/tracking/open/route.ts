import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 1x1 transparent GIF as a Buffer
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignLeadId = searchParams.get('id')

    if (campaignLeadId) {
      const campaignLead = await prisma.campaignLead.findUnique({
        where: { id: campaignLeadId },
      })

      if (campaignLead) {
        // Only set openedAt if not already recorded
        if (!campaignLead.openedAt) {
          await prisma.campaignLead.update({
            where: { id: campaignLeadId },
            data: { openedAt: new Date() },
          })
        }

        // Always create an EmailEvent for each open
        await prisma.emailEvent.create({
          data: {
            campaignLeadId,
            leadId: campaignLead.leadId,
            type: 'open',
          },
        })
      }
    }
  } catch (error) {
    console.error('Tracking open error:', error)
  }

  // Always return the transparent GIF regardless of errors
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': TRANSPARENT_GIF.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}
