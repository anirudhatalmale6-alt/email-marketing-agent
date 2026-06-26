import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        campaignLeads: {
          include: {
            campaign: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        emailEvents: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Failed to fetch lead:', error)
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { email, firstName, lastName, company, jobTitle, phone, country, city, website, source, verified, status } = body

    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (email && email !== existing.email) {
      const duplicate = await prisma.lead.findUnique({ where: { email } })
      if (duplicate) {
        return NextResponse.json({ error: 'A lead with this email already exists' }, { status: 409 })
      }
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(email !== undefined && { email }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(company !== undefined && { company }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(phone !== undefined && { phone }),
        ...(country !== undefined && { country }),
        ...(city !== undefined && { city }),
        ...(website !== undefined && { website }),
        ...(source !== undefined && { source }),
        ...(verified !== undefined && { verified }),
        ...(status !== undefined && { status }),
      },
      include: {
        tags: { include: { tag: true } },
      },
    })

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Failed to update lead:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    await prisma.lead.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete lead:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
