import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const sampleTemplates = [
  {
    name: 'Hotel Partnership Outreach',
    subject: 'Partnership Opportunity for {{company}}',
    category: 'outreach',
    htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:40px 40px 30px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">Partnership Opportunity</h1>
    <p style="color:#bfdbfe;margin:10px 0 0;font-size:14px;">Elevate Your Hotel's Procurement</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi {{firstName}},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">I hope this message finds you well. I'm reaching out because I believe there's a great opportunity for {{company}} to optimize your procurement process and reduce costs significantly.</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">We specialize in helping hotels across North America streamline their supply chain operations, and I'd love to explore how we can support your team.</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px;">Key benefits we offer:</p>
    <ul style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 30px;padding-left:20px;">
      <li>Up to 30% savings on procurement costs</li>
      <li>Streamlined vendor management</li>
      <li>Quality-assured supply chain</li>
      <li>Dedicated account support</li>
    </ul>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 30px;">
      <tr><td style="background-color:#3b82f6;border-radius:6px;padding:14px 32px;">
        <a href="#" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">Schedule a Call</a>
      </td></tr>
    </table>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0;">Best regards,<br><strong>Your Name</strong></p>
  </td></tr>
  <tr><td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">You received this email because you're a valued contact. <a href="#" style="color:#3b82f6;">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`,
  },
  {
    name: 'Product Showcase',
    subject: 'New Solutions for {{company}} - Save Time & Money',
    category: 'promotion',
    htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background-color:#059669;padding:40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:26px;">Introducing Our Latest Solutions</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Dear {{firstName}},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px;">We're excited to share our newest offerings designed specifically for the hospitality industry.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;">
      <tr>
        <td style="background-color:#f0fdf4;border-radius:8px;padding:24px;width:48%;vertical-align:top;">
          <h3 style="color:#059669;margin:0 0 10px;font-size:18px;">Smart Inventory</h3>
          <p style="color:#374151;font-size:14px;line-height:1.5;margin:0;">AI-powered inventory management that predicts your needs before you do.</p>
        </td>
        <td style="width:4%;"></td>
        <td style="background-color:#eff6ff;border-radius:8px;padding:24px;width:48%;vertical-align:top;">
          <h3 style="color:#2563eb;margin:0 0 10px;font-size:18px;">Vendor Hub</h3>
          <p style="color:#374151;font-size:14px;line-height:1.5;margin:0;">Centralized vendor management with real-time pricing and availability.</p>
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="margin:0 auto 30px;">
      <tr><td style="background-color:#059669;border-radius:6px;padding:14px 32px;">
        <a href="#" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">Explore Solutions</a>
      </td></tr>
    </table>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0;">Looking forward to helping {{company}} thrive,<br><strong>Your Team</strong></p>
  </td></tr>
  <tr><td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:12px;margin:0;"><a href="#" style="color:#059669;">Unsubscribe</a> | <a href="#" style="color:#059669;">View in browser</a></p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`,
  },
  {
    name: 'Follow-Up Nurture',
    subject: 'Following up - {{firstName}}, quick question',
    category: 'follow-up',
    htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="padding:40px;">
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi {{firstName}},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">I wanted to follow up on my previous email. I understand you're busy managing operations at {{company}}, so I'll keep this brief.</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">I genuinely believe we can help your team save both time and money on procurement. Here's what some of our hotel partners have experienced:</p>

    <table width="100%" style="margin:0 0 30px;border-collapse:collapse;">
      <tr><td style="padding:16px;background-color:#fef3c7;border-radius:8px 8px 0 0;border-bottom:2px solid #f59e0b;">
        <strong style="color:#92400e;font-size:24px;">30%</strong>
        <span style="color:#92400e;font-size:14px;margin-left:8px;">average cost reduction</span>
      </td></tr>
      <tr><td style="padding:16px;background-color:#fef9ee;">
        <strong style="color:#92400e;font-size:24px;">2hrs</strong>
        <span style="color:#92400e;font-size:14px;margin-left:8px;">saved per day on ordering</span>
      </td></tr>
      <tr><td style="padding:16px;background-color:#fef3c7;border-radius:0 0 8px 8px;">
        <strong style="color:#92400e;font-size:24px;">98%</strong>
        <span style="color:#92400e;font-size:14px;margin-left:8px;">on-time delivery rate</span>
      </td></tr>
    </table>

    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Would you have 15 minutes this week for a quick call? I'd love to share how we've helped hotels similar to yours.</p>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 30px;">
      <tr><td style="background-color:#f59e0b;border-radius:6px;padding:14px 32px;">
        <a href="#" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">Book 15-Min Call</a>
      </td></tr>
    </table>

    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0;">Cheers,<br><strong>Your Name</strong></p>
  </td></tr>
  <tr><td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">Not interested? <a href="#" style="color:#f59e0b;">Unsubscribe here</a></p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`,
  },
]

