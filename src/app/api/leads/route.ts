import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const tag = searchParams.get('tag')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { company: { contains: search } },
      ]
    }

    if (tag) {
      where.tags = {
        some: { tagId: tag },
      }
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(leads)
  } catch (error) {
    console.error('Failed to fetch leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, firstName, lastName, company, jobTitle, phone, country, city, website, source, tagIds } = body

    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: 'email, firstName, and lastName are required' }, { status: 400 })
    }

    const existing = await prisma.lead.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'A lead with this email already exists' }, { status: 409 })
    }

    const lead = await prisma.lead.create({
      data: {
        email,
        firstName,
        lastName,
        company: company || null,
        jobTitle: jobTitle || null,
        phone: phone || null,
        country: country || null,
        city: city || null,
        website: website || null,
        source: source || null,
        tags: tagIds?.length
          ? {
              create: tagIds.map((tagId: string) => ({ tagId })),
            }
          : undefined,
      },
      include: {
        tags: { include: { tag: true } },
      },
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Failed to create lead:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
