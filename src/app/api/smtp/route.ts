import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const configs = await prisma.smtpConfig.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Mask passwords in response
    const masked = configs.map((config) => ({
      ...config,
      password: '••••••••',
    }))

    return NextResponse.json(masked)
  } catch (error) {
    console.error('Failed to fetch SMTP configs:', error)
    return NextResponse.json({ error: 'Failed to fetch SMTP configs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, host, port, secure, username, password, fromName, fromEmail, isDefault } = body

    if (!name || !host || !port || !username || !password || !fromName || !fromEmail) {
      return NextResponse.json(
        { error: 'name, host, port, username, password, fromName, and fromEmail are required' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.smtpConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const config = await prisma.smtpConfig.create({
      data: {
        name,
        host,
        port,
        secure: secure ?? true,
        username,
        password,
        fromName,
        fromEmail,
        isDefault: isDefault || false,
      },
    })

    return NextResponse.json({ ...config, password: '••••••••' }, { status: 201 })
  } catch (error) {
    console.error('Failed to create SMTP config:', error)
    return NextResponse.json({ error: 'Failed to create SMTP config' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, host, port, secure, username, password, fromName, fromEmail, isDefault } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await prisma.smtpConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'SMTP config not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.smtpConfig.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const config = await prisma.smtpConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(host !== undefined && { host }),
        ...(port !== undefined && { port }),
        ...(secure !== undefined && { secure }),
        ...(username !== undefined && { username }),
        ...(password !== undefined && { password }),
        ...(fromName !== undefined && { fromName }),
        ...(fromEmail !== undefined && { fromEmail }),
        ...(isDefault !== undefined && { isDefault }),
      },
    })

    return NextResponse.json({ ...config, password: '••••••••' })
  } catch (error) {
    console.error('Failed to update SMTP config:', error)
    return NextResponse.json({ error: 'Failed to update SMTP config' }, { status: 500 })
  }
}
