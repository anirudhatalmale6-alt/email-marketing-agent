import { prisma } from './prisma'

async function getHunterKey(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: 'hunter_api_key' } })
  if (!setting?.value) throw new Error('Hunter.io API key not configured. Go to Settings to add it.')
  return setting.value
}

export interface HunterEmail {
  value: string
  type: string
  confidence: number
  first_name: string | null
  last_name: string | null
  position: string | null
  seniority: string | null
  department: string | null
  linkedin: string | null
  phone_number: string | null
}

interface HunterDomainResult {
  domain: string
  organization: string
  emails: HunterEmail[]
  total: number
}

export async function domainSearch(domain: string): Promise<HunterDomainResult> {
  const apiKey = await getHunterKey()

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(cleanDomain)}&api_key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url)

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.errors?.[0]?.details || `Hunter API error: ${res.status}`)
  }

  const json = await res.json()
  const data = json.data || {}

  return {
    domain: data.domain || cleanDomain,
    organization: data.organization || '',
    emails: (data.emails || []).map((e: Record<string, unknown>) => ({
      value: e.value || '',
      type: e.type || '',
      confidence: e.confidence || 0,
      first_name: e.first_name || null,
      last_name: e.last_name || null,
      position: e.position || null,
      seniority: e.seniority || null,
      department: e.department || null,
      linkedin: e.linkedin || null,
      phone_number: e.phone_number || null,
    })),
    total: data.total || 0,
  }
}

export async function importHunterContacts(
  contacts: HunterEmail[],
  companyName: string,
  companyWebsite: string,
  tagIds: string[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  for (const contact of contacts) {
    if (!contact.value) { skipped++; continue }

    try {
      const existing = await prisma.lead.findUnique({ where: { email: contact.value } })
      if (existing) { skipped++; continue }

      const lead = await prisma.lead.create({
        data: {
          email: contact.value,
          firstName: contact.first_name || '',
          lastName: contact.last_name || '',
          company: companyName || null,
          jobTitle: contact.position || null,
          phone: contact.phone_number || null,
          country: null,
          city: null,
          website: companyWebsite || null,
          source: 'hunter',
          verified: contact.confidence >= 80,
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
