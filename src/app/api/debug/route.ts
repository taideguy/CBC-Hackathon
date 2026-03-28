// Temporary debug endpoint — remove before deploying to prod
// Usage: GET /api/debug?dot=332639

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  const dot = req.nextUrl.searchParams.get('dot')
  if (!dot) return NextResponse.json({ error: 'Pass ?dot=NUMBER' }, { status: 400 })

  const key = process.env.FMCSA_API_KEY
  if (!key) return NextResponse.json({ error: 'FMCSA_API_KEY not set' }, { status: 500 })

  const base = 'https://mobile.fmcsa.dot.gov/qc/services'
  const results: Record<string, unknown> = {}

  for (const path of [`/carriers/${dot}`, `/carriers/${dot}/authority`, `/carriers/${dot}/basics`]) {
    try {
      const res = await fetch(`${base}${path}?webKey=${key}`, {
        headers: { Accept: 'application/json' },
      })
      results[path] = { status: res.status, body: await res.json() }
    } catch (e) {
      results[path] = { error: String(e) }
    }
  }

  return NextResponse.json(results, { status: 200 })
}
