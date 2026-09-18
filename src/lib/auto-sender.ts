import { prisma } from './prisma'
import { getSmtpTransport, injectTrackingPixel, wrapLinks, replaceVariables } from './email'

// Never send more than this in one cron tick. Each tick must finish well inside
// the serverless time limit, so we send what is due and return - we never sleep
// for the gap. Correct pacing comes from being called often, not from waiting.
const MAX_PER_RUN = 10

export interface AutoRunResult {
  campaignId: string
  campaignName: string
  sent: number
  failed: number
  skipped?: string
}

/**
 * The hour (0-23) and weekday in the campaign's own timezone. Using the server
 * clock would send at the wrong local time - Vercel runs in UTC, the client is
 * in Dubai.
 */
export function localParts(timezone: string, at: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  })
  const parts = fmt.formatToParts(at)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  return { hour, weekday }
}

export function isWithinWindow(
  timezone: string,
  windowStart: number,
  windowEnd: number,
  skipWeekends: boolean,
  at: Date = new Date()
): { ok: boolean; reason?: string } {
  let hour: number
  let weekday: string
  try {
    ;({ hour, weekday } = localParts(timezone, at))
  } catch {
    // An invalid timezone must not silently send around the clock.
    return { ok: false, reason: `Invalid timezone "${timezone}"` }
  }

  if (skipWeekends && (weekday === 'Sat' || weekday === 'Sun')) {
    return { ok: false, reason: `Weekend in ${timezone}` }
  }
  if (hour < windowStart || hour >= windowEnd) {
    return { ok: false, reason: `Outside ${windowStart}:00-${windowEnd}:00 ${timezone} (now ${hour}:00)` }
  }
  return { ok: true }
}

/**
 * How many emails are due right now, from the gap since the last one actually
 * sent. Calling this every 60s with a 30s gap yields 2 per call, i.e. a 30s
 * average spacing, without the function ever having to sleep.
 */
export function dueCount(lastSentAt: Date | null, delaySeconds: number, now: Date = new Date()): number {
  const gap = Math.max(delaySeconds, 1)
  if (!lastSentAt) return 1
  const elapsed = (now.getTime() - lastSentAt.getTime()) / 1000
  if (elapsed < gap) return 0
  return Math.floor(elapsed / gap)
}

/** Send the emails that are due for one campaign. Returns immediately if none are. */
export async function runAutoCampaign(campaignId: string): Promise<AutoRunResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  })
  if (!campaign) return { campaignId, campaignName: '?', sent: 0, failed: 0, skipped: 'Campaign not found' }

  const base = { campaignId, campaignName: campaign.name, sent: 0, failed: 0 }

  if (!campaign.autoSend) return { ...base, skipped: 'Auto-send is off' }
  if (campaign.status === 'paused') return { ...base, skipped: 'Paused' }
  if (campaign.status === 'completed') return { ...base, skipped: 'Already completed' }

  const window = isWithinWindow(
    campaign.timezone,
    campaign.windowStart,
    campaign.windowEnd,
    campaign.skipWeekends
  )
  if (!window.ok) return { ...base, skipped: window.reason }

  // Stop at the daily cap, counted over today in the campaign's own timezone.
  const dayStart = startOfLocalDay(campaign.timezone)
  const sentToday = await prisma.campaignLead.count({
    where: { campaignId, status: 'sent', sentAt: { gte: dayStart } },
  })
  if (sentToday >= campaign.dailyLimit) {
    return { ...base, skipped: `Daily limit reached (${sentToday}/${campaign.dailyLimit})` }
  }

  const lastSent = await prisma.campaignLead.findFirst({
    where: { campaignId, status: 'sent' },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  })

  const due = dueCount(lastSent?.sentAt ?? null, campaign.delaySeconds)
  if (due < 1) return { ...base, skipped: 'Waiting for the send gap' }

  const budget = Math.min(due, MAX_PER_RUN, campaign.dailyLimit - sentToday)

  const pending = await prisma.campaignLead.findMany({
    where: { campaignId, status: 'pending' },
    include: { lead: true },
    take: budget,
  })

  if (pending.length === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'completed', completedAt: new Date() },
    })
    return { ...base, skipped: 'No leads left - campaign completed' }
  }

  const { transport, from } = await getSmtpTransport(campaign.smtpConfigId || undefined, campaign.userId || undefined)
  const baseUrl = (await getSetting('app_url')) || ''

  let sent = 0
  let failed = 0

  for (const cl of pending) {
    const lead = cl.lead
    if (!lead?.email) {
      await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'failed' } })
      failed++
      continue
    }

    const vars: Record<string, string> = {
      firstName: lead.firstName || 'there',
      lastName: lead.lastName || '',
      company: lead.company || '',
      jobTitle: lead.jobTitle || '',
      email: lead.email,
      country: lead.country || '',
      city: lead.city || '',
      unsubscribeUrl: `${baseUrl}/api/tracking/unsubscribe?id=${cl.id}`,
    }

    try {
      const subject = replaceVariables(campaign.subject, vars)
      let html = replaceVariables(campaign.template?.htmlContent || '', vars)
      html = wrapLinks(html, cl.id, baseUrl)
      html = injectTrackingPixel(html, cl.id, baseUrl)

      await transport.sendMail({
        from: campaign.fromEmail ? `"${campaign.fromName || ''}" <${campaign.fromEmail}>` : from,
        to: lead.email,
        subject,
        html,
      })

      await prisma.campaignLead.update({
        where: { id: cl.id },
        data: { status: 'sent', sentAt: new Date(), personalizedSubject: subject },
      })
      sent++
    } catch (error) {
      console.error(`Auto-send failed for ${lead.email}:`, error)
      await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'failed' } })
      failed++
    }
  }

  transport.close()

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      lastAutoRunAt: new Date(),
      ...(campaign.status !== 'sending' ? { status: 'sending' } : {}),
      ...(campaign.startedAt ? {} : { startedAt: new Date() }),
    },
  })

  return { ...base, sent, failed }
}

/** Midnight today in the given timezone, as a real instant. */
export function startOfLocalDay(timezone: string, at: Date = new Date()): Date {
  try {
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at)
    // Offset of that timezone from UTC at this moment, so midnight local is exact.
    const asUtc = new Date(`${ymd}T00:00:00Z`)
    const tzName = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value // e.g. "GMT+04:00"
    const m = tzName?.match(/GMT([+-])(\d{2}):(\d{2})/)
    if (!m) return asUtc
    const sign = m[1] === '+' ? 1 : -1
    const offsetMin = sign * (Number(m[2]) * 60 + Number(m[3]))
    return new Date(asUtc.getTime() - offsetMin * 60_000)
  } catch {
    const d = new Date(at)
    d.setUTCHours(0, 0, 0, 0)
    return d
  }
}

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } }).catch(() => null)
  return row?.value ?? null
}

/** Run every campaign that has auto-send switched on. */
export async function runAllAutoCampaigns(): Promise<AutoRunResult[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { autoSend: true, status: { in: ['sending', 'scheduled', 'draft'] } },
    select: { id: true },
  })
  const results: AutoRunResult[] = []
  for (const c of campaigns) {
    try {
      results.push(await runAutoCampaign(c.id))
    } catch (error) {
      results.push({
        campaignId: c.id,
        campaignName: '?',
        sent: 0,
        failed: 0,
        skipped: error instanceof Error ? error.message : 'Run failed',
      })
    }
  }
  return results
}
