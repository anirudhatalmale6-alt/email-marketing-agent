import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runAllAutoCampaigns } from '@/lib/auto-sender'

// Called by an external scheduler (cron-job.org, GitHub Actions, Vercel Cron),
// so it sits outside the dashboard login. A secret keeps it from being poked by
// anyone who guesses the URL.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function authorize(request: NextRequest): Promise<boolean> {
  const secretRow = await prisma.setting.findUnique({ where: { key: 'cron_secret' } }).catch(() => null)
  const expected = secretRow?.value || process.env.CRON_SECRET || ''

  // With no secret configured the endpoint stays closed rather than open.
  if (!expected) return false

  const header = request.headers.get('authorization') || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const queryKey = request.nextUrl.searchParams.get('key') || ''
  return bearer === expected || queryKey === expected
}

async function handle(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json(
      { error: 'Unauthorized. Set a Cron Secret in Settings and pass it as ?key=... or a Bearer token.' },
      { status: 401 }
    )
  }

  try {
    const results = await runAllAutoCampaigns()
    const sent = results.reduce((n, r) => n + r.sent, 0)
    const failed = results.reduce((n, r) => n + r.failed, 0)
    return NextResponse.json({ ok: true, sent, failed, campaigns: results, at: new Date().toISOString() })
  } catch (error) {
    console.error('Cron send failed:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Cron run failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
