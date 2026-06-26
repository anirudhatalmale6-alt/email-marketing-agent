import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
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
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Failed to create template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
