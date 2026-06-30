import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function makeLinkedInUrl(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, '').trim()
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(cleaned)}`
}

async function getGoogleMapsKey(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: 'google_maps_api_key' } })
  if (!setting?.value) throw new Error('Google Maps API key not configured. Add it in Settings.')
  return setting.value
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, query, pageToken, placeIds } = body

    if (action === 'search') {
      if (!query) {
        return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
      }

      const apiKey = await getGoogleMapsKey()

      // Use new Places API (Text Search)
      const searchBody: any = { textQuery: query, pageSize: 20 }
      if (pageToken) searchBody.pageToken = pageToken

      const newRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.businessStatus,nextPageToken',
        },
        body: JSON.stringify(searchBody),
      })

      if (!newRes.ok) {
        const errData = await newRes.json().catch(() => ({}))
        const errMsg = errData?.error?.message || `API error ${newRes.status}`
        return NextResponse.json({ error: errMsg }, { status: newRes.status })
      }

      const data = await newRes.json()

      const places = (data.places || []).map((place: any) => ({
        placeId: place.id,
        name: place.displayName?.text || '',
        address: place.formattedAddress || '',
        rating: place.rating || null,
        totalRatings: place.userRatingCount || 0,
        types: place.types || [],
        businessStatus: place.businessStatus || '',
      }))

      return NextResponse.json({
        places,
        nextPageToken: data.nextPageToken || null,
        total: places.length,
      })
    }

    if (action === 'details') {
      if (!placeIds?.length) {
        return NextResponse.json({ error: 'placeIds required' }, { status: 400 })
      }

      const apiKey = await getGoogleMapsKey()
      const results = []
      const errors: string[] = []

      // Try new Places API first, fall back to legacy
      for (const placeId of placeIds.slice(0, 20)) {
        try {
          // New Places API (recommended)
          const newRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'displayName,formattedAddress,internationalPhoneNumber,nationalPhoneNumber,websiteUri,rating,userRatingCount,googleMapsUri',
            },
          })

          if (newRes.ok) {
            const r = await newRes.json()
            const name = r.displayName?.text || ''
            results.push({
              placeId,
              name,
              address: r.formattedAddress || '',
              phone: r.internationalPhoneNumber || r.nationalPhoneNumber || '',
              website: r.websiteUri || '',
              rating: r.rating || null,
              totalRatings: r.userRatingCount || 0,
              mapsUrl: r.googleMapsUri || '',
              linkedinUrl: name ? makeLinkedInUrl(name) : '',
            })
            continue
          }

          // Fall back to legacy API
          const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
          url.searchParams.set('place_id', placeId)
          url.searchParams.set('fields', 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,url,types')
          url.searchParams.set('key', apiKey)

          const res = await fetch(url.toString())
          const data = await res.json()

          if (data.status === 'OK' && data.result) {
            const r = data.result
            const legacyName = r.name || ''
            results.push({
              placeId,
              name: legacyName,
              address: r.formatted_address || '',
              phone: r.international_phone_number || r.formatted_phone_number || '',
              website: r.website || '',
              rating: r.rating || null,
              totalRatings: r.user_ratings_total || 0,
              mapsUrl: r.url || '',
              linkedinUrl: legacyName ? makeLinkedInUrl(legacyName) : '',
            })
          } else {
            errors.push(`${placeId}: ${data.status} - ${data.error_message || 'unknown error'}`)
          }
        } catch (e) {
          errors.push(`${placeId}: ${e instanceof Error ? e.message : 'fetch failed'}`)
        }
      }

      return NextResponse.json({ results, errors: errors.length > 0 ? errors : undefined })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Google Maps API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search Google Maps' },
      { status: 500 }
    )
  }
}
