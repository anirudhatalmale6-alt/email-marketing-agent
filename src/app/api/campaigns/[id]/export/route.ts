import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/auth'

// Exports a per-recipient engagement report for one campaign as an .xlsx:
// who it was sent to, whether it was delivered/failed, and who opened/clicked.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // optional: opened | clicked | failed

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.userId },
    })
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaignLeads = await prisma.campaignLead.findMany({
      where: { campaignId: id },
      include: { lead: true },
      orderBy: { createdAt: 'asc' },
    })

    let rows = campaignLeads
    if (filter === 'opened') rows = rows.filter((cl) => cl.openedAt)
    else if (filter === 'clicked') rows = rows.filter((cl) => cl.clickedAt)
    else if (filter === 'failed') rows = rows.filter((cl) => cl.status === 'failed')

    const data = rows.map((cl) => ({
      Email: cl.lead?.email || '',
      'First Name': cl.lead?.firstName || '',
      'Last Name': cl.lead?.lastName || '',
      Company: cl.lead?.company || '',
      Status: cl.status === 'failed' ? 'Failed / Bounced' : cl.status === 'sent' ? 'Sent' : cl.status,
      'Sent At': cl.sentAt ? cl.sentAt.toISOString() : '',
      Opened: cl.openedAt ? 'Yes' : 'No',
      'Opened At': cl.openedAt ? cl.openedAt.toISOString() : '',
      Clicked: cl.clickedAt ? 'Yes' : 'No',
      'Clicked At': cl.clickedAt ? cl.clickedAt.toISOString() : '',
    }))

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)
    worksheet['!cols'] = [
      { wch: 32 }, // Email
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 25 }, // Company
      { wch: 16 }, // Status
      { wch: 22 }, // Sent At
      { wch: 8 },  // Opened
      { wch: 22 }, // Opened At
      { wch: 8 },  // Clicked
      { wch: 22 }, // Clicked At
    ]
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const safeName = (campaign.name || 'campaign').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const suffix = filter ? `-${filter}` : ''

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeName}-report${suffix}.xlsx"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Campaign export failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
