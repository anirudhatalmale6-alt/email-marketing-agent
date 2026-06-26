import { NextRequest, NextResponse } from 'next/server'
import { createCampaignDraft, sendCampaign, listSheets } from '@/lib/gmass'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action = 'create-draft' } = body

    if (action === 'list-sheets') {
      const sheets = await listSheets()
      return NextResponse.json({ sheets })
    }

    if (action === 'create-draft') {
      const result = await createCampaignDraft({
        subject: body.subject,
        message: body.message,
        emailAddresses: body.emailAddresses,
        listAddress: body.listAddress,
        fromEmail: body.fromEmail,
        fromName: body.fromName,
        messageType: body.messageType || 'html',
        openTracking: body.openTracking !== false,
        clickTracking: body.clickTracking !== false,
        throttling: body.throttling || 2,
        emailsPerDay: body.emailsPerDay,
        stageOneDays: body.stageOneDays,
        stageOneCampaignText: body.stageOneCampaignText,
        stageOneAction: body.stageOneAction,
        stageTwoDays: body.stageTwoDays,
        stageTwoCampaignText: body.stageTwoCampaignText,
        stageTwoAction: body.stageTwoAction,
        verify: body.verify,
        previewText: body.previewText,
        friendlyName: body.friendlyName,
      })
      return NextResponse.json(result)
    }

    if (action === 'send') {
      if (!body.campaignDraftId) {
        return NextResponse.json({ error: 'campaignDraftId is required' }, { status: 400 })
      }
      const result = await sendCampaign(body.campaignDraftId)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GMass API error' },
      { status: 500 }
    )
  }
}
