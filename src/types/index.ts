// src/types/index.ts
// Source of truth for all shared TypeScript types.
// Import from here everywhere — do not redefine these inline.

export type Verdict = 'clear' | 'warn' | 'danger'

export type SignalId =
  | 'authority'
  | 'insurance'
  | 'safety'
  | 'ownership'
  | 'outOfService'
  | 'basics'
  | 'cargoFit'
  | 'operatingClass'
  | 'inspectionActivity'
  | 'oosRate'

export type SignalStatus = 'ok' | 'neutral' | 'warn' | 'danger'

export interface SignalExpandDetail {
  rows: Array<{ label: string; value: string }>
  actionText: string
  actionColor: 'amber' | 'red'
  saferDotNumber?: string
  velocityBadge?: string   // "N fields changed in 30 days" — shown in ownership expanded state
}

export interface Signal {
  id: SignalId
  label: string
  value: string
  status: SignalStatus
  detail: string | null
  expandDetail?: SignalExpandDetail
}

export interface FleetProfile {
  dotNumber: string
  topMakes: string[]
  avgModelYear: number | null
  unitCount: number
  lastUpdated: string
}

export interface InspectionStats {
  totalInspections: number
  vehicleOosRate: number | null   // percentage 0–100, e.g. 8.5
  driverOosRate: number | null    // percentage 0–100
  mcs150FormDate: string | null   // ISO date string from FMCSA
}

export interface Carrier {
  dotNumber: string
  mcNumber: string | null
  legalName: string
  dbaName: string | null
  state: string
  powerUnits: number
  drivers: number
  entityType: 'CARRIER' | 'BROKER' | 'FREIGHT FORWARDER' | string
  operatingStatus: 'ACTIVE' | 'INACTIVE' | 'REVOKED' | string
  operatingClassification: string | null
  cargoCarried: string[]
}

export interface CarrierResult {
  carrier: Carrier
  verdict: Verdict
  signals: Signal[]
  summary: string
  cached: boolean
  checkedAt: string
  fleetProfile?: FleetProfile | null
  hadPriorSnapshot: boolean
  inspectionStats?: InspectionStats | null
}

export interface WatchlistItem {
  id: string
  dotNumber: string
  carrierName: string
  mcNumber: string | null
  lastVerdict: Verdict | null
  lastChecked: string | null
  alertPhone: string | null
  alertEmail: string | null
  ownershipAlert: boolean
  addedAt: string
}

export interface OwnershipEvent {
  id: string
  dotNumber: string
  detectedAt: string
  fieldChanged: 'legalName' | 'phone' | 'address' | 'ein'
  oldValue: string | null
  newValue: string | null
  alerted: boolean
}

export interface CarrierSnapshot {
  dotNumber: string
  snapshotDate: string
  legalName: string | null
  physicalAddress: string | null
  phone: string | null
  ein: string | null
  insuranceCancellationDate: string | null  // ISO date string, from InsHist bulk file
}

// FMCSA raw API response shapes

export interface FMCSACarrierResponse {
  content: {
    carrier: {
      dotNumber: string
      legalName: string
      dbaName: string | null
      allowedToOperate: 'Y' | 'N'
      bipdInsuranceOnFile: number   // 0 = no, 1 = yes
      cargoInsuranceOnFile: number  // 0 = no, 1 = yes
      safetyRating: string | null
      safetyRatingDate: string | null
      outOfServiceDate: string | null
      totalPowerUnits: number
      totalDrivers: number
      phyState: string
      entityType: string
      operatingStatus: string
      operatingClassification: string | null
      cargoCarried: string[]
      // 24-month inspection data
      vehicleInspections: number | null
      vehicleOosInspections: number | null
      driverInspections: number | null
      driverOosInspections: number | null
      mcs150FormDate: string | null
    }
  }[]
}

export interface FMCSAAuthorityResponse {
  content: {
    items: {
      commonAuthorityStatus: string
      contractAuthorityStatus: string
      brokerAuthorityStatus: string
    }[]
  }
}

export interface FMCSABasicsResponse {
  content: {
    basics: {
      basicType: string
      measure: number
      percentile: number
      onRoadPerformance: boolean
    }[]
  }
}

// API route request/response shapes

export interface CarrierLookupRequest {
  query: string
  commodity?: string
}

export interface CarrierLookupResponse {
  carrier?: CarrierResult
  error?: string
  code?: 'NOT_FOUND' | 'FMCSA_ERROR' | 'RATE_LIMIT' | 'INVALID_QUERY'
}

export interface AddWatchlistRequest {
  dotNumber: string
  carrierName: string
  mcNumber?: string
  alertPhone?: string
  alertEmail?: string
}

export interface AddWatchlistResponse {
  id?: string
  error?: string
}

export interface CronDiffResponse {
  processed: number
  changesDetected: number
  alertsSent: number
  durationMs: number
}