const sampleTags = [
  { name: 'Hotels - Canada', color: '#EF4444' },
  { name: 'Hotels - USA', color: '#3B82F6' },
  { name: 'Procurement Manager', color: '#8B5CF6' },
  { name: 'General Manager', color: '#10B981' },
  { name: 'Purchasing Director', color: '#F59E0B' },
  { name: 'Luxury Hotels', color: '#EC4899' },
  { name: 'Budget Hotels', color: '#6366F1' },
  { name: 'Chain Hotels', color: '#14B8A6' },
  { name: 'Independent Hotels', color: '#F97316' },
  { name: 'Hot Lead', color: '#DC2626' },
]

const sampleLeads = [
  { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@example-hotel.com', company: 'Grand Pacific Hotel', jobTitle: 'Procurement Manager', country: 'Canada', city: 'Vancouver', tags: ['Hotels - Canada', 'Procurement Manager', 'Luxury Hotels'] },
  { firstName: 'Michael', lastName: 'Chen', email: 'mchen@example-resort.com', company: 'Sunrise Resort & Spa', jobTitle: 'Purchasing Director', country: 'USA', city: 'Miami', tags: ['Hotels - USA', 'Purchasing Director', 'Luxury Hotels'] },
  { firstName: 'Emily', lastName: 'Williams', email: 'emily.w@example-inn.com', company: 'Lakeside Inn', jobTitle: 'General Manager', country: 'Canada', city: 'Toronto', tags: ['Hotels - Canada', 'General Manager', 'Independent Hotels'] },
  { firstName: 'James', lastName: 'Rodriguez', email: 'jrodriguez@example-suites.com', company: 'Metro Suites', jobTitle: 'Procurement Manager', country: 'USA', city: 'New York', tags: ['Hotels - USA', 'Procurement Manager', 'Chain Hotels'] },
  { firstName: 'Lisa', lastName: 'Thompson', email: 'lisa.t@example-lodge.com', company: 'Mountain Lodge', jobTitle: 'General Manager', country: 'Canada', city: 'Whistler', tags: ['Hotels - Canada', 'General Manager', 'Independent Hotels', 'Hot Lead'] },
]

async function seed() {
  console.log('Seeding database...')

  for (const tag of sampleTags) {
    const existing = await prisma.tag.findFirst({ where: { name: tag.name } })
    if (!existing) {
      await prisma.tag.create({ data: tag })
    }
  }
  console.log(`Created ${sampleTags.length} tags`)

  for (const tmpl of sampleTemplates) {
    const existing = await prisma.template.findFirst({ where: { name: tmpl.name } })
    if (!existing) {
      await prisma.template.create({ data: tmpl })
    }
  }
  console.log(`Created ${sampleTemplates.length} templates`)

  for (const lead of sampleLeads) {
    const { tags: tagNames, ...leadData } = lead
    const existing = await prisma.lead.findFirst({ where: { email: leadData.email } })
    if (!existing) {
      const createdLead = await prisma.lead.create({ data: leadData })
      for (const tagName of tagNames) {
        const tag = await prisma.tag.findFirst({ where: { name: tagName } })
        if (tag) {
          await prisma.leadTag.create({
            data: { leadId: createdLead.id, tagId: tag.id },
          })
        }
      }
    }
  }
  console.log(`Created ${sampleLeads.length} sample leads`)

  const existingSetting = await prisma.setting.findUnique({ where: { key: 'app_url' } })
  if (!existingSetting) {
    await prisma.setting.create({
      data: { key: 'app_url', value: 'http://localhost:3000' },
    })
  }

  console.log('Seed complete!')
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
