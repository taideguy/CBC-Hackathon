// src/lib/scoring.ts
// Signal scoring and verdict derivation. Pure functions — no side effects.

import type {
  Signal,
  Verdict,
  FMCSACarrierResponse,
  FMCSAAuthorityResponse,
  FMCSABasicsResponse,
  CarrierSnapshot,
} from '@/types'

// ---------------------------------------------------------------------------
// Signal 1 — Authority
// ---------------------------------------------------------------------------

function scoreAuthority(
  carrier: FMCSACarrierResponse,
  authority: FMCSAAuthorityResponse
): Signal {
  const c = carrier.content[0].carrier
  const operatingStatus = c.operatingStatus
  const allowedToOperate = c.allowedToOperate
  const commonAuth = authority.content.items[0]?.commonAuthorityStatus
  const contractAuth = authority.content.items[0]?.contractAuthorityStatus

  if (operatingStatus === 'REVOKED' || allowedToOperate === 'N') {
    return {
      id: 'authority',
      label: 'Authority',
      value: 'Revoked',
      status: 'danger',
      detail: 'Carrier cannot legally haul freight',
    }
  }

  if (operatingStatus === 'INACTIVE') {
    return {
      id: 'authority',
      label: 'Authority',
      value: 'Inactive',
      status: 'danger',
      detail: null,
    }
  }

  const authTypes: string[] = []
  if (commonAuth === 'ACTIVE') authTypes.push('Common')
  if (contractAuth === 'ACTIVE') authTypes.push('Contract')

  return {
    id: 'authority',
    label: 'Authority',
    value: authTypes.length > 0 ? `Active — ${authTypes.join(' & ')}` : 'Active',
    status: 'ok',
    detail: null,
  }
}

// ---------------------------------------------------------------------------
// Signal 2 — Insurance
// ---------------------------------------------------------------------------

