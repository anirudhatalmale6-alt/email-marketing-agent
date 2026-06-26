import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSmtpTransport, injectTrackingPixel, wrapLinks, replaceVariables } from '@/lib/email'
import { personalizeEmail } from '@/lib/ai'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { template: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Campaign is already being sent' }, { status: 400 })
    }

    if (!campaign.template) {
      return NextResponse.json({ error: 'Campaign has no template assigned' }, { status: 400 })
    }

    // Get app_url setting for tracking links
    const appUrlSetting = await prisma.setting.findUnique({ where: { key: 'app_url' } })
    const baseUrl = appUrlSetting?.value || 'http://localhost:3000'

    // Parse segment tags
    let segmentTagIds: string[] = []
    if (campaign.segmentTags) {
      try {
        segmentTagIds = JSON.parse(campaign.segmentTags)
      } catch {
        segmentTagIds = []
      }
    }

    // Find leads matching the segment tags (leads that have ANY of the specified tags)
    let leads
    if (segmentTagIds.length > 0) {
      leads = await prisma.lead.findMany({
        where: {
          tags: {
            some: {
              tagId: { in: segmentTagIds },
            },
          },
        },
      })
    } else {
      // If no segment tags specified, target all leads
      leads = await prisma.lead.findMany()
    }

    if (leads.length === 0) {
      return NextResponse.json({ error: 'No leads match the campaign segment' }, { status: 400 })
    }

    // Update campaign status to sending
    await prisma.campaign.update({
      where: { id },
      data: {
        status: 'sending',
        startedAt: new Date(),
      },
    })

    // Get SMTP transport
    const { transport, from } = await getSmtpTransport()
    const campaignFrom = campaign.fromName && campaign.fromEmail
      ? `"${campaign.fromName}" <${campaign.fromEmail}>`
      : from

    const templateHtml = campaign.template.htmlContent
    const templateSubject = campaign.subject
    const dailyLimit = campaign.dailyLimit
    const delayMs = campaign.delaySeconds * 1000

    let sentCount = 0
    let failedCount = 0

    for (const lead of leads) {
      // Respect daily limit
      if (sentCount >= dailyLimit) {
        break
      }

      try {
        // Check if CampaignLead already exists (avoid duplicate sends)
        const existingCL = await prisma.campaignLead.findUnique({
          where: {
            campaignId_leadId: {
              campaignId: id,
              leadId: lead.id,
            },
          },
        })

        if (existingCL && existingCL.status === 'sent') {
          continue // Already sent to this lead
        }

        // Create or get CampaignLead record
        const campaignLead = existingCL || await prisma.campaignLead.create({
          data: {
            campaignId: id,
            leadId: lead.id,
            status: 'pending',
          },
        })

        // Replace template variables
        const variables: Record<string, string> = {
          firstName: lead.firstName,
          lastName: lead.lastName,
          company: lead.company || '',
          jobTitle: lead.jobTitle || '',
          email: lead.email,
          country: lead.country || '',
          city: lead.city || '',
        }

        let emailSubject = replaceVariables(templateSubject, variables)
        let emailBody = replaceVariables(templateHtml, variables)

        // Optionally personalize with AI
        if (campaign.aiPersonalize) {
          try {
            const personalized = await personalizeEmail(emailSubject, emailBody, lead)
            emailSubject = personalized.subject
            emailBody = personalized.body

            // Store personalized versions
            await prisma.campaignLead.update({
              where: { id: campaignLead.id },
              data: {
                personalizedSubject: emailSubject,
                personalizedBody: emailBody,
              },
            })
          } catch (aiError) {
            console.error(`AI personalization failed for lead ${lead.id}:`, aiError)
            // Continue with unpersonalized version
          }
        }

        // Inject tracking pixel and wrap links
        emailBody = wrapLinks(emailBody, campaignLead.id, baseUrl)
        emailBody = injectTrackingPixel(emailBody, campaignLead.id, baseUrl)

        // Send email
        await transport.sendMail({
          from: campaignFrom,
          to: lead.email,
          subject: emailSubject,
          html: emailBody,
        })

        // Update CampaignLead status
        await prisma.campaignLead.update({
          where: { id: campaignLead.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
          },
        })

        sentCount++

        // Delay between sends
        if (delayMs > 0 && sentCount < leads.length) {
          await sleep(delayMs)
        }
      } catch (sendError) {
        console.error(`Failed to send email to ${lead.email}:`, sendError)
        failedCount++

        // Update CampaignLead with failed status
        try {
          await prisma.campaignLead.updateMany({
            where: {
              campaignId: id,
              leadId: lead.id,
            },
            data: { status: 'failed' },
          })
        } catch {
          // Ignore update failure
        }
      }
    }

    // Close transport
    transport.close()

    // Update campaign status
    const finalStatus = sentCount >= leads.length ? 'completed' : sentCount > 0 ? 'paused' : 'failed'
    await prisma.campaign.update({
      where: { id },
      data: {
        status: finalStatus,
        completedAt: finalStatus === 'completed' ? new Date() : null,
      },
    })

    return NextResponse.json({
      success: true,
      stats: {
        totalLeads: leads.length,
        sent: sentCount,
        failed: failedCount,
        skipped: leads.length - sentCount - failedCount,
      },
    })
  } catch (error) {
    console.error('Campaign send failed:', error)

    // Try to update campaign status to failed
    try {
      const { id } = await params
      await prisma.campaign.update({
        where: { id },
        data: { status: 'failed' },
      })
    } catch {
      // Ignore
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Campaign send failed' },
      { status: 500 }
    )
  }
}
