import { NextRequest, NextResponse } from 'next/server'
import { scrapeHotelLeads, importScrapedLeads } from '@/lib/scraper'
import { requireUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { country, limit = 50, tagIds = [], action = 'preview' } = body

    if (!country) {
      return NextResponse.json({ error: 'Country is required' }, { status: 400 })
    }

    const result = await scrapeHotelLeads(country, limit, user.userId)

    if (action === 'import' && result.leads.length > 0) {
      const imported = await importScrapedLeads(result.leads, tagIds, user.userId)
      return NextResponse.json({
        message: `Imported ${imported} leads from ${country}`,
        imported,
        total: result.leads.length,
      })
    }

    return NextResponse.json({
      message: result.message,
      leads: result.leads,
      total: result.leads.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scraping failed' },
      { status: 500 }
    )
  }
}
