import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { host, port, secure, username, password } = body

    if (!host || !port || !username || !password) {
      return NextResponse.json(
        { error: 'host, port, username, and password are required' },
        { status: 400 }
      )
    }

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: secure ?? true,
      auth: { user: username, pass: password },
    })

    // Verify the connection
    await transport.verify()
    transport.close()

    return NextResponse.json({ success: true, message: 'SMTP connection successful' })
  } catch (error) {
    console.error('SMTP test failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Connection failed' },
      { status: 400 }
    )
  }
}
