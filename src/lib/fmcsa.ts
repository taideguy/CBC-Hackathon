// src/lib/fmcsa.ts
// All FMCSA API calls live here. No FMCSA fetching anywhere else.

import type {
  FMCSACarrierResponse,
  FMCSAAuthorityResponse,
  FMCSABasicsResponse,
} from '@/types'

const BASE_URL = 'https://mobile.fmcsa.dot.gov/qc/services'

// ---------------------------------------------------------------------------
// Mock data — used when NODE_ENV=development
// ---------------------------------------------------------------------------

const MOCK_CLEAR: {
  carrier: FMCSACarrierResponse
  authority: FMCSAAuthorityResponse
  basics: FMCSABasicsResponse
} = {
  carrier: {
    content: [
      {
        carrier: {
          dotNumber: '1234567',
          legalName: 'GREENFIELD FREIGHT LLC',
          dbaName: null,
          allowedToOperate: 'Y',
          bipdInsuranceOnFile: 1,
          cargoInsuranceOnFile: 1,
          safetyRating: 'Satisfactory',
          safetyRatingDate: '2023-05-01',
          outOfServiceDate: null,
          totalPowerUnits: 14,
          totalDrivers: 17,
          phyState: 'OH',
          entityType: 'CARRIER',
          operatingStatus: 'ACTIVE',
          operatingClassification: 'Auth. For Hire',
          cargoCarried: ['General Freight', 'Refrigerated Food', 'Metal: Coils, Steel', 'Household Goods', 'Building Materials'],
        },
      },
    ],
  },
  authority: {
    content: {
      items: [
        {
          commonAuthorityStatus: 'ACTIVE',
          contractAuthorityStatus: 'ACTIVE',
          brokerAuthorityStatus: 'NONE',
        },
      ],
    },
  },
  basics: {
    content: {
      basics: [
        { basicType: 'Unsafe Driving', measure: 40, percentile: 30, onRoadPerformance: true },
        { basicType: 'Hours-of-Service Compliance', measure: 30, percentile: 25, onRoadPerformance: true },
        { basicType: 'Driver Fitness', measure: 20, percentile: 15, onRoadPerformance: true },
        { basicType: 'Controlled Substances/Alcohol', measure: 10, percentile: 5, onRoadPerformance: true },
        { basicType: 'Vehicle Maintenance', measure: 45, percentile: 40, onRoadPerformance: true },
      ],
    },
  },
}

const MOCK_WARN: typeof MOCK_CLEAR = {
  carrier: {
    content: [
      {
        carrier: {
          dotNumber: '9876543',
          legalName: 'FASTLANE LOGISTICS INC',
          dbaName: null,
          allowedToOperate: 'Y',
          bipdInsuranceOnFile: 1,
          cargoInsuranceOnFile: 0,
          safetyRating: 'Conditional',
          safetyRatingDate: '2024-01-15',
          outOfServiceDate: null,
          totalPowerUnits: 3,
          totalDrivers: 4,
          phyState: 'TX',
          entityType: 'CARRIER',
          operatingStatus: 'ACTIVE',
          operatingClassification: 'Auth. For Hire',
          cargoCarried: ['General Freight', 'Chemicals', 'Hazardous Materials'],
        },
      },
    ],
  },
  authority: {
    content: {
      items: [
        {
          commonAuthorityStatus: 'ACTIVE',
          contractAuthorityStatus: 'NONE',
          brokerAuthorityStatus: 'NONE',
        },
      ],
    },
  },
  basics: {
    content: {
      basics: [
        { basicType: 'Unsafe Driving', measure: 40, percentile: 30, onRoadPerformance: true },
        { basicType: 'Hours-of-Service Compliance', measure: 30, percentile: 25, onRoadPerformance: true },
        { basicType: 'Driver Fitness', measure: 20, percentile: 15, onRoadPerformance: true },
        { basicType: 'Controlled Substances/Alcohol', measure: 10, percentile: 5, onRoadPerformance: true },
        { basicType: 'Vehicle Maintenance', measure: 80, percentile: 72, onRoadPerformance: true },
      ],
    },
  },
}

