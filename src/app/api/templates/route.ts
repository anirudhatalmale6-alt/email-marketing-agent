import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireUser()
    const templates = await prisma.template.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Failed to fetch templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { name, subject, htmlContent, jsonLayout, category, thumbnail } = body

    if (!name || !subject || !htmlContent) {
      return NextResponse.json({ error: 'name, subject, and htmlContent are required' }, { status: 400 })
    }

    const template = await prisma.template.create({
      data: {
        name,
        subject,
        htmlContent,
        jsonLayout: jsonLayout || null,
        category: category || 'general',
        thumbnail: thumbnail || null,
        userId: user.userId,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Failed to create template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
