import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireUser()
    const tags = await prisma.tag.findMany({
      where: { userId: user.userId },
      include: {
        _count: {
          select: { leads: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const result = tags.map((tag) => ({
      ...tag,
      leadCount: tag._count.leads,
      _count: undefined,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { name, color } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const existing = await prisma.tag.findFirst({ where: { name, userId: user.userId } })
    if (existing) {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 })
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color: color || '#3B82F6',
        userId: user.userId,
      },
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    console.error('Failed to create tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