const MOCK_DANGER: typeof MOCK_CLEAR = {
  carrier: {
    content: [
      {
        carrier: {
          dotNumber: '5550001',
          legalName: 'APEX TRUCKING CO',
          dbaName: null,
          allowedToOperate: 'N',
          bipdInsuranceOnFile: 0,
          cargoInsuranceOnFile: 0,
          safetyRating: 'Unsatisfactory',
          safetyRatingDate: '2026-03-22',
          outOfServiceDate: '2026-03-22',
          totalPowerUnits: 8,
          totalDrivers: 9,
          phyState: 'CA',
          entityType: 'CARRIER',
          operatingStatus: 'REVOKED',
          operatingClassification: 'Auth. For Hire',
          cargoCarried: ['General Freight'],
        },
      },
    ],
  },
  authority: {
    content: {
      items: [
        {
          commonAuthorityStatus: 'REVOKED',
          contractAuthorityStatus: 'REVOKED',
          brokerAuthorityStatus: 'NONE',
        },
      ],
    },
  },
  basics: {
    content: {
      basics: [
        { basicType: 'Unsafe Driving', measure: 90, percentile: 85, onRoadPerformance: true },
        { basicType: 'Hours-of-Service Compliance', measure: 80, percentile: 75, onRoadPerformance: true },
        { basicType: 'Driver Fitness', measure: 30, percentile: 25, onRoadPerformance: true },
        { basicType: 'Controlled Substances/Alcohol', measure: 15, percentile: 10, onRoadPerformance: true },
        { basicType: 'Vehicle Maintenance', measure: 90, percentile: 82, onRoadPerformance: true },
      ],
    },
  },
}

function getMockData(dotNumber: string): typeof MOCK_CLEAR {
  if (dotNumber === '1234567') return MOCK_CLEAR
  if (dotNumber === '5550001') return MOCK_DANGER
  return MOCK_WARN // default: warn for any other number in dev
}

// ---------------------------------------------------------------------------
// Identifier normalization
// ---------------------------------------------------------------------------

export interface ResolvedIdentifier {
  type: 'dot' | 'mc' | 'name'
  value: string
}

export function resolveIdentifier(query: string): ResolvedIdentifier {
  const trimmed = query.trim()

  // MC number formats: "MC-123456", "MC123456", "mc-123456"
  const mcMatch = trimmed.match(/^mc[-\s]?(\d+)$/i)
  if (mcMatch) {
    return { type: 'mc', value: mcMatch[1] }
  }

  // Pure numeric → DOT number
  if (/^\d+$/.test(trimmed)) {
    return { type: 'dot', value: trimmed }
  }

  return { type: 'name', value: trimmed }
}

// ---------------------------------------------------------------------------
// Production API calls
// ---------------------------------------------------------------------------

async function fmcsaGet(path: string): Promise<unknown> {
  const key = process.env.FMCSA_API_KEY
  if (!key) throw new Error('FMCSA_API_KEY not set')

  const url = `${BASE_URL}${path}?webKey=${key}`
  const res = await fetch(url, {
    next: { revalidate: 0 }, // always fresh
    headers: { Accept: 'application/json' },
  })

  if (res.status === 404) throw new Error('NOT_FOUND')
  if (!res.ok) throw new Error(`FMCSA_ERROR:${res.status}`)

  const data = await res.json()
  if (process.env.NODE_ENV === 'development') {
    console.log(`[FMCSA] ${path}:`, JSON.stringify(data, null, 2))
  }
  return data
}

// ---------------------------------------------------------------------------
// Response normalization
// The real FMCSA QCMobile API uses abbreviated status codes and dollar amounts.
// We normalize to the string values our scoring logic expects.
// ---------------------------------------------------------------------------

function normalizeOperatingStatus(raw: string | undefined): string {
  if (!raw) return 'INACTIVE'
  const upper = raw.toUpperCase()
  if (upper === 'A' || upper === 'AUTHORIZED') return 'ACTIVE'
  if (upper === 'I' || upper === 'NOT-AUTH' || upper === 'NOT AUTHORIZED') return 'INACTIVE'
  if (upper === 'R' || upper === 'REVOKED') return 'REVOKED'
  return upper // pass through if it's already "ACTIVE" etc.
}

