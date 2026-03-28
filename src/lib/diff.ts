// src/lib/diff.ts
// Bulk FMCSA file download, parse, and ownership diff logic.

import { createWriteStream, createReadStream } from 'fs'
import { createUnzip } from 'zlib'
import { tmpdir } from 'os'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { unlink } from 'fs/promises'
import type { CarrierSnapshot } from '@/types'

// csv-parser is a CommonJS module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const csv = require('csv-parser')

interface CensusRow {
  dotNumber: string
  legalName: string
  physicalAddress: string
  phone: string
}

interface Census2Row {
  dotNumber: string
  ein: string
}

interface InsHistRow {
  dotNumber: string
  cancellationDate: string | null  // ISO date string of the nearest future cancellation
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const fileStream = createWriteStream(destPath)
  // @ts-expect-error Node.js ReadableStream vs Web ReadableStream
  await pipeline(res.body, fileStream)
}

// ---------------------------------------------------------------------------
// Stream-parse CENSUS1.zip — only extract rows for watched DOT numbers
// ---------------------------------------------------------------------------

export async function parseCensus1(
  filePath: string,
  dotNumbers: Set<string>
): Promise<Map<string, CensusRow>> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, CensusRow>()

    createReadStream(filePath)
      .pipe(createUnzip())
      .pipe(csv())
      .on('data', (row: Record<string, string>) => {
        const dot = row['DOT_NUMBER']?.trim()
        if (!dot || !dotNumbers.has(dot)) return

        const street = row['PHY_STREET']?.trim() ?? ''
        const city = row['PHY_CITY']?.trim() ?? ''
        const state = row['PHY_STATE']?.trim() ?? ''
        const zip = row['PHY_ZIP']?.trim() ?? ''

        results.set(dot, {
          dotNumber: dot,
          legalName: row['LEGAL_NAME']?.trim() ?? '',
          physicalAddress: [street, city, state, zip].filter(Boolean).join(', '),
          phone: row['TELEPHONE']?.trim() ?? '',
        })
      })
      .on('end', () => resolve(results))
      .on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Stream-parse CENSUS2.zip — EIN field
// ---------------------------------------------------------------------------

export async function parseCensus2(
  filePath: string,
  dotNumbers: Set<string>
): Promise<Map<string, Census2Row>> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, Census2Row>()

    createReadStream(filePath)
      .pipe(createUnzip())
      .pipe(csv())
      .on('data', (row: Record<string, string>) => {
        const dot = row['DOT_NUMBER']?.trim()
        if (!dot || !dotNumbers.has(dot)) return

        results.set(dot, {
          dotNumber: dot,
          ein: row['EIN_NO']?.trim() ?? '',
        })
      })
      .on('end', () => resolve(results))
      .on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Stream-parse INSITHIST.zip — find nearest future cancellation date per DOT
// ---------------------------------------------------------------------------

export async function parseInsHist(
  filePath: string,
  dotNumbers: Set<string>
): Promise<Map<string, InsHistRow>> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, InsHistRow>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    createReadStream(filePath)
      .pipe(createUnzip())
      .pipe(csv())
      .on('data', (row: Record<string, string>) => {
        const dot = (row['DOT_NUMBER'] ?? row['USDOT_NUMBER'])?.trim()
        if (!dot || !dotNumbers.has(dot)) return

        const rawDate = row['CANCELLATION_DATE']?.trim()
        if (!rawDate) return

        const cancellationDate = new Date(rawDate)
        if (isNaN(cancellationDate.getTime())) return

        // Only keep future (or today) cancellation dates
        if (cancellationDate < today) return

        const existing = results.get(dot)
        // Keep the nearest upcoming cancellation date
        if (!existing || !existing.cancellationDate || cancellationDate < new Date(existing.cancellationDate)) {
          results.set(dot, {
            dotNumber: dot,
            cancellationDate: cancellationDate.toISOString().split('T')[0],
          })
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Compare today's data against yesterday's snapshot
// ---------------------------------------------------------------------------

export function compareSnapshot(
  yesterday: CarrierSnapshot,
  today: CarrierSnapshot
): { field: string; oldValue: string; newValue: string }[] {
  const changes: { field: string; oldValue: string; newValue: string }[] = []

  const fields: Array<{ key: keyof CarrierSnapshot; label: string }> = [
    { key: 'legalName', label: 'legalName' },
    { key: 'physicalAddress', label: 'address' },
    { key: 'phone', label: 'phone' },
    { key: 'ein', label: 'ein' },
  ]

  for (const { key, label } of fields) {
    const oldVal = yesterday[key]
    const newVal = today[key]
    if (oldVal && newVal && oldVal !== newVal) {
      changes.push({ field: label, oldValue: oldVal as string, newValue: newVal as string })
    }
  }

  return changes
}

// ---------------------------------------------------------------------------
// Main diff entry point — called by the cron route
// ---------------------------------------------------------------------------

export async function runOwnershipDiff(watchedDotNumbers: Set<string>): Promise<{
  processed: number
  changes: {
    dotNumber: string
    field: string
    oldValue: string
    newValue: string
    todaySnapshot: CarrierSnapshot
  }[]
}> {
  if (watchedDotNumbers.size === 0) {
    return { processed: 0, changes: [] }
  }

  const tmpCensus1 = join(tmpdir(), `census1-${Date.now()}.zip`)
  const tmpCensus2 = join(tmpdir(), `census2-${Date.now()}.zip`)
  const tmpInsHist = join(tmpdir(), `inshist-${Date.now()}.zip`)

  try {
    // Download all three files in parallel
    await Promise.all([
      downloadFile('https://ai.fmcsa.dot.gov/SMS/files/CENSUS1.zip', tmpCensus1),
      downloadFile('https://ai.fmcsa.dot.gov/SMS/files/CENSUS2.zip', tmpCensus2),
      downloadFile('https://ai.fmcsa.dot.gov/SMS/files/INSITHIST.zip', tmpInsHist).catch(() => null),
    ])

    const [census1Data, census2Data, insHistData] = await Promise.all([
      parseCensus1(tmpCensus1, watchedDotNumbers),
      parseCensus2(tmpCensus2, watchedDotNumbers),
      parseInsHist(tmpInsHist, watchedDotNumbers).catch(() => new Map<string, InsHistRow>()),
    ])

    const today = new Date().toISOString().split('T')[0]
    const todaySnapshots = new Map<string, CarrierSnapshot>()

    for (const dot of watchedDotNumbers) {
      const c1 = census1Data.get(dot)
      const c2 = census2Data.get(dot)

      if (!c1) continue

      todaySnapshots.set(dot, {
        dotNumber: dot,
        snapshotDate: today,
        legalName: c1.legalName,
        physicalAddress: c1.physicalAddress,
        phone: c1.phone,
        ein: c2?.ein ?? null,
        insuranceCancellationDate: insHistData.get(dot)?.cancellationDate ?? null,
      })
    }

    return {
      processed: todaySnapshots.size,
      changes: [], // Caller will do the DB snapshot comparison
      // We return the snapshots via todaySnapshots — but changes need DB access
      // The cron route handles the DB diff loop
      ...{ todaySnapshots },
    } as {
      processed: number
      changes: {
        dotNumber: string
        field: string
        oldValue: string
        newValue: string
        todaySnapshot: CarrierSnapshot
      }[]
      todaySnapshots: Map<string, CarrierSnapshot>
    }
  } finally {
    // Clean up temp files
    await Promise.all([
      unlink(tmpCensus1).catch(() => {}),
      unlink(tmpCensus2).catch(() => {}),
      unlink(tmpInsHist).catch(() => {}),
    ])
  }
}