function scoreInsurance(
  carrier: FMCSACarrierResponse,
  insuranceCancellationDate: string | null
): Signal {
  const c = carrier.content[0].carrier
  const bipd = c.bipdInsuranceOnFile
  const cargo = c.cargoInsuranceOnFile

  if (bipd === 0 && cargo === 0) {
    return {
      id: 'insurance',
      label: 'Insurance',
      value: 'Not on file',
      status: 'danger',
      detail: 'No insurance policy found with FMCSA',
      expandDetail: {
        rows: [
          { label: 'BIPD coverage', value: 'Missing' },
          { label: 'Cargo coverage', value: 'Missing' },
        ],
        actionText: 'Verify certificate of insurance before releasing freight.',
        actionColor: 'amber',
      },
    }
  }

  // Check cancellation date before returning ok/warn for coverage gaps
  if (insuranceCancellationDate) {
    const daysUntil = Math.ceil(
      (new Date(insuranceCancellationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysUntil <= 30) {
      const label = daysUntil <= 0
        ? 'Expired'
        : `Expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
      const status = daysUntil <= 7 ? 'danger' : 'warn'
      return {
        id: 'insurance',
        label: 'Insurance',
        value: label,
        status,
        detail: `Cancellation date: ${insuranceCancellationDate}`,
        expandDetail: {
          rows: [
            { label: 'BIPD coverage', value: bipd > 0 ? 'On file' : 'Missing' },
            { label: 'Cargo coverage', value: cargo > 0 ? 'On file' : 'Missing' },
            { label: 'Cancellation date', value: insuranceCancellationDate },
          ],
          actionText: 'Verify certificate of insurance before releasing freight.',
          actionColor: 'amber',
        },
      }
    }
  }

  if (bipd === 0 || cargo === 0) {
    return {
      id: 'insurance',
      label: 'Insurance',
      value: 'Partial coverage on file',
      status: 'warn',
      detail: bipd === 0 ? 'BIPD insurance missing' : 'Cargo insurance missing',
      expandDetail: {
        rows: bipd === 0
          ? [{ label: 'BIPD coverage', value: 'Missing' }, { label: 'Cargo coverage', value: 'On file' }]
          : [{ label: 'BIPD coverage', value: 'On file' }, { label: 'Cargo coverage', value: 'Missing' }],
        actionText: 'Verify certificate of insurance before releasing freight.',
        actionColor: 'amber',
      },
    }
  }

  return {
    id: 'insurance',
    label: 'Insurance',
    value: 'Current',
    status: 'ok',
    detail: 'BIPD and cargo insurance on file with FMCSA',
  }
}

// ---------------------------------------------------------------------------
// Signal 3 — Safety rating
// ---------------------------------------------------------------------------

function scoreSafety(carrier: FMCSACarrierResponse): Signal {
  const rating = carrier.content[0].carrier.safetyRating

  if (!rating || rating === '') {
    return {
      id: 'safety',
      label: 'Safety rating',
      value: 'Not rated',
      status: 'warn',
      detail: 'No FMCSA safety rating on file — common for newer carriers',
    }
  }

  const ratingUpper = rating.toUpperCase()

  if (ratingUpper === 'UNSATISFACTORY') {
    return {
      id: 'safety',
      label: 'Safety rating',
      value: 'Unsatisfactory',
      status: 'danger',
      detail: null,
    }
  }

  if (ratingUpper === 'CONDITIONAL') {
    return {
      id: 'safety',
      label: 'Safety rating',
      value: 'Conditional',
      status: 'warn',
      detail: null,
    }
  }

  return {
    id: 'safety',
    label: 'Safety rating',
    value: 'Satisfactory',
    status: 'ok',
    detail: null,
  }
}

// ---------------------------------------------------------------------------
// Signal 4 — Ownership change
// ---------------------------------------------------------------------------

function scoreOwnership(
  snapshot: CarrierSnapshot | null,
  currentData: { legalName: string; physicalAddress: string; phone: string },
  dotNumber: string,
  changeVelocity: number
): Signal {
  const velocityBadge = changeVelocity >= 2
    ? `${changeVelocity} field${changeVelocity === 1 ? '' : 's'} changed in 30 days`
    : undefined

  if (!snapshot) {
    return {
      id: 'ownership',
      label: 'Ownership',
      value: 'First lookup — no history',
      status: 'warn',
      detail: 'Add to watchlist to track future changes',
      expandDetail: {
        rows: [{ label: 'Baseline', value: 'No snapshot — first lookup' }],
        actionText: 'Call the number on SAFER directly. Do not use the number the driver gives you.',
        actionColor: 'red',
        saferDotNumber: dotNumber,
        velocityBadge,
      },
    }
  }

  const changedFields: string[] = []
  const changeRows: Array<{ label: string; value: string }> = []

  if (snapshot.legalName && currentData.legalName &&
      snapshot.legalName !== currentData.legalName) {
    changedFields.push('legal name')
    changeRows.push({ label: 'Legal name', value: `${snapshot.legalName} → ${currentData.legalName}` })
  }
  if (snapshot.phone && currentData.phone &&
      snapshot.phone !== currentData.phone) {
    changedFields.push('phone')
    changeRows.push({ label: 'Phone', value: `${snapshot.phone} → ${currentData.phone}` })
  }
  if (snapshot.physicalAddress && currentData.physicalAddress &&
      snapshot.physicalAddress !== currentData.physicalAddress) {
    changedFields.push('address')
    changeRows.push({ label: 'Address', value: `${snapshot.physicalAddress} → ${currentData.physicalAddress}` })
  }

  const daysSinceSnapshot = Math.floor(
    (Date.now() - new Date(snapshot.snapshotDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (changedFields.length >= 2) {
    return {
      id: 'ownership',
      label: 'Ownership',
      value: `Changed ~${daysSinceSnapshot} days ago`,
      status: 'danger',
      detail: `${changedFields.join(', ')} changed simultaneously`,
      expandDetail: {
        rows: [...changeRows, { label: 'Detected', value: `~${daysSinceSnapshot} days ago` }],
        actionText: 'Call the number on SAFER directly. Do not use the number the driver gives you.',
        actionColor: 'red',
        saferDotNumber: dotNumber,
        velocityBadge,
      },
    }
  }

  if (changedFields.length === 1) {
    return {
      id: 'ownership',
      label: 'Ownership',
      value: `${changedFields[0]} changed`,
      status: 'warn',
      detail: `Detected ~${daysSinceSnapshot} days ago`,
      expandDetail: {
        rows: [...changeRows, { label: 'Detected', value: `~${daysSinceSnapshot} days ago` }],
        actionText: 'Call the number on SAFER directly. Do not use the number the driver gives you.',
        actionColor: 'red',
        saferDotNumber: dotNumber,
        velocityBadge,
      },
    }
  }

  return {
    id: 'ownership',
    label: 'Ownership',
    value: `No changes (${daysSinceSnapshot} days monitored)`,
    status: 'ok',
    detail: null,
  }
}

// ---------------------------------------------------------------------------
// Signal 5 — Out of service
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function scoreOutOfService(carrier: FMCSACarrierResponse): Signal {
  const oosDate = carrier.content[0].carrier.outOfServiceDate

  if (oosDate) {
    return {
      id: 'outOfService',
      label: 'Out of service',
      value: 'Active order',
      status: 'danger',
      detail: `Order issued ${formatDate(oosDate)}`,
    }
  }

  return {
    id: 'outOfService',
    label: 'Out of service',
    value: 'None',
    status: 'ok',
    detail: null,
  }
}

// ---------------------------------------------------------------------------
// Signal 6 — BASIC scores
// ---------------------------------------------------------------------------

const BASIC_THRESHOLDS: Record<string, number> = {
  'Unsafe Driving': 65,
  'Hours-of-Service Compliance': 65,
  'Driver Fitness': 80,
  'Controlled Substances/Alcohol': 35,
  'Vehicle Maintenance': 65,
  'Hazardous Materials Compliance': 80,
}

function scoreBasics(basics: FMCSABasicsResponse): Signal {
  if (!basics.content?.basics?.length) {
    return {
      id: 'basics',
      label: 'BASIC scores',
      value: 'No data',
      status: 'warn',
      detail: 'Insufficient inspection history for SMS scoring',
    }
  }

  const flagged = basics.content.basics.filter((b) => {
    const threshold = BASIC_THRESHOLDS[b.basicType] ?? 65
    return b.percentile >= threshold && b.onRoadPerformance
  })

  if (flagged.length === 0) {
    return {
      id: 'basics',
      label: 'BASIC scores',
      value: 'All below threshold',
      status: 'ok',
      detail: null,
    }
  }

  const flaggedNames = flagged.map((b) => b.basicType).join(', ')

  return {
    id: 'basics',
    label: 'BASIC scores',
    value: `${flagged.length} ${flagged.length === 1 ? 'category' : 'categories'} flagged`,
    status: flagged.length >= 2 ? 'danger' : 'warn',
    detail: flaggedNames,
  }
}

// ---------------------------------------------------------------------------
// Verdict derivation
// ---------------------------------------------------------------------------

export function deriveVerdict(signals: Signal[]): Verdict {
  const authorityRevoked = signals.find((s) => s.id === 'authority')?.status === 'danger'
  const insuranceLapsed = signals.find((s) => s.id === 'insurance')?.status === 'danger'
  const outOfServiceActive = signals.find((s) => s.id === 'outOfService')?.status === 'danger'
  const ownershipMultipleFields = signals.find((s) => s.id === 'ownership')?.status === 'danger'

  if (authorityRevoked || insuranceLapsed || outOfServiceActive || ownershipMultipleFields) {
    return 'danger'
  }

  const hasAnyWarn = signals.some((s) => s.status === 'warn')
  if (hasAnyWarn) return 'warn'

  return 'clear'
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface ScoringInput {
  carrier: FMCSACarrierResponse
  authority: FMCSAAuthorityResponse
  basics: FMCSABasicsResponse
  snapshot: CarrierSnapshot | null
  changeVelocity?: number   // ownership events in last 30 days, from DB
}

export function scoreSignals(input: ScoringInput): Signal[] {
  const c = input.carrier.content[0].carrier
  const currentData = {
    legalName: c.legalName,
    physicalAddress: `${c.phyState}`, // minimal for API-only path; bulk file enriches this
    phone: '', // FMCSA QCMobile doesn't return phone — enriched by bulk file in cron
  }

  return [
    scoreAuthority(input.carrier, input.authority),
    scoreInsurance(input.carrier, input.snapshot?.insuranceCancellationDate ?? null),
    scoreSafety(input.carrier),
    scoreOwnership(input.snapshot, currentData, c.dotNumber, input.changeVelocity ?? 0),
    scoreOutOfService(input.carrier),
    scoreBasics(input.basics),
  ]
}

// ---------------------------------------------------------------------------
// Cargo-fit check (also called client-side for dynamic updates)
// ---------------------------------------------------------------------------

export const COMMODITY_OPTIONS = [
  { value: '',              label: 'What are you shipping?' },
  { value: 'general',       label: 'General freight' },
  { value: 'refrigerated',  label: 'Refrigerated food' },
  { value: 'hazmat',        label: 'Hazardous materials' },
  { value: 'household',     label: 'Household goods' },
  { value: 'livestock',     label: 'Livestock' },
  { value: 'metal',         label: 'Metal / steel' },
  { value: 'chemicals',     label: 'Chemicals' },
  { value: 'passengers',    label: 'Passengers' },
] as const

const CARGO_KEYWORDS: Record<string, string[]> = {
  refrigerated: ['refrigerat', 'fresh produce'],
  hazmat:       ['hazardous'],
  household:    ['household'],
  livestock:    ['livestock'],
  metal:        ['metal', 'steel', 'coil'],
  chemicals:    ['chemical'],
  passengers:   ['passenger'],
  general:      ['general freight'],
}

export function scoreCargoFit(
  commodity: string,
  cargoCarried: string[],
  entityType: string
): Signal | null {
  if (!commodity) return null

  const cargoLower = cargoCarried.map((c) => c.toLowerCase())
  const hasGeneralFreight = cargoLower.some((c) => c.includes('general freight'))

  // Hazmat: flag only when carrier is not registered for hazardous materials
  if (commodity === 'hazmat') {
    const hmRegistered = cargoLower.some((c) => c.includes('hazardous'))
    if (hmRegistered) return null
    return {
      id: 'cargoFit',
      label: 'Cargo fit',
      value: 'Not registered for Hazardous materials',
      status: 'danger',
      detail: 'Carrier not authorized to transport hazardous materials',
    }
  }

  // Passengers: flag only when entity type is not a passenger carrier
  if (commodity === 'passengers') {
    const isPassengerCarrier = entityType.toLowerCase().includes('passenger')
    if (isPassengerCarrier) return null
    return {
      id: 'cargoFit',
      label: 'Cargo fit',
      value: 'Not a passenger carrier',
      status: 'danger',
      detail: 'Carrier entity type does not authorize passenger transport',
    }
  }

  // All other commodities: only flag when cargoCarried has specific entries
  // that contradict the selection AND does not contain "General Freight"
  if (cargoCarried.length === 0) return null   // no data to contradict
  if (hasGeneralFreight) return null            // general freight is a catch-all

  const keywords = CARGO_KEYWORDS[commodity]
  if (!keywords) return null

  const matchFound = cargoLower.some((c) => keywords.some((k) => c.includes(k)))
  if (matchFound) return null  // carrier is registered for this commodity

  const label = COMMODITY_OPTIONS.find((o) => o.value === commodity)?.label ?? commodity

  return {
    id: 'cargoFit',
    label: 'Cargo fit',
    value: `Not registered for ${label}`,
    status: 'warn',
    detail: 'Commodity not listed in carrier registration',
  }
}
