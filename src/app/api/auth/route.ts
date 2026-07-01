import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

const ADMIN_USERNAME = 'dbscards'
const DEFAULT_PASSWORD_HASH = '$2b$10$EH1iZkivk2DF5Kg8i0gNW.AkJJLL5O90x6x566VdxZR4ITRk9IF0y'

function getJwtSecret(): string {
  return process.env.JWT_SECRET || '252725ea4b13506bf5fba7a7836787475c65cf9107b003af3551845b7f67a9d2'
}

async function getPasswordHash(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: 'admin_password_hash' } })
  return setting?.value || DEFAULT_PASSWORD_HASH
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'login') {
      const { username, password } = body
      if (!username || !password) {
        return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
      }

      if (username !== ADMIN_USERNAME) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const hash = await getPasswordHash()
      const valid = await bcrypt.compare(password, hash)
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

    if (action === 'change-password') {
      const token = request.cookies.get('auth_token')?.value
      if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }

      try {
        jwt.verify(token, getJwtSecret())
      } catch {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }

      const { currentPassword, newPassword } = body
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Current and new password required' }, { status: 400 })
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
      }

      const hash = await getPasswordHash()
      const valid = await bcrypt.compare(currentPassword, hash)
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }

      const newHash = await bcrypt.hash(newPassword, 10)
      await prisma.setting.upsert({
        where: { key: 'admin_password_hash' },
        update: { value: newHash },
        create: { key: 'admin_password_hash', value: newHash },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
