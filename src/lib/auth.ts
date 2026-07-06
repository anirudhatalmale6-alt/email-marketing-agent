import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

function getJwtSecret(): string {
  return process.env.JWT_SECRET || '252725ea4b13506bf5fba7a7836787475c65cf9107b003af3551845b7f67a9d2'
}

interface AuthUser {
  userId: string
  username: string
  role: string
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser
    return decoded
  } catch {
    return null
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser()
  if (user.role !== 'admin') throw new Error('Admin access required')
  return user
}
