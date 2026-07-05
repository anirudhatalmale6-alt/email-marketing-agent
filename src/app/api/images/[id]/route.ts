import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const image = await prisma.uploadedImage.findUnique({ where: { id } })

    if (!image) {
      return new NextResponse('Not found', { status: 404 })
    }

    const buffer = Buffer.from(image.data, 'base64')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': image.mimeType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Server error', { status: 500 })
  }
}
