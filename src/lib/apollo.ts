import { prisma } from './prisma'

async function getApolloKey(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: 'apollo_api_key' } })
  if (!setting?.value) throw new Error('Apollo API key not configured. Go to Settings to add it.')
  return setting.value
}

interface ApolloContact {
  id: string
  first_name: string
  last_name: string
  name: string
  title: string
  email: string
  linkedin_url: string
  headline: string
  organization_name: string
  city: string
  state: string
  country: string
  phone_numbers?: Array<{ raw_number: string }>
  organization?: {
    website_url: string
  }
}

interface ApolloSearchResult {
  people: ApolloContact[]
  pagination: {
    page: number
    per_page: number
    total_entries: number
    total_pages: number
  }
}

export async function searchPeople(params: {
  jobTitles?: string[]
  keywords?: string[]
  locations?: string[]
  companyName?: string
  industry?: string
  page?: number
  perPage?: number
}): Promise<ApolloSearchResult> {
  const apiKey = await getApolloKey()

  const body: Record<string, unknown> = {
    page: params.page || 1,
    per_page: params.perPage || 25,
  }

  if (params.jobTitles?.length) {
    body.person_titles = params.jobTitles
  }
  if (params.keywords?.length) {
    body.q_keywords = params.keywords.join(' ')
  }
  if (params.locations?.length) {
    body.person_locations = params.locations
  }
  if (params.companyName) {
    body.q_organization_name = params.companyName
  }
  if (params.industry) {
    body.q_organization_keyword_tags = [params.industry]
  }

  // Try mixed_people/search first, fall back to contacts/search
  let res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    if (error.error_code === 'API_INACCESSIBLE') {
      // Fall back to contacts/search
      const contactBody: Record<string, unknown> = {
        page: body.page,
        per_page: body.per_page,
      }
      if (params.jobTitles?.length) contactBody.person_titles = params.jobTitles
      if (params.companyName) contactBody.q_organization_name = params.companyName
      if (params.locations?.length) contactBody.contact_locations = params.locations
      if (params.keywords?.length) contactBody.q_keywords = params.keywords.join(' ')

      res = await fetch('https://api.apollo.io/api/v1/contacts/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify(contactBody),
      })

      if (!res.ok) {
        const err2 = await res.json().catch(() => ({}))
        throw new Error(err2.error || `Apollo API error: ${res.status}`)
      }

      const contactData = await res.json()
      return {
        people: (contactData.contacts || []).map((c: Record<string, unknown>) => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          name: c.name,
          title: c.title,
          email: c.email,
          linkedin_url: c.linkedin_url,
          headline: c.headline,
          organization_name: c.organization_name,
          city: c.city,
          state: c.state,
          country: c.country,
          phone_numbers: c.phone_numbers,
          organization: c.organization,
        })),
        pagination: contactData.pagination || { page: 1, per_page: 25, total_entries: 0, total_pages: 0 },
      }
    }
    throw new Error(error.error || `Apollo API error: ${res.status}`)
  }

  return res.json()
}

export async function matchPerson(params: {
  firstName: string
  lastName: string
  organizationName?: string
  linkedinUrl?: string
}): Promise<ApolloContact | null> {
  const apiKey = await getApolloKey()

  const body: Record<string, string> = {
    first_name: params.firstName,
    last_name: params.lastName,
  }
  if (params.organizationName) body.organization_name = params.organizationName
  if (params.linkedinUrl) body.linkedin_url = params.linkedinUrl

  const res = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) return null

  const data = await res.json()
  return data.person || null
}

export async function importApolloContacts(
  contacts: ApolloContact[],
  tagIds: string[],
  userId?: string
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  for (const contact of contacts) {
    if (!contact.email) { skipped++; continue }

    try {
      const existing = await prisma.lead.findFirst({ where: { email: contact.email, ...(userId ? { userId } : {}) } })
      if (existing) { skipped++; continue }

      const lead = await prisma.lead.create({
        data: {
          email: contact.email,
          firstName: contact.first_name || '',
          lastName: contact.last_name || '',
          company: contact.organization_name || null,
          jobTitle: contact.title || null,
          phone: contact.phone_numbers?.[0]?.raw_number || null,
          country: contact.country || null,
          city: contact.city || null,
          website: contact.organization?.website_url || null,
          source: 'apollo',
          verified: true,
          status: 'new',
          ...(userId ? { userId } : {}),
        },
      })

      for (const tagId of tagIds) {
        await prisma.leadTag.create({
          data: { leadId: lead.id, tagId },
        })
      }

      imported++
    } catch {
      skipped++
    }
  }

  return { imported, skipped }
}
