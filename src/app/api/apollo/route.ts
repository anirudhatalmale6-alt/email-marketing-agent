import { NextRequest, NextResponse } from 'next/server'
import { searchPeople, importApolloContacts } from '@/lib/apollo'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      action = 'search',
      jobTitles = [],
      keywords = [],
      locations = [],
      companyName = '',
      industry = '',
      page = 1,
      perPage = 25,
      tagIds = [],
      contacts = [],
    } = body

    if (action === 'import') {
      if (!contacts.length) {
        return NextResponse.json({ error: 'No contacts to import' }, { status: 400 })
      }
      const result = await importApolloContacts(contacts, tagIds)
      return NextResponse.json({
        message: `Imported ${result.imported} contacts (${result.skipped} skipped)`,
        ...result,
      })
    }

    const result = await searchPeople({
      jobTitles: jobTitles.length ? jobTitles : undefined,
      keywords: keywords.length ? keywords : undefined,
      locations: locations.length ? locations : undefined,
      companyName: companyName || undefined,
      industry: industry || undefined,
      page,
      perPage,
    })

    return NextResponse.json({
      people: result.people.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        name: p.name,
        title: p.title,
        email: p.email,
        linkedinUrl: p.linkedin_url,
        headline: p.headline,
        company: p.organization_name,
        city: p.city,
        state: p.state,
        country: p.country,
        phone: p.phone_numbers?.[0]?.raw_number || null,
        website: p.organization?.website_url || null,
      })),
      pagination: result.pagination,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Apollo search failed' },
      { status: 500 }
    )
  }
}
