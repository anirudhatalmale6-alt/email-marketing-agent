import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

// Delete many leads at once. The frontend LeadTable posts { ids: string[] } here.
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }

    // Scope strictly to the current user's leads so nobody can delete across tenants.
    const result = await prisma.lead.deleteMany({
      where: { id: { in: ids }, userId: user.userId },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk delete failed'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Bulk delete failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
