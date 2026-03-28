// src/app/api/cron/diff/route.ts
// GET /api/cron/diff — Vercel Cron trigger at 03:00 UTC

import { NextRequest, NextResponse } from 'next/server'
import { getWatchedCarriers, getOwnershipSnapshot, writeSnapshot, writeOwnershipEvent, getUnalertedEvents, markEventsAlerted } from '@/lib/db'
import { runOwnershipDiff, compareSnapshot } from '@/lib/diff'
import { sendSMSAlert, sendEmailAlert } from '@/lib/alerts'
import type { CronDiffResponse } from '@/types'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const startTime = Date.now()

  if (process.env.NODE_ENV === 'development') {
    console.log('[DEV] Cron diff skipped in development')
    return NextResponse.json<CronDiffResponse>({
      processed: 0,
      changesDetected: 0,
      alertsSent: 0,
      durationMs: Date.now() - startTime,
    })
  }

  try {
    // Get all watched carriers across all users
    const watchedCarriers = await getWatchedCarriers()
    const dotNumbers = new Set(watchedCarriers.map((c) => c.dotNumber))

    if (dotNumbers.size === 0) {
      return NextResponse.json<CronDiffResponse>({
        processed: 0,
        changesDetected: 0,
        alertsSent: 0,
        durationMs: Date.now() - startTime,
      })
    }

    // Download and parse bulk files
    type DiffResultWithSnapshots = {
      processed: number
      changes: { dotNumber: string; field: string; oldValue: string; newValue: string; todaySnapshot: import('@/types').CarrierSnapshot }[]
      todaySnapshots: Map<string, import('@/types').CarrierSnapshot>
    }
    const diffResult = await runOwnershipDiff(dotNumbers) as DiffResultWithSnapshots

    const todaySnapshots = diffResult.todaySnapshots ?? new Map()
    let changesDetected = 0

    // Compare each carrier against yesterday's snapshot
    const snapshotWriteOps: Promise<void>[] = []
    const eventWriteOps: Promise<void>[] = []

    for (const [dotNumber, todaySnapshot] of todaySnapshots) {
      const yesterday = await getOwnershipSnapshot(dotNumber)

      if (yesterday) {
        const changes = compareSnapshot(yesterday, todaySnapshot)
        for (const change of changes) {
          changesDetected++
          eventWriteOps.push(
            writeOwnershipEvent({
              dotNumber,
              fieldChanged: change.field,
              oldValue: change.oldValue,
              newValue: change.newValue,
            })
          )
        }
      }

      snapshotWriteOps.push(writeSnapshot(dotNumber, todaySnapshot))
    }

    await Promise.all([...snapshotWriteOps, ...eventWriteOps])

    // Send alerts for unalerted events
    const events = await getUnalertedEvents()
    let alertsSent = 0
    const alertedIds: string[] = []

    for (const event of events) {
      const carriers = watchedCarriers.filter((c) => c.dotNumber === event.dotNumber)

      for (const carrier of carriers) {
        if (carrier.alertPhone) {
          await sendSMSAlert(carrier.alertPhone, carrier.carrierName, event.dotNumber, event.fieldChanged)
          alertsSent++
        }
        if (carrier.alertEmail) {
          await sendEmailAlert(
            carrier.alertEmail,
            carrier.carrierName,
            event.dotNumber,
            event.fieldChanged,
            event.oldValue,
            event.newValue,
            event.detectedAt
          )
          alertsSent++
        }
      }

      alertedIds.push(event.id)
    }

    await markEventsAlerted(alertedIds)

    return NextResponse.json<CronDiffResponse>({
      processed: diffResult.processed,
      changesDetected,
      alertsSent,
      durationMs: Date.now() - startTime,
    })
  } catch (err) {
    console.error('Cron diff error:', err)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
