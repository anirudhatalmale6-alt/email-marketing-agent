import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
      url.searchParams.set('query', query)
      url.searchParams.set('key', apiKey)
      if (pageToken) url.searchParams.set('pagetoken', pageToken)

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data.status === 'REQUEST_DENIED') {
        return NextResponse.json({ error: data.error_message || 'API key invalid or Places API not enabled' }, { status: 403 })
      }

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        return NextResponse.json({ error: `Google API error: ${data.status}` }, { status: 400 })
      }

      const places = (data.results || []).map((place: any) => ({
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address || '',
        rating: place.rating || null,
        totalRatings: place.user_ratings_total || 0,
        types: place.types || [],
        businessStatus: place.business_status || '',
      }))

      return NextResponse.json({
        places,
        nextPageToken: data.next_page_token || null,
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
            results.push({
              placeId,
              name: r.displayName?.text || '',
              address: r.formattedAddress || '',
              phone: r.internationalPhoneNumber || r.nationalPhoneNumber || '',
              website: r.websiteUri || '',
              rating: r.rating || null,
              totalRatings: r.userRatingCount || 0,
              mapsUrl: r.googleMapsUri || '',
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
            results.push({
              placeId,
              name: r.name || '',
              address: r.formatted_address || '',
              phone: r.international_phone_number || r.formatted_phone_number || '',
              website: r.website || '',
              rating: r.rating || null,
              totalRatings: r.user_ratings_total || 0,
              mapsUrl: r.url || '',
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
