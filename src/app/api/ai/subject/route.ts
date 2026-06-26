import { NextRequest, NextResponse } from 'next/server'
import { generateSubjectLines } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, count } = body

    if (!topic) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 })
    }

    const result = await generateSubjectLines(topic, count || 5)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to generate subject lines:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate subject lines' },
      { status: 500 }
    )
  }
}
