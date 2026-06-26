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

  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
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
      throw new Error('Apollo API endpoint not accessible. Make sure api/v1/mixed_people/search is enabled for your API key.')
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
  tagIds: string[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  for (const contact of contacts) {
    if (!contact.email) { skipped++; continue }

    try {
      const existing = await prisma.lead.findUnique({ where: { email: contact.email } })
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