// bipdInsuranceOnFile comes back as a dollar amount (e.g. 750000) or 0
// We normalize to 1 (has coverage) or 0 (no coverage)
function normalizeInsuranceFlag(raw: number | string | undefined): number {
  const n = Number(raw)
  if (isNaN(n)) return 0
  return n > 0 ? 1 : 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCarrierResponse(raw: any): FMCSACarrierResponse {
  // content is an object (not array) for the main carrier endpoint
  const carrier = Array.isArray(raw?.content)
    ? raw.content[0]?.carrier
    : raw?.content?.carrier

  if (!carrier) throw new Error('NOT_FOUND')

  // carrierOperation is a nested object {carrierOperationCode, carrierOperationDesc}
  const entityType = typeof carrier.carrierOperation === 'object'
    ? (carrier.carrierOperation?.carrierOperationDesc ?? carrier.carrierOperation?.carrierOperationCode ?? '')
    : (carrier.entityType ?? carrier.carrierOperation ?? '')

  // operatingClassification: "Auth. For Hire", "Private", "Both" etc.
  const operatingClassification: string | null = typeof carrier.carrierOperation === 'object'
    ? (carrier.carrierOperation?.carrierOperationDesc ?? null)
    : (carrier.operatingClassification ?? null)

  // cargoCarried: array of strings or array of {cargoCarriedDesc: string}
  const rawCargo = carrier.cargoCarried ?? []
  const cargoCarried: string[] = Array.isArray(rawCargo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? rawCargo.map((c: any) =>
        typeof c === 'string' ? c : (c?.cargoCarriedDesc ?? c?.description ?? '')
      ).filter(Boolean)
    : []

  return {
    content: [
      {
        carrier: {
          dotNumber: String(carrier.dotNbr ?? carrier.dotNumber ?? ''),
          legalName: carrier.legalName ?? '',
          dbaName: carrier.dbaName ?? null,
          allowedToOperate: (carrier.allowedToOperate === 'Y' || carrier.allowedToOperate === 'Yes') ? 'Y' : 'N',
          bipdInsuranceOnFile: normalizeInsuranceFlag(carrier.bipdInsuranceOnFile),
          cargoInsuranceOnFile: normalizeInsuranceFlag(carrier.cargoInsuranceOnFile),
          safetyRating: carrier.safetyRating ?? carrier.safetyRtng ?? null,
          safetyRatingDate: carrier.safetyRatingDate ?? carrier.safetyRtngDt ?? null,
          // real API uses oosDate, not outOfServiceDate
          outOfServiceDate: carrier.oosDate ?? carrier.outOfServiceDate ?? null,
          totalPowerUnits: Number(carrier.totalPowerUnits ?? carrier.totPwrUnt ?? 0),
          totalDrivers: Number(carrier.totalDrivers ?? carrier.totDrv ?? 0),
          phyState: carrier.phyState ?? '',
          entityType,
          // real API uses statusCode ("A"/"I"/"R"), not operatingStatus
          operatingStatus: normalizeOperatingStatus(carrier.statusCode ?? carrier.operatingStatus),
          operatingClassification,
          cargoCarried,
        },
      },
    ],
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAuthorityResponse(raw: any, carrierRaw?: any): FMCSAAuthorityResponse {
  // Authority endpoint returns content: [] (empty array) for many carriers.
  // The authority status fields are also present directly on the carrier object —
  // use those as a fallback.
  let items: Record<string, string>[] = []

  if (Array.isArray(raw?.content) && raw.content.length > 0) {
    // Populated authority endpoint response
    items = raw.content.flatMap((entry: Record<string, unknown>) =>
      Array.isArray(entry?.items) ? entry.items : [entry]
    )
  } else if (!Array.isArray(raw?.content) && raw?.content?.items) {
    items = raw.content.items
  }

  // Fallback: synthesize from carrier-level fields if items is still empty
  if (items.length === 0 && carrierRaw) {
    const c = Array.isArray(carrierRaw?.content)
      ? carrierRaw.content[0]?.carrier
      : carrierRaw?.content?.carrier
    if (c) {
      items = [{
        commonAuthorityStatus: c.commonAuthorityStatus ?? 'NONE',
        contractAuthorityStatus: c.contractAuthorityStatus ?? 'NONE',
        brokerAuthorityStatus: c.brokerAuthorityStatus ?? 'NONE',
      }]
    }
  }

  return {
    content: {
      items: items.map((item) => ({
        commonAuthorityStatus: normalizeOperatingStatus(item.commonAuthorityStatus ?? item.commonAuthority ?? 'NONE'),
        contractAuthorityStatus: normalizeOperatingStatus(item.contractAuthorityStatus ?? item.contractAuthority ?? 'NONE'),
        brokerAuthorityStatus: normalizeOperatingStatus(item.brokerAuthorityStatus ?? item.brokerAuthority ?? 'NONE'),
      })),
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBasicsResponse(raw: any): FMCSABasicsResponse {
  const content = Array.isArray(raw?.content)
    ? raw.content[0]
    : raw?.content

  const basics = content?.basics ?? content?.basicsInfo ?? []

  return {
    content: {
      basics: Array.isArray(basics)
        ? basics.map((b: Record<string, unknown>) => ({
            basicType: String(b.basicType ?? b.basic ?? ''),
            measure: Number(b.measure ?? b.measureValue ?? 0),
            percentile: Number(b.percentile ?? b.percentileRank ?? 0),
            onRoadPerformance: Boolean(b.onRoadPerformance ?? b.onRoad ?? true),
          }))
        : [],
    },
  }
}

// ---------------------------------------------------------------------------
// Public fetch functions (production)
// ---------------------------------------------------------------------------

export async function fetchCarrierSafety(dotNumber: string): Promise<FMCSACarrierResponse> {
  const raw = await fmcsaGet(`/carriers/${dotNumber}`)
  return normalizeCarrierResponse(raw)
}

export async function fetchCarrierAuth(dotNumber: string, carrierRaw?: unknown): Promise<FMCSAAuthorityResponse> {
  const raw = await fmcsaGet(`/carriers/${dotNumber}/authority`)
  return normalizeAuthorityResponse(raw, carrierRaw)
}

export async function fetchCarrierBasics(dotNumber: string): Promise<FMCSABasicsResponse> {
  const raw = await fmcsaGet(`/carriers/${dotNumber}/basics`)
  return normalizeBasicsResponse(raw)
}

// ---------------------------------------------------------------------------
// Lookup by MC number
// ---------------------------------------------------------------------------

export async function fetchDotByMC(mcNumber: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await fmcsaGet(`/carriers/docket-number/${mcNumber}`) as any
  const content = Array.isArray(data?.content) ? data.content : [data?.content]
  const dot = content?.[0]?.carrier?.dotNbr ?? content?.[0]?.carrier?.dotNumber
  if (!dot) throw new Error('NOT_FOUND')
  return String(dot)
}

// ---------------------------------------------------------------------------
// Public entry point — mocked in dev unless USE_REAL_API=true
// ---------------------------------------------------------------------------

export interface FMCSACarrierData {
  carrier: FMCSACarrierResponse
  authority: FMCSAAuthorityResponse
  basics: FMCSABasicsResponse
  dotNumber: string
}

function useMocks(): boolean {
  // USE_REAL_API=true forces real API calls even in development
  if (process.env.USE_REAL_API === 'true') return false
  return process.env.NODE_ENV === 'development'
}

export async function fetchAllCarrierData(dotNumber: string): Promise<FMCSACarrierData> {
  if (useMocks()) {
    const mock = getMockData(dotNumber)
    return { ...mock, dotNumber }
  }

  // Fetch carrier first so we can pass its raw data to authority as fallback
  const carrierRaw = await fmcsaGet(`/carriers/${dotNumber}`)
  const [carrier, authority, basics] = await Promise.all([
    Promise.resolve(normalizeCarrierResponse(carrierRaw)),
    fetchCarrierAuth(dotNumber, carrierRaw),
    fetchCarrierBasics(dotNumber),
  ])

  return { carrier, authority, basics, dotNumber }
}
