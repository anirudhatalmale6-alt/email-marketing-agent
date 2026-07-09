import { prisma } from './prisma'

// Turns whatever the user pasted (commas, spaces, semicolons or newlines) into a
// clean, de-duplicated list of valid email addresses.
export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>()
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase()
    if (email && emailRe.test(email) && !seen.has(email)) seen.add(email)
  }
  return Array.from(seen)
}

// Makes sure a lightweight contact record exists for every pasted email, so the
// send/tracking/report pipeline (which is keyed on leads) works exactly the same
// as the "select from leads" path. Existing contacts are reused, never duplicated.
export async function ensureLeadsForEmails(emails: string[], userId?: string) {
  for (const email of emails) {
    const existing = await prisma.lead.findFirst({ where: { email, userId: userId || null } })
    if (existing) continue
    await prisma.lead.create({
      data: {
        email,
        firstName: email.split('@')[0],
        lastName: '',
        source: 'quick-send',
        userId: userId || null,
      },
    })
  }
}

// Resolves which leads a campaign sends to. Two modes:
//  - directEmails set  -> the exact addresses pasted into the "quick send" box
//  - otherwise         -> leads matching the selected segment tag(s)
// Both are always scoped to the campaign owner.
export function buildLeadFilter(campaign: {
  userId: string | null
  segmentTags: string | null
  directEmails: string | null
}): Record<string, unknown> {
  const directEmails = campaign.directEmails ? (JSON.parse(campaign.directEmails) as string[]) : []
  const tagIds = campaign.segmentTags ? (JSON.parse(campaign.segmentTags) as string[]) : []

  const filter: Record<string, unknown> = {}
  if (campaign.userId) filter.userId = campaign.userId
  if (directEmails.length > 0) {
    filter.email = { in: directEmails }
  } else if (tagIds.length > 0) {
    filter.tags = { some: { tagId: { in: tagIds } } }
  }
  return filter
}
