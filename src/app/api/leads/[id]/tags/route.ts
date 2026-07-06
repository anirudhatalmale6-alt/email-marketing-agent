import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser()
    const { id: leadId } = await params
    const body = await request.json()
    const { tagIds } = body

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json({ error: 'tagIds array is required' }, { status: 400 })
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const existingTags = await prisma.leadTag.findMany({
      where: { leadId, tagId: { in: tagIds } },
    })
    const existingTagIds = new Set(existingTags.map((lt) => lt.tagId))
    const newTagIds = tagIds.filter((id: string) => !existingTagIds.has(id))

    if (newTagIds.length > 0) {
      await prisma.leadTag.createMany({
        data: newTagIds.map((tagId: string) => ({ leadId, tagId })),
      })
    }

    const updatedLead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { tags: { include: { tag: true } } },
    })

    return NextResponse.json(updatedLead)
  } catch (error) {
    console.error('Failed to assign tags:', error)
    return NextResponse.json({ error: 'Failed to assign tags' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser()
    const { id: leadId } = await params
    const body = await request.json()
    const { tagId } = body

    if (!tagId) {
      return NextResponse.json({ error: 'tagId is required' }, { status: 400 })
    }

    await prisma.leadTag.deleteMany({
      where: { leadId, tagId },
    })

    const updatedLead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { tags: { include: { tag: true } } },
    })

    return NextResponse.json(updatedLead)
  } catch (error) {
    console.error('Failed to remove tag:', error)
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 })
  }
}
