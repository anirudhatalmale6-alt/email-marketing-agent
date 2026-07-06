import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
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

    // Detect if this is an ensun export (has "Name", "URI", "Headquarter" columns)
    const firstRow = rows[0]
    const columnKeys = Object.keys(firstRow)
    const isEnsunFormat = columnKeys.some(k => k === 'Name') &&
      columnKeys.some(k => k === 'URI' || k === 'Headquarter')

    let imported = 0
    let skipped = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      if (isEnsunFormat) {
        // ensun company export format
        const companyName = findColumn(row, ['name'])
        const uri = findColumn(row, ['uri'])
        const headquarter = findColumn(row, ['headquarter'])
        const emails = findColumn(row, ['emails'])
        const phone = findColumn(row, ['phone'])
        const linkedin = findColumn(row, ['linkedin'])
        const description = findColumn(row, ['description'])
        const size = findColumn(row, ['size'])
        const specializedAreas = findColumn(row, ['specializedareas', 'specialized areas'])
        const industry = findColumn(row, ['workingindustry', 'working industry'])

        if (!companyName) { skipped++; continue }

        // Extract city/country from headquarter (format: "City, Province, Country")
        const hqParts = headquarter.split(',').map(s => s.trim())
        const city = hqParts[0] || ''
        const country = hqParts[hqParts.length - 1] || ''

        // Use ensun email if available, otherwise generate from website domain
        let email = ''
        if (emails) {
          email = emails.split(',')[0].trim()
        } else if (uri) {
          try {
            const domain = new URL(uri.startsWith('http') ? uri : `https://${uri}`).hostname.replace('www.', '')
            email = `info@${domain}`
          } catch {
            email = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}@placeholder.ensun`
          }
        } else {
          email = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}@placeholder.ensun`
        }

        try {
          const existing = await prisma.lead.findFirst({ where: { email, userId: user.userId } })
          if (existing) {
            if (parsedTagIds.length > 0) {
              for (const tagId of parsedTagIds) {
                await prisma.leadTag.upsert({
                  where: { leadId_tagId: { leadId: existing.id, tagId } },
                  update: {},
                  create: { leadId: existing.id, tagId },
                })
              }
            }
            skipped++; continue
          }

          const lead = await prisma.lead.create({
            data: {
              email,
              firstName: companyName,
              lastName: '',
              company: companyName,
              jobTitle: size ? `Company (${size} employees)` : 'Company',
              phone: phone || null,
              country: country || null,
              city: city || null,
              website: uri || null,
              source: 'ensun',
              verified: false,
              status: 'new',
              userId: user.userId,
            },
          })

          if (parsedTagIds.length > 0) {
            await prisma.leadTag.createMany({
              data: parsedTagIds.map((tagId) => ({ leadId: lead.id, tagId })),
            })
          }

          // Auto-create tags from industry/specialized areas
          if (industry) {
            let tag = await prisma.tag.findFirst({ where: { name: industry, userId: user.userId } })
            if (!tag) {
              tag = await prisma.tag.create({ data: { name: industry, color: '#6366F1', userId: user.userId } })
            }
            await prisma.leadTag.upsert({
              where: { leadId_tagId: { leadId: lead.id, tagId: tag.id } },
              update: {},
              create: { leadId: lead.id, tagId: tag.id },
            })
          }

          imported++
        } catch (err) {
          errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          failed++
        }
        continue
      }

      // Standard lead import format (with email field)
      const email = findColumn(row, ['email', 'emailaddress', 'email_address', 'e-mail', 'emails'])
      const firstName = findColumn(row, ['firstname', 'first_name', 'first', 'name', 'givenname'])
      const lastName = findColumn(row, ['lastname', 'last_name', 'last', 'surname', 'familyname'])

      if (!email) {
        skipped++
        continue
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Row ${i + 2}: Invalid email "${email}"`)
        failed++
        continue
      }

      try {
        const existing = await prisma.lead.findFirst({ where: { email, userId: user.userId } })
        if (existing) {
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
            website: findColumn(row, ['website', 'url', 'web', 'homepage', 'uri']) || null,
            source: findColumn(row, ['source', 'leadsource', 'lead_source']) || 'import',
            userId: user.userId,
          },
        })

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
