// src/app/api/ownership/route.ts
// GET /api/ownership?dot=<dotNumber> — ownership event history for a carrier

import { NextRequest, NextResponse } from 'next/server'
import { getOwnershipEvents } from '@/lib/db'

export async function GET(req: NextRequest) {
  const dot = req.nextUrl.searchParams.get('dot')
  if (!dot) {
    return NextResponse.json({ error: 'Missing dot parameter' }, { status: 400 })
  }

  try {
    const events = await getOwnershipEvents(dot)
    return NextResponse.json({ events })
  } catch (err) {
    console.error('GET /api/ownership error:', err)
    return NextResponse.json({ error: 'Failed to load ownership history' }, { status: 500 })
  }
}
