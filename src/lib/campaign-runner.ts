import { prisma } from './prisma'
import { getSmtpTransport, injectTrackingPixel, wrapLinks, replaceVariables } from './email'
import { personalizeEmail } from './ai'
import { runGmassCampaign } from './gmass'
import { buildLeadFilter } from './recipients'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface BatchResult {
  done: boolean
  paused: boolean
  sentThisBatch: number
  totalSent: number
  totalFailed: number
  remaining: number
  total: number
  status: string
}

// Sends a single bounded batch of emails so we never exceed the serverless
// time limit. Designed to be called repeatedly (by the frontend or a cron)
// until `done` is true. Already-sent leads are skipped, so it is resumable.
export async function runCampaignBatch(campaignId: string): Promise<BatchResult> {
  const sendingMethodSetting = await prisma.setting.findUnique({ where: { key: 'sending_method' } })
  const sendingMethod = sendingMethodSetting?.value || 'smtp'

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  })

  if (!campaign) throw new Error('Campaign not found')

  // If the user paused the campaign between batches, stop cleanly.
  if (campaign.status === 'paused') {
    const sentSoFar = await prisma.campaignLead.count({ where: { campaignId, status: 'sent' } })
    return {
      done: false,
      paused: true,
      sentThisBatch: 0,
      totalSent: sentSoFar,
      totalFailed: 0,
      remaining: 0,
      total: 0,
      status: 'paused',
    }
  }

  // GMass hands the whole list off to an external service in one call, so there
  // is no per-email loop to time out — run it once and we're done.
  if (sendingMethod === 'gmass') {
    if (campaign.status !== 'completed') {
      await runGmassCampaign(campaignId)
    }
    const totalSent = await prisma.campaignLead.count({ where: { campaignId, status: 'sent' } })
    return {
      done: true,
      paused: false,
      sentThisBatch: 0,
      totalSent,
      totalFailed: 0,
      remaining: 0,
      total: totalSent,
      status: 'completed',
    }
  }

  if (!campaign.template) throw new Error('Campaign has no template assigned')

  const appUrlSetting = await prisma.setting.findUnique({ where: { key: 'app_url' } })
  const baseUrl = appUrlSetting?.value || 'http://localhost:3000'

  const leadFilter = buildLeadFilter(campaign)

  const allLeads = await prisma.lead.findMany({
    where: leadFilter,
    include: { tags: { include: { tag: true } } },
  })
  const total = Math.min(allLeads.length, campaign.dailyLimit)

  // Work out which leads still need attempting (resumable across batches). A
  // lead already marked sent OR failed counts as processed, so we never retry
  // a permanently-bad address in an endless loop.
  const processedLeads = await prisma.campaignLead.findMany({
    where: { campaignId, status: { in: ['sent', 'failed'] } },
    select: { leadId: true, status: true },
  })
  const processedLeadIds = new Set(processedLeads.map(cl => cl.leadId))
  const alreadySent = processedLeads.filter(cl => cl.status === 'sent').length

  // Respect the campaign's daily limit as a hard cap on total sends.
  const remainingByLimit = Math.max(0, campaign.dailyLimit - alreadySent)
  const pending = allLeads.filter(l => !processedLeadIds.has(l.id)).slice(0, remainingByLimit)

  // Mark as sending / stamp start time on first batch.
  if (campaign.status !== 'sending' || !campaign.startedAt) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'sending', ...(campaign.startedAt ? {} : { startedAt: new Date() }) },
    })
  }

  if (pending.length === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'completed', completedAt: new Date() },
    })
    return {
      done: true,
      paused: false,
      sentThisBatch: 0,
      totalSent: alreadySent,
      totalFailed: 0,
      remaining: 0,
      total,
      status: 'completed',
    }
  }

  // Keep each batch comfortably under the serverless execution limit. We clamp
  // the per-email delay so a large value (e.g. 30s) can't stall the request.
  const perEmailDelay = Math.min(Math.max(campaign.delaySeconds || 0, 0), 5)
  const TIME_BUDGET_MS = 40_000
  const maxByTime = perEmailDelay > 0
    ? Math.max(1, Math.floor(TIME_BUDGET_MS / (perEmailDelay * 1000 + 500)))
    : 15
  const batchSize = Math.min(pending.length, maxByTime, 15)
  const batch = pending.slice(0, batchSize)

  const { transport, from } = await getSmtpTransport(campaign.smtpConfigId || undefined, campaign.userId || undefined)
  const fromAddress = campaign.fromEmail
    ? `"${campaign.fromName || ''}" <${campaign.fromEmail}>`
    : from

  let sentThisBatch = 0
  let failedThisBatch = 0

  for (let i = 0; i < batch.length; i++) {
    const lead = batch[i]
    try {
      const existing = await prisma.campaignLead.findUnique({
        where: { campaignId_leadId: { campaignId, leadId: lead.id } },
      })
      if (existing?.status === 'sent') continue

      const variables: Record<string, string> = {
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company || '',
        jobTitle: lead.jobTitle || '',
        email: lead.email,
        country: lead.country || '',
        city: lead.city || '',
      }

      let subject = replaceVariables(campaign.subject, variables)
      let htmlBody = replaceVariables(campaign.template.htmlContent, variables)

      if (campaign.aiPersonalize) {
        try {
          const personalized = await personalizeEmail(subject, htmlBody, lead)
          subject = personalized.subject
          htmlBody = personalized.body
        } catch {
          // fall back to template if AI fails
        }
      }

      const campaignLead = existing || await prisma.campaignLead.create({
        data: {
          campaignId,
          leadId: lead.id,
          personalizedSubject: campaign.aiPersonalize ? subject : null,
          personalizedBody: campaign.aiPersonalize ? htmlBody : null,
        },
      })

      htmlBody = injectTrackingPixel(htmlBody, campaignLead.id, baseUrl)
      htmlBody = wrapLinks(htmlBody, campaignLead.id, baseUrl)

      await transport.sendMail({
        from: fromAddress,
        to: lead.email,
        subject,
        html: htmlBody,
      })

      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: 'sent', sentAt: new Date() },
      })

      await prisma.emailEvent.create({
        data: { campaignLeadId: campaignLead.id, leadId: lead.id, type: 'sent' },
      })

      sentThisBatch++

      if (perEmailDelay > 0 && i < batch.length - 1) {
        await sleep(perEmailDelay * 1000)
      }
    } catch (error) {
      console.error(`Failed to send to ${lead.email}:`, error)
      failedThisBatch++
      const cl = await prisma.campaignLead.findUnique({
        where: { campaignId_leadId: { campaignId, leadId: lead.id } },
      })
      if (cl) {
        await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'failed' } })
      } else {
        await prisma.campaignLead.create({
          data: { campaignId, leadId: lead.id, status: 'failed' },
        })
      }
    }
  }

  transport.close()

  const totalSent = alreadySent + sentThisBatch
  const remaining = pending.length - sentThisBatch - failedThisBatch
  const done = remaining <= 0

  if (done) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'completed', completedAt: new Date() },
    })
  }

  return {
    done,
    paused: false,
    sentThisBatch,
    totalSent,
    totalFailed: failedThisBatch,
    remaining: Math.max(0, remaining),
    total,
    status: done ? 'completed' : 'sending',
  }
}

