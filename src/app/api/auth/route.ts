import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const ADMIN_USERNAME = 'dbscards'
const ADMIN_PASSWORD_HASH = '$2b$10$/i/q8QGzUYG3DZ.FmCnZzOCTunL0RTR0G7tHICCmIAi1LZFAIGQPq'

function getJwtSecret(): string {
  return process.env.JWT_SECRET || '252725ea4b13506bf5fba7a7836787475c65cf9107b003af3551845b7f67a9d2'
}

export async function POST(request: NextRequest) {
  try {
    const { action, username, password } = await request.json()

    if (action === 'login') {
      if (!username || !password) {
        return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
      }

      if (username !== ADMIN_USERNAME) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH)
      if (!valid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const token = jwt.sign({ username, role: 'admin' }, getJwtSecret(), { expiresIn: '7d' })

      const response = NextResponse.json({ success: true })
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      })

      return response
    }

    if (action === 'logout') {
      const response = NextResponse.json({ success: true })
      response.cookies.set('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
      return response
    }

    if (action === 'check') {
      const token = request.cookies.get('auth_token')?.value
      if (!token) {
        return NextResponse.json({ authenticated: false })
      }

      try {
        const decoded = jwt.verify(token, getJwtSecret()) as { username: string }
        return NextResponse.json({ authenticated: true, username: decoded.username })
      } catch {
        return NextResponse.json({ authenticated: false })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
