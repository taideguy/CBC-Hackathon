// src/app/api/carrier/route.ts
// POST /api/carrier — main carrier lookup endpoint

import { NextRequest, NextResponse } from 'next/server'
import { resolveIdentifier, fetchAllCarrierData, fetchDotByMC } from '@/lib/fmcsa'
import { scoreSignals, deriveVerdict, scoreCargoFit, scoreOperatingClass, buildInspectionStats } from '@/lib/scoring'
import { generateSummaryStream } from '@/lib/claude'
import { getPreviousSnapshot, writeSnapshot, getOwnershipEventCount, getInsHistFlag } from '@/lib/db'
import { getFleetProfile, buildFleetProfile } from '@/lib/fleet'
import type { Carrier, CarrierLookupResponse, CarrierResult } from '@/types'

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  try {
    const body = await req.json()
    const query: string = body?.query ?? ''

    if (!query || query.trim().length === 0) {
      return NextResponse.json<CarrierLookupResponse>(
        { error: 'Enter a DOT number, MC number, or carrier name', code: 'INVALID_QUERY' },
        { status: 400 }
      )
    }

    const identifier = resolveIdentifier(query)

    // Carrier name search is not supported yet — require numeric input
    if (identifier.type === 'name') {
      return NextResponse.json<CarrierLookupResponse>(
        { error: 'Enter a DOT number, MC number, or carrier name', code: 'INVALID_QUERY' },
        { status: 400 }
      )
    }

    let dotNumber = identifier.value

    // Resolve MC → DOT
    if (identifier.type === 'mc') {
      try {
        dotNumber = await fetchDotByMC(identifier.value)
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg === 'NOT_FOUND') {
          return NextResponse.json<CarrierLookupResponse>(
            { error: 'Carrier not found — check the number', code: 'NOT_FOUND' },
            { status: 404 }
          )
        }
        return NextResponse.json<CarrierLookupResponse>(
          { error: 'FMCSA is unreachable — try again', code: 'FMCSA_ERROR' },
          { status: 502 }
        )
      }
    }

    // Fetch carrier data (mocked in dev)
    let fmcsaData
    try {
      fmcsaData = await fetchAllCarrierData(dotNumber)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'NOT_FOUND') {
        return NextResponse.json<CarrierLookupResponse>(
          { error: 'Carrier not found — check the number', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }
      if (msg.startsWith('FMCSA_ERROR')) {
        return NextResponse.json<CarrierLookupResponse>(
          { error: 'FMCSA is unreachable — try again', code: 'FMCSA_ERROR' },
          { status: 502 }
        )
      }
      throw err
    }

    const rawCarrier = fmcsaData.carrier.content[0].carrier

    const carrier: Carrier = {
      dotNumber: rawCarrier.dotNumber,
      mcNumber: null, // QCMobile doesn't return MC — enriched separately
      legalName: rawCarrier.legalName,
      dbaName: rawCarrier.dbaName,
      state: rawCarrier.phyState,
      powerUnits: rawCarrier.totalPowerUnits,
      drivers: rawCarrier.totalDrivers,
      entityType: rawCarrier.entityType,
      operatingStatus: rawCarrier.operatingStatus,
      operatingClassification: rawCarrier.operatingClassification,
      cargoCarried: rawCarrier.cargoCarried,
    }

    // Write today's snapshot synchronously before scoring so it exists for future diffs.
    // getPreviousSnapshot fetches the baseline (any date before today) for the ownership diff.
    // All three DB ops run in parallel; snapshot write is awaited so it completes before response.
    const [snapshot, fleetProfile, changeVelocity, insHistFlag] = await Promise.all([
      getPreviousSnapshot(dotNumber),
      getFleetProfile(dotNumber),
      getOwnershipEventCount(dotNumber),
      getInsHistFlag(dotNumber),
      writeSnapshot(dotNumber, {
        legalName: rawCarrier.legalName,
        physicalAddress: rawCarrier.phyState,
        phone: '',
        ein: null,
        insuranceCancellationDate: null,
        rawJson: { carrier: rawCarrier },
      }),
    ])

    // Build inspection stats from carrier response
    const inspectionStats = buildInspectionStats(fmcsaData.carrier)

    // Score all signals
    const signals = scoreSignals({
      carrier: fmcsaData.carrier,
      authority: fmcsaData.authority,
      basics: fmcsaData.basics,
      snapshot,
      changeVelocity,
      inspectionStats,
      insHistFlag,
    })

    // If a commodity was sent with the request, add cargo fit signal before Claude call
    const commodity: string = body?.commodity ?? ''
    const cargoFitSignal = scoreCargoFit(
      commodity,
      rawCarrier.cargoCarried,
      rawCarrier.entityType
    )
    const operatingClassSignal = scoreOperatingClass(rawCarrier.operatingClassification)
    const allSignals = [
      ...signals,
      ...(cargoFitSignal ? [cargoFitSignal] : []),
      ...(operatingClassSignal ? [operatingClassSignal] : []),
    ]

    const verdict = deriveVerdict(allSignals)
    const checkedAt = new Date().toISOString()

    // Build fleet profile lazily if not cached (fire and forget)
    if (!fleetProfile) {
      buildFleetProfile(dotNumber).catch(console.error)
    }

    // Stream response: first send the non-summary data, then stream the summary
    const summaryStream = await generateSummaryStream(carrier, allSignals, verdict)

    // Build result without summary first, then stream the summary appended
    // We use a custom streaming response: JSON prefix + streaming summary suffix
    // Format: <JSON_PREFIX>\n<SUMMARY_STREAM>
    const result: Omit<CarrierResult, 'summary'> = {
      carrier,
      verdict,
      signals: allSignals,
      cached: false,
      checkedAt,
      fleetProfile: fleetProfile ?? null,
      hadPriorSnapshot: snapshot !== null,
      inspectionStats,
    }

    const prefix = JSON.stringify(result) + '\n'
    const encoder = new TextEncoder()

    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(prefix))
        const reader = summaryStream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        } finally {
          reader.releaseLock()
          controller.close()
        }
      },
    })

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    console.error('POST /api/carrier error:', err)
    return NextResponse.json<CarrierLookupResponse>(
      { error: 'FMCSA is unreachable — try again', code: 'FMCSA_ERROR' },
      { status: 502 }
    )
  }
}
