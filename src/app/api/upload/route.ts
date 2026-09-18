import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, GIF, or WebP.' }, { status: 400 })
    }

    // The editor shrinks large images in the browser before they get here, so
    // this is just a backstop. Kept under Vercel's ~4.5MB request body limit.
    if (file.size > 4 * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1)
      return NextResponse.json(
        { error: `Image is ${mb}MB - too large. Please use an image under 4MB.` },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const image = await prisma.uploadedImage.create({
      data: {
        filename: file.name,
        mimeType: file.type,
        data: base64,
      },
    })

    const baseUrl = request.headers.get('x-forwarded-host')
      ? `https://${request.headers.get('x-forwarded-host')}`
      : request.headers.get('host')
        ? `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`
        : ''

    const url = `${baseUrl}/api/images/${image.id}`

    return NextResponse.json({ url, filename: file.name })
  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