export async function runCampaign(campaignId: string) {
  const sendingMethodSetting = await prisma.setting.findUnique({ where: { key: 'sending_method' } })
  const sendingMethod = sendingMethodSetting?.value || 'smtp'

  if (sendingMethod === 'gmass') {
    return runGmassCampaign(campaignId)
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  })

  if (!campaign || !campaign.template) {
    throw new Error('Campaign or template not found')
  }

  const appUrlSetting = await prisma.setting.findUnique({ where: { key: 'app_url' } })
  const baseUrl = appUrlSetting?.value || 'http://localhost:3000'

  const leads = await prisma.lead.findMany({
    where: buildLeadFilter(campaign),
    include: { tags: { include: { tag: true } } },
  })

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'sending', startedAt: new Date() },
  })

  const { transport, from } = await getSmtpTransport(campaign.smtpConfigId || undefined)
  const fromAddress = campaign.fromEmail
    ? `"${campaign.fromName || ''}" <${campaign.fromEmail}>`
    : from

  let sentCount = 0

  for (const lead of leads) {
    if (sentCount >= campaign.dailyLimit) break

    try {
      const existing = await prisma.campaignLead.findUnique({
        where: { campaignId_leadId: { campaignId, leadId: lead.id } },
      })
      if (existing?.status === 'sent') continue

      const variables: Record<string, string> = {
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company || '',
        jobTitle: lead.jobTitle || '',
        email: lead.email,
        country: lead.country || '',
        city: lead.city || '',
      }

      let subject = replaceVariables(campaign.subject, variables)
      let htmlBody = replaceVariables(campaign.template.htmlContent, variables)

      if (campaign.aiPersonalize) {
        try {
          const personalized = await personalizeEmail(subject, htmlBody, lead)
          subject = personalized.subject
          htmlBody = personalized.body
        } catch {
          // fall back to template if AI fails
        }
      }

      const campaignLead = existing || await prisma.campaignLead.create({
        data: {
          campaignId,
          leadId: lead.id,
          personalizedSubject: campaign.aiPersonalize ? subject : null,
          personalizedBody: campaign.aiPersonalize ? htmlBody : null,
        },
      })

      htmlBody = injectTrackingPixel(htmlBody, campaignLead.id, baseUrl)
      htmlBody = wrapLinks(htmlBody, campaignLead.id, baseUrl)

      await transport.sendMail({
        from: fromAddress,
        to: lead.email,
        subject,
        html: htmlBody,
      })

      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: 'sent', sentAt: new Date() },
      })

      await prisma.emailEvent.create({
        data: {
          campaignLeadId: campaignLead.id,
          leadId: lead.id,
          type: 'sent',
        },
      })

      sentCount++

      if (campaign.delaySeconds > 0 && sentCount < leads.length) {
        await sleep(campaign.delaySeconds * 1000)
      }
    } catch (error) {
      console.error(`Failed to send to ${lead.email}:`, error)
      const cl = await prisma.campaignLead.findUnique({
        where: { campaignId_leadId: { campaignId, leadId: lead.id } },
      })
      if (cl) {
        await prisma.campaignLead.update({
          where: { id: cl.id },
          data: { status: 'failed' },
        })
      }
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'completed', completedAt: new Date() },
  })

  transport.close()

  return { sent: sentCount, total: leads.length }
}
