import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const settings = await prisma.setting.findMany()

    // Convert to key-value object
    const result: Record<string, string> = {}
    for (const setting of settings) {
      // Mask sensitive values
      if (setting.key.includes('api_key') || setting.key.includes('password') || setting.key.includes('secret')) {
        result[setting.key] = setting.value ? '••••••••' + setting.value.slice(-4) : ''
      } else {
        result[setting.key] = setting.value
      }
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

    // Body can be a single {key, value} or an object of key-value pairs
    if (body.key && body.value !== undefined) {
      // Single setting
      await prisma.setting.upsert({
        where: { key: body.key },
        update: { value: body.value },
        create: { key: body.key, value: body.value },
      })
    } else {
      // Multiple settings as key-value object
      const entries = Object.entries(body) as [string, string][]
      for (const [key, value] of entries) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      }
    }

    // Return all settings
    const settings = await prisma.setting.findMany()
    const result: Record<string, string> = {}
    for (const setting of settings) {
      if (setting.key.includes('api_key') || setting.key.includes('password') || setting.key.includes('secret')) {
        result[setting.key] = setting.value ? '••••••••' + setting.value.slice(-4) : ''
      } else {
        result[setting.key] = setting.value
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to save settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
