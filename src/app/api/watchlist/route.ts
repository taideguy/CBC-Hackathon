// src/app/api/watchlist/route.ts
// GET + POST /api/watchlist

import { NextRequest, NextResponse } from 'next/server'
import { getWatchlist, addToWatchlist } from '@/lib/db'
import type { AddWatchlistResponse } from '@/types'

function getUserId(req: NextRequest): string | null {
  return req.headers.get('x-user-id')
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'x-user-id header required' }, { status: 400 })
  }

  try {
    const items = await getWatchlist(userId)
    return NextResponse.json({ items })
  } catch (err) {
    console.error('GET /api/watchlist error:', err)
    return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'x-user-id header required' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { dotNumber, carrierName, mcNumber, alertPhone, alertEmail } = body

    if (!dotNumber || !carrierName) {
      return NextResponse.json<AddWatchlistResponse>(
        { error: 'dotNumber and carrierName are required' },
        { status: 400 }
      )
    }

    const id = await addToWatchlist(userId, dotNumber, carrierName, mcNumber, alertPhone, alertEmail)
    return NextResponse.json<AddWatchlistResponse>({ id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/watchlist error:', err)
    // Duplicate entry (already on watchlist)
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json<AddWatchlistResponse>(
        { error: 'Carrier already on watchlist' },
        { status: 409 }
      )
    }
    return NextResponse.json<AddWatchlistResponse>({ error: 'Failed to add carrier' }, { status: 500 })
  }
}
