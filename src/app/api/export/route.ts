import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')

    const where: Record<string, unknown> = {}
    if (tag) {
      where.tags = { some: { tagId: tag } }
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format data for export
    const data = leads.map((lead) => ({
      Email: lead.email,
      'First Name': lead.firstName,
      'Last Name': lead.lastName,
      Company: lead.company || '',
      'Job Title': lead.jobTitle || '',
      Phone: lead.phone || '',
      Country: lead.country || '',
      City: lead.city || '',
      Website: lead.website || '',
      Source: lead.source || '',
      Status: lead.status,
      Verified: lead.verified ? 'Yes' : 'No',
      Tags: lead.tags.map((lt) => lt.tag.name).join(', '),
      'Created At': lead.createdAt.toISOString(),
    }))

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 30 }, // Email
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 25 }, // Company
      { wch: 20 }, // Job Title
      { wch: 15 }, // Phone
      { wch: 15 }, // Country
      { wch: 15 }, // City
      { wch: 25 }, // Website
      { wch: 15 }, // Source
      { wch: 10 }, // Status
      { wch: 8 },  // Verified
      { wch: 30 }, // Tags
      { wch: 20 }, // Created At
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads')

    // Write to buffer
    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export failed:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
