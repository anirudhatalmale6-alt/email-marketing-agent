import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const KEY_MAP: Record<string, string> = {
  openaiApiKey: 'openai_api_key',
  apolloApiKey: 'apollo_api_key',
  hunterApiKey: 'hunter_api_key',
  googleMapsApiKey: 'google_maps_api_key',
  zerobounceApiKey: 'zerobounce_api_key',
  gmassApiKey: 'gmass_api_key',
  blandApiKey: 'bland_api_key',
  blandVoice: 'bland_voice',
  sendingMethod: 'sending_method',
  baseUrl: 'app_url',
  dailySendLimit: 'daily_send_limit',
  whatsappSessionUrl: 'whatsapp_session_url',
  whatsappTemplateUrl: 'whatsapp_template_url',
}

const REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k])
)

const SENSITIVE_KEYS = ['api_key', 'password', 'secret']

function isSensitive(key: string): boolean {
  return SENSITIVE_KEYS.some(s => key.includes(s))
}

export async function GET() {
  try {
    const settings = await prisma.setting.findMany()
    const result: Record<string, string> = {}

    for (const setting of settings) {
      const camelKey = REVERSE_MAP[setting.key] || setting.key
      result[camelKey] = setting.value
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.key && body.value !== undefined) {
      await prisma.setting.upsert({
        where: { key: body.key },
        update: { value: body.value },
        create: { key: body.key, value: body.value },
      })
    } else {
      const entries = Object.entries(body) as [string, string][]
      for (const [key, value] of entries) {
        const dbKey = KEY_MAP[key] || key
        if (isSensitive(dbKey) && String(value).startsWith('••••')) continue
        await prisma.setting.upsert({
          where: { key: dbKey },
          update: { value: String(value) },
          create: { key: dbKey, value: String(value) },
        })
      }
    }

    const settings = await prisma.setting.findMany()
    const result: Record<string, string> = {}
    for (const setting of settings) {
      const camelKey = REVERSE_MAP[setting.key] || setting.key
      result[camelKey] = setting.value
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to save settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const entries = Object.entries(body) as [string, string][]

    for (const [key, value] of entries) {
      const dbKey = KEY_MAP[key] || key
      if (isSensitive(dbKey) && String(value).startsWith('••••')) continue
      if (String(value) === '') continue
      await prisma.setting.upsert({
        where: { key: dbKey },
        update: { value: String(value) },
        create: { key: dbKey, value: String(value) },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
