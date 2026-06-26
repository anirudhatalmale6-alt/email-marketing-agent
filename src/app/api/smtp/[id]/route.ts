import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.smtpConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'SMTP config not found' }, { status: 404 })
    }

    await prisma.smtpConfig.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete SMTP config:', error)
    return NextResponse.json({ error: 'Failed to delete SMTP config' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { to, subject, html } = body

    const config = await prisma.smtpConfig.findUnique({ where: { id } })
    if (!config) {
      return NextResponse.json({ error: 'SMTP config not found' }, { status: 404 })
    }

    if (!to) {
      return NextResponse.json({ error: 'to email address is required' }, { status: 400 })
    }

    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.username, pass: config.password },
    })

    await transport.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject: subject || 'Test Email from Email Agent',
      html: html || '<h1>Test Email</h1><p>This is a test email sent from your Email Marketing Agent.</p>',
    })

    transport.close()

    return NextResponse.json({ success: true, message: `Test email sent to ${to}` })
  } catch (error) {
    console.error('Failed to send test email:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test email' },
      { status: 500 }
    )
  }
}
