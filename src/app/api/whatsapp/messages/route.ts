import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)
    const direction = searchParams.get('direction') // optional filter

    const messages = await prisma.whatsAppMessage.findMany({
      where: direction ? { direction } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
      },
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Failed to fetch WhatsApp messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}
