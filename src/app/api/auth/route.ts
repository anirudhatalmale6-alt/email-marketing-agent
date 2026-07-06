import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

const DEFAULT_ADMIN_USERNAME = 'dbscards'
const DEFAULT_PASSWORD_HASH = '$2b$10$EH1iZkivk2DF5Kg8i0gNW.AkJJLL5O90x6x566VdxZR4ITRk9IF0y'

function getJwtSecret(): string {
  return process.env.JWT_SECRET || '252725ea4b13506bf5fba7a7836787475c65cf9107b003af3551845b7f67a9d2'
}

async function ensureAdminUser() {
  const admin = await prisma.user.findUnique({ where: { username: DEFAULT_ADMIN_USERNAME } })
  if (!admin) {
    const setting = await prisma.setting.findUnique({ where: { key: 'admin_password_hash' } })
    const passwordHash = setting?.value || DEFAULT_PASSWORD_HASH
    const created = await prisma.user.create({
      data: {
        username: DEFAULT_ADMIN_USERNAME,
        password: passwordHash,
        name: 'DBS Cards',
        role: 'admin',
      },
    })
    await prisma.lead.updateMany({ where: { userId: null }, data: { userId: created.id } })
    await prisma.template.updateMany({ where: { userId: null }, data: { userId: created.id } })
    await prisma.campaign.updateMany({ where: { userId: null }, data: { userId: created.id } })
    await prisma.smtpConfig.updateMany({ where: { userId: null }, data: { userId: created.id } })
    await prisma.tag.updateMany({ where: { userId: null }, data: { userId: created.id } })
    return created
  }
  return admin
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

      await ensureAdminUser()

      const user = await prisma.user.findUnique({ where: { username } })
      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        getJwtSecret(),
        { expiresIn: '7d' }
      )

      const response = NextResponse.json({ success: true, user: { username: user.username, name: user.name, role: user.role } })
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
        const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; username: string; role: string }
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
        if (!user) return NextResponse.json({ authenticated: false })
        return NextResponse.json({
          authenticated: true,
          userId: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        })
      } catch {
        return NextResponse.json({ authenticated: false })
      }
    }

    if (action === 'change-password') {
      const token = request.cookies.get('auth_token')?.value
      if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }

      let decoded: { userId: string }
      try {
        decoded = jwt.verify(token, getJwtSecret()) as { userId: string }
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

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }

      const newHash = await bcrypt.hash(newPassword, 10)
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { password: newHash },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
