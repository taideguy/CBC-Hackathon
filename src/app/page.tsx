'use client'

import { useState, useEffect } from 'react'
import {
  Terminal, Truck, Eye, CheckCircle, AlertTriangle, XCircle,
  Shield, Lock, ClipboardCheck, Users, Ban, BarChart3,
} from 'lucide-react'
import SearchBar, { type RecentLookup } from '@/components/SearchBar'
import VerdictCard from '@/components/VerdictCard'
import SignalList from '@/components/SignalList'
import RiskSummary from '@/components/RiskSummary'
import WatchlistItemComponent from '@/components/WatchlistItem'
import BottomNav from '@/components/BottomNav'
import type { CarrierResult, WatchlistItem, Verdict, FleetProfile, Signal, OwnershipEvent } from '@/types'
import { scoreCargoFit, scoreOperatingClass, COMMODITY_OPTIONS } from '@/lib/scoring'

// ---------------------------------------------------------------------------
// User ID — persisted in localStorage
// ---------------------------------------------------------------------------

function getUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('dockcheck_user_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('dockcheck_user_id', id)
  }
  return id
}

// ---------------------------------------------------------------------------
// Verdict helpers
// ---------------------------------------------------------------------------

function getVerdictContent(result: CarrierResult): { title: string; subtitle: string } {
  const total = result.signals.length
  const flags = result.signals.filter((s) => s.status === 'warn' || s.status === 'danger').length

  if (result.verdict === 'danger') return { title: 'Do not load', subtitle: `${flags} flag${flags > 1 ? 's' : ''} detected` }
  if (result.verdict === 'warn') {
    if (flags === 1) return { title: 'Likely fine, proceed', subtitle: 'verify key details' }
    return { title: 'Verify before loading', subtitle: `${flags} flags detected` }
  }
  return { title: 'Clear to load', subtitle: `${total} / ${total} signals pass` }
}

// ---------------------------------------------------------------------------
// Scanning loader
// ---------------------------------------------------------------------------

const SIGNAL_META = [
  { label: 'Authority',     Icon: Shield },
  { label: 'Insurance',     Icon: Lock },
  { label: 'Safety Rating', Icon: ClipboardCheck },
  { label: 'Ownership',     Icon: Users },
  { label: 'Out of Service',Icon: Ban },
  { label: 'BASIC Scores',  Icon: BarChart3 },
]

