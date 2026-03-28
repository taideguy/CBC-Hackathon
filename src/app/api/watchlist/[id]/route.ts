// src/app/api/watchlist/[id]/route.ts
// DELETE /api/watchlist/:id

import { NextRequest, NextResponse } from 'next/server'
import { removeFromWatchlist } from '@/lib/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = req.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'x-user-id header required' }, { status: 400 })
  }

  try {
    const { id } = await params
    await removeFromWatchlist(id, userId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('DELETE /api/watchlist/:id error:', err)
    return NextResponse.json({ error: 'Failed to remove carrier' }, { status: 500 })
  }
}
