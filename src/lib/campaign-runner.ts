import { prisma } from './prisma'
import { getSmtpTransport, injectTrackingPixel, wrapLinks, replaceVariables } from './email'
import { personalizeEmail } from './ai'
import { runGmassCampaign } from './gmass'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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

  const tagIds = campaign.segmentTags ? JSON.parse(campaign.segmentTags) as string[] : []

  let leads
  if (tagIds.length > 0) {
    leads = await prisma.lead.findMany({
      where: {
        tags: { some: { tagId: { in: tagIds } } },
      },
      include: { tags: { include: { tag: true } } },
    })
  } else {
    leads = await prisma.lead.findMany({
      include: { tags: { include: { tag: true } } },
    })
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'sending', startedAt: new Date() },
  })

  const { transport, from } = await getSmtpTransport()
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
