import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const tagIds = formData.get('tagIds') as string | null

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Parse with xlsx
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'No sheets found in file' }, { status: 400 })
    }

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 })
    }

    // Parse tag IDs if provided
    let parsedTagIds: string[] = []
    if (tagIds) {
      try {
        parsedTagIds = JSON.parse(tagIds)
      } catch {
        parsedTagIds = tagIds.split(',').map((t) => t.trim()).filter(Boolean)
      }
    }

    // Column name mapping (case-insensitive, flexible)
    function findColumn(row: Record<string, unknown>, names: string[]): string {
      for (const name of names) {
        for (const key of Object.keys(row)) {
          if (key.toLowerCase().replace(/[_\s-]/g, '') === name.toLowerCase().replace(/[_\s-]/g, '')) {
            return String(row[key] || '')
          }
        }
      }
      return ''
    }

    let imported = 0
    let skipped = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const email = findColumn(row, ['email', 'emailaddress', 'email_address', 'e-mail'])
      const firstName = findColumn(row, ['firstname', 'first_name', 'first', 'name', 'givenname'])
      const lastName = findColumn(row, ['lastname', 'last_name', 'last', 'surname', 'familyname'])

      if (!email) {
        skipped++
        continue
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Row ${i + 2}: Invalid email "${email}"`)
        failed++
        continue
      }

      try {
        // Check for existing lead
        const existing = await prisma.lead.findUnique({ where: { email } })
        if (existing) {
          // If tags provided, add them to existing lead
          if (parsedTagIds.length > 0) {
            for (const tagId of parsedTagIds) {
              await prisma.leadTag.upsert({
                where: { leadId_tagId: { leadId: existing.id, tagId } },
                update: {},
                create: { leadId: existing.id, tagId },
              })
            }
          }
          skipped++
          continue
        }

        const lead = await prisma.lead.create({
          data: {
            email,
            firstName: firstName || email.split('@')[0],
            lastName: lastName || '',
            company: findColumn(row, ['company', 'organization', 'org', 'companyname']) || null,
            jobTitle: findColumn(row, ['jobtitle', 'job_title', 'title', 'position', 'role']) || null,
            phone: findColumn(row, ['phone', 'telephone', 'tel', 'phonenumber', 'mobile']) || null,
            country: findColumn(row, ['country', 'nation', 'countryname']) || null,
            city: findColumn(row, ['city', 'town', 'location']) || null,
            website: findColumn(row, ['website', 'url', 'web', 'homepage']) || null,
            source: findColumn(row, ['source', 'leadsource', 'lead_source']) || 'import',
          },
        })

        // Assign tags if provided
        if (parsedTagIds.length > 0) {
          await prisma.leadTag.createMany({
            data: parsedTagIds.map((tagId) => ({ leadId: lead.id, tagId })),
          })
        }

        imported++
      } catch (err) {
        errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      imported,
      skipped,
      failed,
      errors: errors.slice(0, 20), // Limit error messages
    })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
