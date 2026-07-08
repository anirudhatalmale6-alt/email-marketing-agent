import { prisma } from './prisma'

async function getGmassKey(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: 'gmass_api_key' } })
  if (!setting?.value) throw new Error('GMass API key not configured. Go to Settings to add it.')
  return setting.value
}

const GMASS_BASE = 'https://api.gmass.co/api'

interface GmassCampaignDraft {
  subject: string
  message: string
  listAddress?: string
  emailAddresses?: string
  fromEmail?: string
  fromName?: string
  messageType?: 'html' | 'plain'
  openTracking?: boolean
  clickTracking?: boolean
  throttling?: number
  emailsPerDay?: number
  stageOneDays?: number
  stageOneCampaignText?: string
  stageOneAction?: string
  stageTwoDays?: number
  stageTwoCampaignText?: string
  stageTwoAction?: string
  verify?: boolean
  previewText?: string
  friendlyName?: string
}

interface GmassCampaignResponse {
  campaignDraftId?: string
  campaignId?: string
  error?: string
  message?: string
}

export async function createCampaignDraft(params: GmassCampaignDraft): Promise<GmassCampaignResponse> {
  const apiKey = await getGmassKey()

  const body: Record<string, unknown> = {
    subject: params.subject,
    message: params.message,
    messageType: params.messageType || 'html',
    openTracking: params.openTracking !== false,
    clickTracking: params.clickTracking !== false,
  }

  if (params.emailAddresses) body.emailAddresses = params.emailAddresses
  if (params.listAddress) body.listAddress = params.listAddress
  if (params.fromEmail) body.fromEmail = params.fromEmail
  if (params.fromName) body.fromName = params.fromName
  if (params.throttling) body.throttling = params.throttling
  if (params.emailsPerDay) body.emailsPerDay = params.emailsPerDay
  if (params.verify) body.verify = params.verify
  if (params.previewText) body.previewText = params.previewText
  if (params.friendlyName) body.friendlyName = params.friendlyName

  if (params.stageOneDays) {
    body.stageOneDays = params.stageOneDays
    body.stageOneCampaignText = params.stageOneCampaignText || ''
    body.stageOneAction = params.stageOneAction || 'r'
  }
  if (params.stageTwoDays) {
    body.stageTwoDays = params.stageTwoDays
    body.stageTwoCampaignText = params.stageTwoCampaignText || ''
    body.stageTwoAction = params.stageTwoAction || 'r'
  }

  const res = await fetch(`${GMASS_BASE}/campaigndrafts?apikey=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.message || `GMass API error: ${res.status}`)
  }

  return res.json()
}

export async function sendCampaign(campaignDraftId: string): Promise<GmassCampaignResponse> {
  const apiKey = await getGmassKey()

  const res = await fetch(`${GMASS_BASE}/campaigns/${campaignDraftId}?apikey=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.message || `GMass send error: ${res.status}`)
  }

  return res.json()
}

export async function listSheets(): Promise<unknown[]> {
  const apiKey = await getGmassKey()

  const res = await fetch(`${GMASS_BASE}/sheets?apikey=${apiKey}`)

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.message || `GMass API error: ${res.status}`)
  }

  return res.json()
}

export async function runGmassCampaign(campaignId: string): Promise<{ sent: number; total: number; gmassId?: string }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  })

  if (!campaign || !campaign.template) {
    throw new Error('Campaign or template not found')
  }

  const tagIds = campaign.segmentTags ? JSON.parse(campaign.segmentTags) as string[] : []

  const leadFilter: Record<string, unknown> = {}
  if (campaign.userId) leadFilter.userId = campaign.userId
  if (tagIds.length > 0) leadFilter.tags = { some: { tagId: { in: tagIds } } }

  const leads = await prisma.lead.findMany({
    where: leadFilter,
    include: { tags: { include: { tag: true } } },
  })

  if (leads.length === 0) {
    throw new Error('No leads match the selected tag(s). Add leads to this tag, or pick a different segment.')
  }

  const emailList = leads
    .filter(l => l.email && !l.email.includes('@placeholder.'))
    .slice(0, campaign.dailyLimit)

  if (emailList.length === 0) {
    throw new Error(`Found ${leads.length} lead(s) but none have a real email address (all are placeholders). Import leads with valid email addresses.`)
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'sending', startedAt: new Date() },
  })

  const emailAddresses = emailList.map(l => {
    const name = [l.firstName, l.lastName].filter(Boolean).join(' ')
    return name ? `${name} <${l.email}>` : l.email
  }).join(', ')

  let htmlBody = campaign.template.htmlContent

  const followUpConfig: Partial<GmassCampaignDraft> = {}
  if (campaign.followUpEnabled && campaign.followUpDays) {
    followUpConfig.stageOneDays = campaign.followUpDays
    followUpConfig.stageOneCampaignText = 'Just following up on my previous email. Would love to connect!'
    followUpConfig.stageOneAction = 'r'
  }

  try {
    const draft = await createCampaignDraft({
      subject: campaign.subject,
      message: htmlBody,
      emailAddresses,
      fromEmail: campaign.fromEmail || undefined,
      fromName: campaign.fromName || undefined,
      messageType: 'html',
      openTracking: true,
      clickTracking: true,
      emailsPerDay: campaign.dailyLimit,
      throttling: 2,
      friendlyName: campaign.name,
      ...followUpConfig,
    })

    if (!draft.campaignDraftId) {
      throw new Error('Failed to create GMass campaign draft')
    }

    const result = await sendCampaign(draft.campaignDraftId)

    for (const lead of emailList) {
      await prisma.campaignLead.upsert({
        where: { campaignId_leadId: { campaignId, leadId: lead.id } },
        update: { status: 'sent', sentAt: new Date() },
        create: {
          campaignId,
          leadId: lead.id,
          status: 'sent',
          sentAt: new Date(),
        },
      })
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'completed', completedAt: new Date() },
    })

    return {
      sent: emailList.length,
      total: leads.length,
      gmassId: result.campaignId || draft.campaignDraftId,
    }
  } catch (error) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'failed' },
    })
    throw error
  }
}
