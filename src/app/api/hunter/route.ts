import { NextRequest, NextResponse } from 'next/server'
import { domainSearch, importHunterContacts } from '@/lib/hunter'
import { requireUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { action = 'search', domain = '', companyName = '', companyWebsite = '', tagIds = [], contacts = [] } = body

    if (action === 'import') {
      if (!contacts.length) {
        return NextResponse.json({ error: 'No contacts to import' }, { status: 400 })
      }
      const result = await importHunterContacts(contacts, companyName, companyWebsite, tagIds, user.userId)
      return NextResponse.json({
        message: `Imported ${result.imported} contacts (${result.skipped} skipped)`,
        ...result,
      })
    }

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }

    const result = await domainSearch(domain)

    return NextResponse.json({
      domain: result.domain,
      organization: result.organization,
      total: result.total,
      emails: result.emails.map(e => ({
        email: e.value,
        type: e.type,
        confidence: e.confidence,
        firstName: e.first_name,
        lastName: e.last_name,
        position: e.position,
        seniority: e.seniority,
        department: e.department,
        linkedin: e.linkedin,
        phone: e.phone_number,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Hunter search failed' },
      { status: 500 }
    )
  }
}