function ScanningLoader() {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      i++
      setVisibleCount(i)
      if (i >= SIGNAL_META.length) clearInterval(interval)
    }, 260)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ padding: '20px 0' }} aria-live="polite" aria-label="Checking 6 sources">
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1, height: '2px', background: 'var(--border)', overflow: 'hidden' }}>
          <div className="scan-bar" />
        </div>
        <span style={{
          fontSize: '10px',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: 'var(--text-3)',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          Scanning FMCSA
        </span>
        <div style={{ position: 'relative', flex: 1, height: '2px', background: 'var(--border)', overflow: 'hidden' }}>
          <div className="scan-bar" style={{ animationDelay: '0.8s' }} />
        </div>
      </div>

      {/* Signal tiles — 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {SIGNAL_META.map(({ label, Icon }, i) => {
          const visible = i < visibleCount
          return (
            <div
              key={label}
              style={{
                background: 'var(--surface)',
                border: '2px solid var(--border)',
                borderRadius: '2px',
                padding: '14px',
                opacity: visible ? 1 : 0.2,
                transition: 'opacity 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Icon size={18} color={visible ? 'var(--text-2)' : 'var(--text-3)'} aria-hidden="true" />
                {visible && (
                  <span style={{
                    width: '6px', height: '6px',
                    borderRadius: '50%',
                    background: 'var(--text-3)',
                    animation: 'blink 0.8s ease-in-out infinite',
                  }} />
                )}
              </div>
              <div>
                <p style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  color: 'var(--text-3)',
                  marginBottom: '4px',
                }}>
                  {label}
                </p>
                <p style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  color: visible ? 'var(--text-2)' : 'var(--border)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {visible ? 'Checking...' : '—'}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fleet profile strip
// ---------------------------------------------------------------------------

const TruckSVG = () => (
  <svg viewBox="0 0 48 24" width="48" height="24" fill="currentColor" aria-hidden="true">
    <rect x="2" y="8" width="20" height="12" rx="2"/>
    <rect x="22" y="4" width="24" height="16" rx="2"/>
    <rect x="24" y="14" width="6" height="6" rx="1" fill="var(--bg)"/>
    <circle cx="8" cy="21" r="3"/>
    <circle cx="32" cy="21" r="3"/>
    <circle cx="40" cy="21" r="3"/>
  </svg>
)

function FleetProfileStrip({ powerUnits, fleetProfile }: { powerUnits: number; fleetProfile: FleetProfile | null }) {
  const iconCount = Math.min(powerUnits, 5)
  const overflow = powerUnits > 5 ? powerUnits - 5 : 0

  return (
    <div style={{
      background: 'var(--surface)',
      border: '2px solid var(--border)',
      borderRadius: '2px',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
    }}>
      {/* Truck icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--tertiary)', flexShrink: 0 }}>
        {Array.from({ length: iconCount }).map((_, i) => (
          <TruckSVG key={i} />
        ))}
        {overflow > 0 && (
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'var(--text-3)',
            letterSpacing: '0.06em',
            marginLeft: '2px',
          }}>
            +{overflow}
          </span>
        )}
      </div>

      {/* Stat chips */}
      {fleetProfile && (fleetProfile.avgModelYear || fleetProfile.topMakes.length > 0) && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {fleetProfile.avgModelYear && (
            <span style={{
              padding: '3px 8px',
              background: 'var(--surface-3)',
              border: '1px solid var(--border-2)',
              borderRadius: '2px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              color: 'var(--text-2)',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}>
              Avg {fleetProfile.avgModelYear}
            </span>
          )}
          {fleetProfile.topMakes.length > 0 && (
            <span style={{
              padding: '3px 8px',
              background: 'var(--surface-3)',
              border: '1px solid var(--border-2)',
              borderRadius: '2px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              color: 'var(--text-2)',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}>
              {fleetProfile.topMakes.join(' · ')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------

export default function Home() {
  const [activeTab, setActiveTab] = useState<'verify' | 'watchlist'>('verify')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CarrierResult | null>(null)
  const [recentLookups, setRecentLookups] = useState<RecentLookup[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [undoItem, setUndoItem] = useState<WatchlistItem | null>(null)
  const [prefillDot, setPrefillDot] = useState<string | undefined>(undefined)
  const [alertPhone, setAlertPhone] = useState('')
  const [alertEmail, setAlertEmail] = useState('')
  const [alertSaved, setAlertSaved] = useState(false)
  const [userId, setUserId] = useState('')
  const [selectedCommodity, setSelectedCommodity] = useState('')
  const [fleetExpanded, setFleetExpanded] = useState(false)
  const [ownershipHistory, setOwnershipHistory] = useState<OwnershipEvent[] | null>(null)
  const [ownershipLoading, setOwnershipLoading] = useState(false)

  useEffect(() => {
    const id = getUserId()
    setUserId(id)
    try {
      const raw = localStorage.getItem('dockcheck_recent') ?? '[]'
      setRecentLookups(JSON.parse(raw))
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem('dockcheck_watchlist') ?? '[]'
      setWatchlist(JSON.parse(raw))
    } catch { /* ignore */ }
    setAlertPhone(localStorage.getItem('dockcheck_alert_phone') ?? '')
    setAlertEmail(localStorage.getItem('dockcheck_alert_email') ?? '')
  }, [])

  const hasUnreadAlerts = watchlist.some((w) => w.ownershipAlert)

  function persistWatchlist(items: WatchlistItem[]) {
    setWatchlist(items)
    try {
      localStorage.setItem('dockcheck_watchlist', JSON.stringify(items))
    } catch { /* ignore */ }
  }

  function addToWatchlist() {
    if (!result) return
    if (watchlist.some((w) => w.dotNumber === result.carrier.dotNumber)) return
    const newItem: WatchlistItem = {
      id: crypto.randomUUID(),
      dotNumber: result.carrier.dotNumber,
      carrierName: result.carrier.legalName,
      mcNumber: result.carrier.mcNumber,
      lastVerdict: result.verdict,
      lastChecked: result.checkedAt,
      alertPhone: alertPhone || null,
      alertEmail: alertEmail || null,
      ownershipAlert: false,
      addedAt: new Date().toISOString(),
    }
    persistWatchlist([newItem, ...watchlist])
  }

  function deleteFromWatchlist(item: WatchlistItem) {
    persistWatchlist(watchlist.filter((w) => w.id !== item.id))
    setUndoItem(item)
    setTimeout(() => setUndoItem((prev) => (prev?.id === item.id ? null : prev)), 4000)
  }

  function undoDelete() {
    if (!undoItem) return
    persistWatchlist([undoItem, ...watchlist])
    setUndoItem(null)
  }

  function handleWatchlistTap(dot: string) {
    setActiveTab('verify')
    setResult(null)
    setPrefillDot(dot)
  }

  function saveAlertPrefs() {
    localStorage.setItem('dockcheck_alert_phone', alertPhone)
    localStorage.setItem('dockcheck_alert_email', alertEmail)
    setAlertSaved(true)
    setTimeout(() => setAlertSaved(false), 2000)
  }

  const isOnWatchlist = result
    ? watchlist.some((w) => w.dotNumber === result.carrier.dotNumber)
    : false

  async function loadOwnershipHistory() {
    if (!result) return
    setOwnershipLoading(true)
    try {
      const res = await fetch(`/api/ownership?dot=${result.carrier.dotNumber}`)
      const data = await res.json()
      setOwnershipHistory(data.events ?? [])
    } catch {
      setOwnershipHistory([])
    } finally {
      setOwnershipLoading(false)
    }
  }

  function formatOwnershipEvent(event: OwnershipEvent): string {
    const date = new Date(event.detectedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    const fieldLabels: Record<string, string> = {
      legalName: 'Legal name',
      phone: 'Phone',
      address: 'Address',
      ein: 'EIN',
    }
    const field = fieldLabels[event.fieldChanged] ?? event.fieldChanged
    const old = event.oldValue ?? '—'
    const next = event.newValue ?? '—'
    return `${date} — ${field}: ${old} → ${next}`
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border)',
        zIndex: 40,
      }}>
        <div style={{
          maxWidth: 480, margin: '0 auto',
          padding: '0 16px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M0 4H4.43381L10.4338 14H16V12H11.5662L5.56619 2H0V4Z" fill="var(--primary)"/>
              <path d="M10 4H16V2H10V4Z" fill="var(--primary)"/>
            </svg>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '20px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--primary)',
            }}>
              DockCheck
            </span>
          </div>

          {hasUnreadAlerts && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--danger)',
                animation: 'danger-pulse 2s ease-out infinite',
                display: 'block',
              }} aria-label="Unread ownership alerts" />
              <span style={{
                fontSize: '9px',
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                color: 'var(--danger)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                Alert
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────── */}
      <main style={{
        maxWidth: 480, margin: '0 auto',
        padding: '0 16px',
        paddingTop: '72px',
        paddingBottom: '88px',
      }}>

        {/* ── Verify Tab ──────────────────────────────────────── */}
        {activeTab === 'verify' && (
          <div>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Commodity dropdown */}
              <select
                value={selectedCommodity}
                onChange={(e) => setSelectedCommodity(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 12px',
                  background: 'var(--surface-2)',
                  border: '2px solid var(--border)',
                  borderRadius: '2px',
                  color: selectedCommodity ? 'var(--text)' : 'var(--text-3)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '32px',
                }}
              >
                {COMMODITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: '#1c1c1c', color: '#e5e2e1' }}>
                    {o.label}
                  </option>
                ))}
              </select>

              <SearchBar
                onResult={(r) => {
                  setFleetExpanded(false)
                  setOwnershipHistory(null)
                  setResult(r)
                  // Update verdict + lastChecked for this carrier if it's on the watchlist
                  setWatchlist((prev) => {
                    const updated = prev.map((w) =>
                      w.dotNumber === r.carrier.dotNumber
                        ? { ...w, lastVerdict: r.verdict, lastChecked: r.checkedAt }
                        : w
                    )
                    try { localStorage.setItem('dockcheck_watchlist', JSON.stringify(updated)) } catch { /* ignore */ }
                    return updated
                  })
                }}
                onLoading={setLoading}
                defaultValue={prefillDot}
                autoRun={!!prefillDot}
                key={prefillDot}
                commodity={selectedCommodity}
              />
            </div>

            {loading && <ScanningLoader />}

            {!loading && result && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* Verdict hero */}
                <VerdictCard
                  verdict={result.verdict}
                  title={getVerdictContent(result).title}
                  subtitle={getVerdictContent(result).subtitle}
                  singleFlag={result.verdict === 'warn' && result.signals.filter((s) => s.status === 'warn' || s.status === 'danger').length === 1}
                />

                {/* Carrier summary */}
                <Section delay={60}>
                  <div style={{
                    background: 'var(--surface)',
                    border: '2px solid var(--border)',
                    borderRadius: '2px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 900,
                        fontSize: '22px',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        color: 'var(--text)',
                        lineHeight: 1.15,
                      }}>
                        {result.carrier.legalName}
                      </h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {[
                          `DOT: ${result.carrier.dotNumber}`,
                          result.carrier.mcNumber ?? null,
                          `State: ${result.carrier.state}`,
                          `${result.carrier.powerUnits} Trucks`,
                          result.carrier.operatingClassification ?? null,
                        ].filter(Boolean).map((tag) => (
                          <span key={tag} style={{
                            padding: '4px 10px',
                            background: 'var(--surface-3)',
                            border: '1px solid var(--border-2)',
                            borderRadius: '2px',
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'var(--text)',
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Cargo carried pills */}
                      {result.carrier.cargoCarried && result.carrier.cargoCarried.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {result.carrier.cargoCarried.slice(0, 4).map((cargo) => (
                            <span key={cargo} style={{
                              padding: '3px 8px',
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontFamily: 'var(--font-body)',
                              fontWeight: 500,
                              color: 'var(--text-2)',
                            }}>
                              {cargo}
                            </span>
                          ))}
                          {result.carrier.cargoCarried.length > 4 && (
                            <span style={{
                              padding: '3px 8px',
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              borderRadius: '2px',
                              fontSize: '11px',
                              fontFamily: 'var(--font-body)',
                              fontWeight: 500,
                              color: 'var(--text-3)',
                            }}>
                              +{result.carrier.cargoCarried.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setFleetExpanded((v) => !v)}
                      aria-label={fleetExpanded ? 'Hide fleet details' : 'Show fleet details'}
                      style={{
                        width: '48px', height: '48px',
                        background: fleetExpanded ? 'var(--primary)' : 'var(--surface-3)',
                        border: `2px solid ${fleetExpanded ? 'var(--primary)' : 'var(--border-2)'}`,
                        borderRadius: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <Truck size={24} color={fleetExpanded ? '#000' : 'var(--text-2)'} aria-hidden="true" />
                    </button>
                  </div>
                </Section>

                {/* Fleet profile strip — shown when truck icon is toggled */}
                {fleetExpanded && (
                  <Section delay={0}>
                    <FleetProfileStrip
                      powerUnits={result.carrier.powerUnits}
                      fleetProfile={result.fleetProfile ?? null}
                    />
                  </Section>
                )}

                {/* Signal grid — two labeled sections */}
                <Section delay={100}>
                  {(() => {
                    const baseSignals = result.signals.filter(
                      (s) => s.id !== 'cargoFit' && s.id !== 'operatingClass'
                    )
                    const cargoFitSignal = scoreCargoFit(
                      selectedCommodity,
                      result.carrier.cargoCarried ?? [],
                      result.carrier.entityType
                    )
                    const operatingClassSignal = scoreOperatingClass(
                      result.carrier.operatingClassification
                    )
                    const all = [
                      ...baseSignals,
                      ...(cargoFitSignal ? [cargoFitSignal] : []),
                      ...(operatingClassSignal ? [operatingClassSignal] : []),
                    ]

                    const SECTION1_ORDER: import('@/types').SignalId[] = [
                      'cargoFit', 'ownership', 'inspectionActivity', 'operatingClass',
                    ]
                    const SECTION2_ORDER: import('@/types').SignalId[] = [
                      'authority', 'insurance', 'safety', 'outOfService', 'basics', 'oosRate',
                    ]

                    const section1 = all
                      .filter((s) => SECTION1_ORDER.includes(s.id as import('@/types').SignalId))
                      .sort((a, b) => SECTION1_ORDER.indexOf(a.id as import('@/types').SignalId) - SECTION1_ORDER.indexOf(b.id as import('@/types').SignalId))
                    const section2 = all
                      .filter((s) => SECTION2_ORDER.includes(s.id as import('@/types').SignalId))
                      .sort((a, b) => SECTION2_ORDER.indexOf(a.id as import('@/types').SignalId) - SECTION2_ORDER.indexOf(b.id as import('@/types').SignalId))

                    const sectionLabelStyle: React.CSSProperties = {
                      fontSize: '10px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.28em',
                      color: 'var(--text-3)',
                      marginBottom: '8px',
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <p style={sectionLabelStyle}>Identity &amp; Fraud Risk</p>
                          <SignalList signals={section1} />
                        </div>
                        <div>
                          <p style={sectionLabelStyle}>Operational Legitimacy</p>
                          <SignalList signals={section2} />
                        </div>
                      </div>
                    )
                  })()}
                </Section>

                {/* Risk summary */}
                {result.summary && (
                  <Section delay={140}>
                    <RiskSummary summary={result.summary} streaming={loading} />
                  </Section>
                )}

                {/* FMCSA raw record link */}
                <a
                  href={`https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${result.carrier.dotNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--text-3)',
                    textDecoration: 'none',
                    textUnderlineOffset: '3px',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                >
                  View raw FMCSA record →
                </a>

                {/* Add to watchlist */}
                <Section delay={180}>
                  {!isOnWatchlist ? (
                    <button
                      onClick={addToWatchlist}
                      style={{
                        width: '100%',
                        height: '52px',
                        background: 'var(--primary)',
                        border: '2px solid var(--primary)',
                        borderRadius: '2px',
                        color: '#000000',
                        fontSize: '13px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 900,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#ffffff'
                        e.currentTarget.style.borderColor = '#ffffff'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'var(--primary)'
                        e.currentTarget.style.borderColor = 'var(--primary)'
                      }}
                    >
                      <Eye size={17} aria-hidden="true" />
                      Add to Watchlist
                    </button>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      border: '2px solid rgba(156,202,255,0.25)',
                      borderRadius: '2px',
                    }}>
                      <CheckCircle size={16} color="var(--tertiary)" aria-hidden="true" />
                      <span style={{
                        fontSize: '13px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 900,
                        color: 'var(--tertiary)',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                      }}>
                        On Watchlist
                      </span>
                    </div>
                  )}
                </Section>

                {/* View ownership history */}
                {result.hadPriorSnapshot && (
                  <Section delay={210}>
                    <button
                      onClick={ownershipHistory === null ? loadOwnershipHistory : () => setOwnershipHistory(null)}
                      style={{
                        width: '100%',
                        height: '48px',
                        background: 'transparent',
                        border: '2px solid var(--border)',
                        borderRadius: '2px',
                        color: 'var(--text-2)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease, color 0.15s ease',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-2)'
                        e.currentTarget.style.color = 'var(--text)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.color = 'var(--text-2)'
                      }}
                    >
                      {ownershipLoading
                        ? 'Loading...'
                        : ownershipHistory !== null
                        ? 'Hide Ownership History'
                        : 'View Ownership History'}
                    </button>

                    {ownershipHistory !== null && (
                      <div style={{
                        marginTop: '8px',
                        background: 'var(--surface)',
                        border: '2px solid var(--border)',
                        borderRadius: '2px',
                        padding: '16px',
                      }}>
                        {ownershipHistory.length === 0 ? (
                          <p style={{
                            fontSize: '13px',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 500,
                            color: 'var(--text-3)',
                            lineHeight: 1.6,
                          }}>
                            No history yet — add to watchlist to start tracking.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {ownershipHistory.map((event) => (
                              <p key={event.id} style={{
                                fontSize: '13px',
                                fontFamily: 'var(--font-body)',
                                fontWeight: 500,
                                color: 'var(--text-2)',
                                lineHeight: 1.5,
                                borderBottom: '1px solid var(--border)',
                                paddingBottom: '10px',
                              }}>
                                {formatOwnershipEvent(event)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Section>
                )}
                {/* Scan next DOT */}
                <Section delay={240}>
                  <button
                    onClick={() => { setResult(null); setPrefillDot(undefined) }}
                    style={{
                      width: '100%',
                      height: '48px',
                      background: 'transparent',
                      border: '2px solid #9ccaff',
                      borderRadius: '2px',
                      color: '#9ccaff',
                      fontSize: '12px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(156,202,255,0.08)')}
                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    Scan Next DOT
                  </button>
                </Section>
              </div>
            )}

            {/* Empty state */}
            {!loading && !result && (
              <div style={{ marginTop: '28px' }}>
                {recentLookups.length > 0 ? (
                  <>
                    <p style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--text-2)',
                      marginBottom: '12px',
                    }}>
                      Recent
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {recentLookups.map((r) => {
                        const color = r.verdict === 'clear' ? 'var(--tertiary)' : r.verdict === 'warn' ? 'var(--primary)' : 'var(--danger)'
                        const RecentIcon = r.verdict === 'clear' ? CheckCircle : r.verdict === 'warn' ? AlertTriangle : XCircle
                        return (
                          <button
                            key={r.dotNumber}
                            onClick={() => handleWatchlistTap(r.dotNumber)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px',
                              background: 'var(--surface)',
                              border: '2px solid var(--border)',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              gap: '12px',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{
                                fontSize: '15px',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 700,
                                color: 'var(--text)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {r.legalName}
                              </span>
                              <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 400,
                                fontSize: '12px',
                                color: 'var(--text-2)',
                                letterSpacing: '0.04em',
                                marginTop: '3px',
                                display: 'block',
                              }}>
                                DOT {r.dotNumber}
                              </span>
                            </div>
                            <RecentIcon size={20} color={color} aria-hidden="true" />
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <Truck size={44} color="var(--border)" style={{ margin: '0 auto 14px' }} aria-hidden="true" />
                    <p style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '13px',
                      letterSpacing: '0.10em',
                      color: 'var(--text-3)',
                      textTransform: 'uppercase',
                    }}>
                      Enter a DOT or MC number above
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Watchlist Tab ─────────────────────────────────── */}
        {activeTab === 'watchlist' && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: '9px',
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                letterSpacing: '0.2em',
                color: 'var(--text-3)',
                textTransform: 'uppercase',
              }}>
                {watchlist.length === 0 ? 'No carriers' : `${watchlist.length} carrier${watchlist.length !== 1 ? 's' : ''} monitored`}
              </span>
              <span style={{
                fontSize: '9px',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--text-3)',
                textTransform: 'uppercase',
              }}>
                Overnight diff active
              </span>
            </div>

            {/* Ownership alert banners */}
            {watchlist.filter((w) => w.ownershipAlert).map((w) => (
              <div key={w.id} style={{
                background: 'var(--danger-bg)',
                border: '2px solid var(--danger-bdr)',
                borderRadius: '2px',
                padding: '14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}>
                <AlertTriangle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <div>
                  <p style={{
                    fontSize: '13px',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--danger)',
                    lineHeight: 1.3,
                    letterSpacing: '0.03em',
                  }}>
                    {w.carrierName} — ownership changed
                  </p>
                  <p style={{
                    marginTop: '4px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    color: 'var(--danger)',
                    opacity: 0.7,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    Verify before next load
                  </p>
                </div>
              </div>
            ))}

            {/* Carrier list */}
            {watchlist.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {watchlist.map((item) => (
                  <WatchlistItemComponent
                    key={item.id}
                    item={item}
                    onTap={() => handleWatchlistTap(item.dotNumber)}
                    onDelete={() => deleteFromWatchlist(item)}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                background: 'var(--surface)',
                border: '2px solid var(--border)',
                borderRadius: '2px',
                padding: '32px 16px',
                textAlign: 'center',
              }}>
                <p style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--text-3)',
                  letterSpacing: '0.1em',
                  lineHeight: 1.8,
                  textTransform: 'uppercase',
                }}>
                  No carriers monitored.<br />
                  Run a lookup and add to watchlist.
                </p>
              </div>
            )}

            {/* Alert settings */}
            <div style={{
              background: 'var(--surface)',
              border: '2px solid var(--border)',
              borderRadius: '2px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}>
              <p style={{
                fontSize: '9px',
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                letterSpacing: '0.2em',
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                paddingBottom: '10px',
                borderBottom: '1px solid var(--border)',
              }}>
                Alert Settings
              </p>

              <div>
                <p style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  marginBottom: '10px',
                }}>
                  Alert me when:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['Authority changes', 'Insurance lapses', 'Ownership transfers'].map((label) => (
                    <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked className="dc-checkbox" readOnly />
                      <span style={{ fontSize: '13px', fontFamily: 'var(--font-body)', fontWeight: 500, color: 'var(--text-2)' }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border)' }} />

              <div>
                <p style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  marginBottom: '10px',
                }}>
                  Alerts go to:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { type: 'tel',   placeholder: 'Phone number',  value: alertPhone, onChange: setAlertPhone },
                    { type: 'email', placeholder: 'Email address', value: alertEmail, onChange: setAlertEmail },
                  ].map(({ type, placeholder, value, onChange }) => (
                    <input
                      key={type}
                      type={type}
                      placeholder={placeholder}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      style={{
                        width: '100%',
                        height: '44px',
                        padding: '0 12px',
                        background: 'var(--surface-2)',
                        border: '2px solid var(--border)',
                        borderRadius: '2px',
                        color: 'var(--text)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        outline: 'none',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = 'var(--primary)' }}
                      onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={saveAlertPrefs}
                style={{
                  width: '100%',
                  height: '46px',
                  background: alertSaved ? 'transparent' : 'var(--primary)',
                  border: alertSaved ? '2px solid var(--clear-bdr)' : '2px solid var(--primary)',
                  borderRadius: '2px',
                  color: alertSaved ? 'var(--tertiary)' : '#000000',
                  fontSize: '11px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                }}
              >
                {alertSaved ? '✓  Saved' : 'Save Preferences'}
              </button>
            </div>

            <p style={{
              textAlign: 'center',
              fontSize: '10px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color: 'var(--text-3)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Your watchlist is saved to this device.
            </p>
          </div>
        )}
      </main>

      {/* ── Bottom nav ─────────────────────────────────────────── */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasUnreadAlerts={hasUnreadAlerts}
      />

      {/* ── Undo toast ─────────────────────────────────────────── */}
      {undoItem && (
        <div style={{
          position: 'fixed',
          bottom: '84px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface-3)',
          border: '2px solid var(--border-2)',
          borderRadius: '2px',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          zIndex: 60,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            Removed.
          </span>
          <button
            onClick={undoDelete}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '11px',
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
