// src/lib/scoring.ts
// Signal scoring and verdict derivation. Pure functions — no side effects.

import type {
  Signal,
  SignalId,
  Verdict,
  FMCSACarrierResponse,
  FMCSAAuthorityResponse,
  FMCSABasicsResponse,
  CarrierSnapshot,
  InspectionStats,
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
  changeVelocity: number,
  totalInspections: number
): Signal {
  const velocityBadge = changeVelocity >= 2
    ? `${changeVelocity} field${changeVelocity === 1 ? '' : 's'} changed in 30 days`
    : undefined

  if (!snapshot) {
    // Strong inspection history → neutral (well-inspected carrier, first lookup is informational)
    // Weak history on a carrier claiming significant operations → warn
    if (totalInspections >= 50) {
      return {
        id: 'ownership',
        label: 'Ownership',
        value: 'First lookup — no history',
        status: 'neutral',
        detail: `${totalInspections} inspections on record — add to watchlist to monitor`,
      }
    }
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

function scoreBasics(basics: FMCSABasicsResponse, totalInspections: number): Signal {
  if (!basics.content?.basics?.length) {
    if (totalInspections >= 100) {
      return {
        id: 'basics',
        label: 'BASIC scores',
        value: 'No data',
        status: 'neutral',
        detail: `${totalInspections} inspections — alert thresholds not triggered`,
      }
    }
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
// Inspection stats builder
// ---------------------------------------------------------------------------

export function buildInspectionStats(carrier: FMCSACarrierResponse): InspectionStats {
  const c = carrier.content[0].carrier
  const vehInsp = c.vehicleInspections ?? 0
  const vehOos = c.vehicleOosInspections ?? 0
  const drvInsp = c.driverInspections ?? 0
  const drvOos = c.driverOosInspections ?? 0

  return {
    totalInspections: vehInsp + drvInsp,
    vehicleOosRate: vehInsp > 0 ? Math.round((vehOos / vehInsp) * 1000) / 10 : null,
    driverOosRate: drvInsp > 0 ? Math.round((drvOos / drvInsp) * 1000) / 10 : null,
    mcs150FormDate: c.mcs150FormDate ?? null,
  }
}

// ---------------------------------------------------------------------------
// Signals 7–8 — Inspection activity, OOS rate
// Built from InspectionStats when available.
// ---------------------------------------------------------------------------

// National averages as of January 2026 — update monthly
const OOS_NATIONAL_AVG_VEHICLE = 22.26

function scoreInspectionActivity(
  inspectionStats: InspectionStats,
  powerUnits: number
): Signal {
  const total = inspectionStats.totalInspections

  if (total >= 500) {
    return {
      id: 'inspectionActivity',
      label: 'Inspections (24mo)',
      value: `${total} inspections`,
      status: 'ok',
      detail: 'Active carrier with strong inspection record',
    }
  }

  if (total >= 50) {
    return {
      id: 'inspectionActivity',
      label: 'Inspections (24mo)',
      value: `${total} inspections`,
      status: 'neutral',
      detail: 'Moderate inspection history',
    }
  }

  if (powerUnits > 5) {
    return {
      id: 'inspectionActivity',
      label: 'Inspections (24mo)',
      value: `${total} inspections`,
      status: 'warn',
      detail: `Low for a carrier reporting ${powerUnits} trucks`,
    }
  }

  // Small carrier (≤5 trucks) with few inspections — expected
  return {
    id: 'inspectionActivity',
    label: 'Inspections (24mo)',
    value: `${total} inspections`,
    status: 'neutral',
    detail: 'Small carrier — fewer inspections expected',
  }
}

function scoreOosRate(inspectionStats: InspectionStats): Signal {
  const rate = inspectionStats.vehicleOosRate

  if (rate === null) {
    return {
      id: 'oosRate',
      label: 'Vehicle OOS rate',
      value: 'No data',
      status: 'neutral',
      detail: 'No vehicle inspections on record',
    }
  }

  const rateStr = `${rate.toFixed(1)}% vs ${OOS_NATIONAL_AVG_VEHICLE}% avg`

  if (rate > OOS_NATIONAL_AVG_VEHICLE * 2) {
    return {
      id: 'oosRate',
      label: 'Vehicle OOS rate',
      value: rateStr,
      status: 'danger',
      detail: 'More than double the national average',
    }
  }

  if (rate > OOS_NATIONAL_AVG_VEHICLE) {
    return {
      id: 'oosRate',
      label: 'Vehicle OOS rate',
      value: rateStr,
      status: 'warn',
      detail: 'Above national average',
    }
  }

  return {
    id: 'oosRate',
    label: 'Vehicle OOS rate',
    value: rateStr,
    status: 'ok',
    detail: 'Below national average',
  }
}

// ---------------------------------------------------------------------------
// Verdict derivation
// ---------------------------------------------------------------------------

// Hard failures — never overridable by positive signals
const HARD_SIGNAL_IDS: SignalId[] = ['authority', 'insurance', 'outOfService', 'operatingClass']

export function deriveVerdict(signals: Signal[]): Verdict {
  const authorityRevoked = signals.find((s) => s.id === 'authority')?.status === 'danger'
  const insuranceLapsed = signals.find((s) => s.id === 'insurance')?.status === 'danger'
  const outOfServiceActive = signals.find((s) => s.id === 'outOfService')?.status === 'danger'
  const ownershipMultipleFields = signals.find((s) => s.id === 'ownership')?.status === 'danger'

  if (authorityRevoked || insuranceLapsed || outOfServiceActive || ownershipMultipleFields) {
    return 'danger'
  }

  // neutral signals are informational — they do not contribute to warn
  const warnSignals = signals.filter((s) => s.status === 'warn')
  if (warnSignals.length === 0) return 'clear'

  // Both inspection metric cards ok can offset a single non-hard warn
  // (e.g. safety "Not rated" alongside a clean inspection record → clear)
  if (warnSignals.length === 1 && !HARD_SIGNAL_IDS.includes(warnSignals[0].id)) {
    const metricOkCount = (['inspectionActivity', 'oosRate'] as SignalId[]).filter(
      (id) => signals.find((s) => s.id === id)?.status === 'ok'
    ).length
    if (metricOkCount >= 2) return 'clear'
  }

  return 'warn'
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
  inspectionStats?: InspectionStats | null
}

export function scoreSignals(input: ScoringInput): Signal[] {
  const c = input.carrier.content[0].carrier
  const powerUnits = c.totalPowerUnits
  const totalInspections = input.inspectionStats?.totalInspections ?? 0

  const currentData = {
    legalName: c.legalName,
    physicalAddress: `${c.phyState}`, // minimal for API-only path; bulk file enriches this
    phone: '', // FMCSA QCMobile doesn't return phone — enriched by bulk file in cron
  }

  const signals: Signal[] = [
    scoreAuthority(input.carrier, input.authority),
    scoreInsurance(input.carrier, input.snapshot?.insuranceCancellationDate ?? null),
    scoreSafety(input.carrier),
    scoreOwnership(input.snapshot, currentData, c.dotNumber, input.changeVelocity ?? 0, totalInspections),
    scoreOutOfService(input.carrier),
    scoreBasics(input.basics, totalInspections),
  ]

  // Add inspection metric signals when data is available
  if (input.inspectionStats) {
    signals.push(
      scoreInspectionActivity(input.inspectionStats, powerUnits),
      scoreOosRate(input.inspectionStats),
    )
  }

  return signals
}

// ---------------------------------------------------------------------------
// Cargo-fit check (also called client-side for dynamic updates)
// ---------------------------------------------------------------------------

export const COMMODITY_OPTIONS = [
  { value: '',             label: 'What are you shipping?' },
  // Column 1
  { value: 'general',      label: 'General Freight' },
  { value: 'household',    label: 'Household Goods' },
  { value: 'metal',        label: 'Metal: sheets, coils, rolls' },
  { value: 'motorVehicles',label: 'Motor Vehicles' },
  { value: 'driveTow',     label: 'Drive/Tow Away' },
  { value: 'logs',         label: 'Logs, Poles, Beams, Lumber' },
  { value: 'building',     label: 'Building Materials' },
  { value: 'mobileHomes',  label: 'Mobile Homes' },
  { value: 'machinery',    label: 'Machinery, Large Objects' },
  { value: 'freshProduce', label: 'Fresh Produce' },
  // Column 2
  { value: 'liquids',      label: 'Liquids/Gases' },
  { value: 'intermodal',   label: 'Intermodal Cont.' },
  { value: 'passengers',   label: 'Passengers' },
  { value: 'oilfield',     label: 'Oilfield Equipment' },
  { value: 'livestock',    label: 'Livestock' },
  { value: 'grain',        label: 'Grain, Feed, Hay' },
  { value: 'coal',         label: 'Coal/Coke' },
  { value: 'meat',         label: 'Meat' },
  { value: 'garbage',      label: 'Garbage/Refuse' },
  { value: 'usMail',       label: 'US Mail' },
  // Column 3
  { value: 'chemicals',    label: 'Chemicals' },
  { value: 'dryBulk',      label: 'Commodities Dry Bulk' },
  { value: 'refrigerated', label: 'Refrigerated Food' },
  { value: 'beverages',    label: 'Beverages' },
  { value: 'paper',        label: 'Paper Products' },
  { value: 'utilities',    label: 'Utilities' },
  { value: 'agricultural', label: 'Agricultural/Farm Supplies' },
  { value: 'construction', label: 'Construction' },
  { value: 'waterWell',    label: 'Water Well' },
  // Special regulatory categories
  { value: 'hazmat',       label: 'Hazardous Materials' },
] as const

// Maps commodity value → substrings to look for in carrier's cargoCarried array.
// Values come directly from FMCSA so matching is case-insensitive substring.
const CARGO_KEYWORDS: Record<string, string[]> = {
  general:      ['general freight'],
  household:    ['household goods'],
  metal:        ['metal', 'coil', 'steel'],
  motorVehicles:['motor vehicle'],
  driveTow:     ['drive/tow', 'drive tow', 'driveaway', 'towaway'],
  logs:         ['log', 'pole', 'beam', 'lumber'],
  building:     ['building material'],
  mobileHomes:  ['mobile home'],
  machinery:    ['machiner', 'large object'],
  freshProduce: ['fresh produce'],
  liquids:      ['liquid', '/gas', 'gases'],
  intermodal:   ['intermodal'],
  oilfield:     ['oilfield', 'oil field'],
  livestock:    ['livestock'],
  grain:        ['grain', 'feed', 'hay'],
  coal:         ['coal', 'coke'],
  meat:         ['meat'],
  garbage:      ['garbage', 'refuse'],
  usMail:       ['us mail', 'mail'],
  chemicals:    ['chemical'],
  dryBulk:      ['dry bulk'],
  refrigerated: ['refrigerat'],
  beverages:    ['beverage'],
  paper:        ['paper'],
  utilities:    ['utilit'],
  agricultural: ['agricultur', 'farm suppli'],
  construction: ['construction'],
  waterWell:    ['water well'],
  hazmat:       ['hazardous'],
  passengers:   ['passenger'],
}

export function scoreCargoFit(
  commodity: string,
  cargoCarried: string[],
  entityType: string
): Signal | null {
  if (!commodity) return null

  const cargoLower = cargoCarried.map((c) => c.toLowerCase())
  const hasGeneralFreight = cargoLower.some((c) => c.includes('general freight'))
  const commodityLabel = COMMODITY_OPTIONS.find((o) => o.value === commodity)?.label ?? commodity

  // Hazmat: danger if not registered, ok if registered
  if (commodity === 'hazmat') {
    const hmRegistered = cargoLower.some((c) => c.includes('hazardous'))
    if (hmRegistered) {
      return {
        id: 'cargoFit',
        label: 'Cargo fit',
        value: 'Registered',
        status: 'ok',
        detail: 'Authorized to transport hazardous materials',
      }
    }
    return {
      id: 'cargoFit',
      label: 'Cargo fit',
      value: 'Not registered for Hazardous Materials',
      status: 'danger',
      detail: 'Carrier not authorized to transport hazardous materials',
    }
  }

  // Passengers: danger if entity type doesn't authorize it, ok if it does
  if (commodity === 'passengers') {
    const isPassengerCarrier = entityType.toLowerCase().includes('passenger')
    if (isPassengerCarrier) {
      return {
        id: 'cargoFit',
        label: 'Cargo fit',
        value: 'Registered',
        status: 'ok',
        detail: 'Authorized passenger carrier',
      }
    }
    return {
      id: 'cargoFit',
      label: 'Cargo fit',
      value: 'Not a passenger carrier',
      status: 'danger',
      detail: 'Carrier entity type does not authorize passenger transport',
    }
  }

  // All other commodities
  if (cargoCarried.length === 0) return null  // no registration data — can't check

  const keywords = CARGO_KEYWORDS[commodity]
  if (!keywords) return null

  const matchFound = cargoLower.some((c) => keywords.some((k) => c.includes(k)))

  if (matchFound) {
    return {
      id: 'cargoFit',
      label: 'Cargo fit',
      value: 'Registered',
      status: 'ok',
      detail: `Authorized to carry ${commodityLabel}`,
    }
  }

  // Specific keyword not found — check if General Freight covers it
  // (not applicable when the user is shipping General Freight itself)
  if (hasGeneralFreight && commodity !== 'general') {
    return {
      id: 'cargoFit',
      label: 'Cargo fit',
      value: 'Registered',
      status: 'ok',
      detail: `${commodityLabel} covered under general freight authorization`,
    }
  }

  return {
    id: 'cargoFit',
    label: 'Cargo fit',
    value: `Not registered for ${commodityLabel}`,
    status: 'warn',
    detail: 'Commodity not listed in carrier registration',
  }
}

// ---------------------------------------------------------------------------
// Operating class check — private carrier without for-hire authority
// Runs regardless of commodity selection.
// ---------------------------------------------------------------------------

// Private-only classifications from FMCSA Operation Classification field
const PRIVATE_CLASS_PATTERNS = ['private(property)', 'priv. pass', 'private(passenger)']
// For-hire authority patterns — if any present alongside private, carrier is still valid
const FOR_HIRE_PATTERNS = ['auth. for hire', 'exempt for hire']

export function scoreOperatingClass(operatingClassification: string | null): Signal | null {
  if (!operatingClassification) return null

  const lower = operatingClassification.toLowerCase()

  const isPrivate = PRIVATE_CLASS_PATTERNS.some((p) => lower.includes(p))
  if (!isPrivate) return null

  const hasForHire = FOR_HIRE_PATTERNS.some((p) => lower.includes(p))
  if (hasForHire) return null  // Private + Auth. For Hire is valid and common

  return {
    id: 'operatingClass',
    label: 'Operating class',
    value: 'Private carrier',
    status: 'warn',
    detail: 'Not licensed for for-hire operations',
  }
}
