import { NextRequest, NextResponse } from 'next/server'
import { getSmtpTransport } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { to, subject, htmlContent } = await request.json()

    if (!to || !htmlContent) {
      return NextResponse.json(
        { error: 'Recipient email and HTML content are required' },
        { status: 400 }
      )
    }

    const { transport, from } = await getSmtpTransport()

    await transport.sendMail({
      from,
      to,
      subject: subject || 'Test Email - Template Preview',
      html: htmlContent,
    })

    transport.close()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Test email failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test email' },
      { status: 500 }
    )
  }
}
