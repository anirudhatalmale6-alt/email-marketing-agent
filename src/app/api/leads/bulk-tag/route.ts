import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

// Assign a single tag to many leads at once. The frontend LeadTable posts
// { ids: string[], tagId: string } here.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    const tagId: string | undefined = body?.tagId

    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }
    if (!tagId) {
      return NextResponse.json({ error: 'tagId is required' }, { status: 400 })
    }

    // Make sure the tag belongs to this user.
    const tag = await prisma.tag.findFirst({ where: { id: tagId, userId: user.userId } })
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Only operate on leads this user actually owns.
    const ownedLeads = await prisma.lead.findMany({
      where: { id: { in: ids }, userId: user.userId },
      select: { id: true },
    })

    // Skip leads that already carry this tag so we don't hit the unique constraint.
    const alreadyTagged = await prisma.leadTag.findMany({
      where: { tagId, leadId: { in: ownedLeads.map((l) => l.id) } },
      select: { leadId: true },
    })
    const alreadySet = new Set(alreadyTagged.map((lt) => lt.leadId))
    const toCreate = ownedLeads.filter((l) => !alreadySet.has(l.id))

    if (toCreate.length > 0) {
      await prisma.leadTag.createMany({
        data: toCreate.map((l) => ({ leadId: l.id, tagId })),
      })
    }

    return NextResponse.json({ success: true, tagged: toCreate.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk tag failed'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Bulk tag failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
