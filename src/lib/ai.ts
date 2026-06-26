import OpenAI from 'openai'
import { prisma } from './prisma'

async function getOpenAIClient() {
  const setting = await prisma.setting.findUnique({ where: { key: 'openai_api_key' } })
  if (!setting?.value) throw new Error('OpenAI API key not configured. Go to Settings to add it.')
  return new OpenAI({ apiKey: setting.value })
}

export async function personalizeEmail(
  subject: string,
  body: string,
  lead: { firstName: string; lastName: string; company?: string | null; jobTitle?: string | null; country?: string | null }
) {
  const openai = await getOpenAIClient()

  const prompt = `You are an email marketing expert. Personalize this email for the recipient.

Recipient Info:
- Name: ${lead.firstName} ${lead.lastName}
- Company: ${lead.company || 'Unknown'}
- Job Title: ${lead.jobTitle || 'Unknown'}
- Country: ${lead.country || 'Unknown'}

Original Subject: ${subject}
Original Body (HTML): ${body}

Rules:
1. Keep the same HTML structure and styling
2. Make the subject line more personal and compelling
3. Add personal touches referencing their company/role where natural
4. Keep the professional tone
5. Do not change links, images, or tracking elements

Return JSON only:
{"subject": "personalized subject", "body": "personalized HTML body"}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response from AI')
  return JSON.parse(content) as { subject: string; body: string }
}

export async function generateSubjectLines(topic: string, count: number = 5) {
  const openai = await getOpenAIClient()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Generate ${count} compelling email subject lines for a B2B email about: ${topic}. Target audience: hotel procurement managers in North America. Return JSON: {"subjects": ["subject1", ...]}`
    }],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response from AI')
  return JSON.parse(content) as { subjects: string[] }
}
