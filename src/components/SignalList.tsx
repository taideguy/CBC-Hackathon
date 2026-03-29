'use client'

import { useState } from 'react'
import type { Signal, SignalId } from '@/types'
import { Shield, Lock, ClipboardCheck, Users, Ban, BarChart3, Package, Scale, Activity, Gauge, ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'

interface SignalListProps {
  signals: Signal[]
}

const SIGNAL_ICONS: Record<SignalId, LucideIcon> = {
  authority:          Shield,
  insurance:          Lock,
  safety:             ClipboardCheck,
  ownership:          Users,
  outOfService:       Ban,
  basics:             BarChart3,
  cargoFit:           Package,
  operatingClass:     Scale,
  inspectionActivity: Activity,
  oosRate:            Gauge,
}

const STATUS_CONFIG = {
  ok: {
    // Blue — secure state
    borderColor:  '#333333',
    iconColor:    '#9ccaff',
    badgeBg:      'transparent',
    badgeBorder:  'rgba(156, 202, 255, 0.35)',
    badgeText:    '#9ccaff',
    badgeLabel:   'Secure',
    labelColor:   '#57534e',
    valueColor:   '#e5e2e1',
    detailColor:  '#78716c',
  },
  neutral: {
    // Gray — informational, not scored
    borderColor:  '#333333',
    iconColor:    '#78716c',
    badgeBg:      'transparent',
    badgeBorder:  'rgba(120, 113, 108, 0.35)',
    badgeText:    '#78716c',
    badgeLabel:   'Info',
    labelColor:   '#57534e',
    valueColor:   '#a8a29e',
    detailColor:  '#78716c',
  },
  warn: {
    // White frame, orange highlight on title — warn state
    borderColor:  '#e5e2e1',
    iconColor:    '#FF6B00',
    badgeBg:      '#FF6B00',
    badgeBorder:  '#FF6B00',
    badgeText:    '#000000',
    badgeLabel:   'Alert',
    labelColor:   '#78716c',
    valueColor:   '#FF6B00',
    detailColor:  '#a8a29e',
  },
  danger: {
    // Red — critical state
    borderColor:  '#F74040',
    iconColor:    '#F74040',
    badgeBg:      '#F74040',
    badgeBorder:  '#F74040',
    badgeText:    '#000000',
    badgeLabel:   'Critical',
    labelColor:   '#78716c',
    valueColor:   '#F74040',
    detailColor:  '#a8a29e',
  },
} as const

const EXPANDABLE_IDS: SignalId[] = ['insurance', 'ownership']

export default function SignalList({ signals }: SignalListProps) {
  const [expandedId, setExpandedId] = useState<SignalId | null>(null)

  function toggle(id: SignalId) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
    }}>
      {signals.map((signal) => {
        const sc = STATUS_CONFIG[signal.status]
        const Icon = SIGNAL_ICONS[signal.id]
        const isTappable = EXPANDABLE_IDS.includes(signal.id) &&
          (signal.status === 'warn' || signal.status === 'danger') &&
          signal.expandDetail != null
        const isExpanded = expandedId === signal.id

        return (
          <div
            key={signal.id}
            className="signal-tile"
            onClick={isTappable ? () => toggle(signal.id) : undefined}
            style={{
              background: 'var(--surface)',
              border: `2px solid ${sc.borderColor}`,
              borderRadius: '2px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              cursor: isTappable ? 'pointer' : 'default',
              transition: 'background 0.15s ease',
            }}
          >
            {/* Icon + badge row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Icon size={20} color={sc.iconColor} strokeWidth={2} aria-hidden="true" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  background: sc.badgeBg,
                  border: `1px solid ${sc.badgeBorder}`,
                  borderRadius: '2px',
                  fontSize: '9px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: sc.badgeText,
                  lineHeight: '14px',
                }}>
                  {sc.badgeLabel}
                </span>
                {isTappable && (
                  isExpanded
                    ? <ChevronUp size={14} color={sc.iconColor} aria-hidden="true" />
                    : <ChevronDown size={14} color={sc.iconColor} aria-hidden="true" />
                )}
              </div>
            </div>

            {/* Label + value */}
            <div>
              <p style={{
                fontSize: '11px',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: sc.labelColor,
                marginBottom: '5px',
              }}>
                {signal.label}
              </p>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '15px',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: sc.valueColor,
                lineHeight: 1.2,
              }}>
                {signal.value}
              </p>
              {signal.detail && (
                <p style={{
                  marginTop: '6px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  color: sc.detailColor,
                  lineHeight: 1.45,
                }}>
                  {signal.detail}
                </p>
              )}
            </div>

            {/* Expanded detail rows */}
            {isExpanded && signal.expandDetail && (
              <div style={{
                borderTop: `1px solid ${sc.borderColor}`,
                paddingTop: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                {signal.expandDetail.rows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: sc.labelColor,
                      flexShrink: 0,
                    }}>
                      {row.label}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      color: sc.detailColor,
                      textAlign: 'right',
                      lineHeight: 1.4,
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}

                {/* Velocity badge */}
                {signal.expandDetail.velocityBadge && (
                  <div style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    background: 'rgba(255, 107, 0, 0.12)',
                    border: '1px solid rgba(255, 107, 0, 0.35)',
                    borderRadius: '2px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#FF6B00',
                  }}>
                    {signal.expandDetail.velocityBadge}
                  </div>
                )}

                {/* Action text */}
                <p style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  color: signal.expandDetail.actionColor === 'amber' ? '#FF6B00' : '#F74040',
                  lineHeight: 1.5,
                }}>
                  {signal.expandDetail.actionText}
                  {signal.expandDetail.saferDotNumber && (
                    <>
                      {' '}
                      <a
                        href={`https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${signal.expandDetail.saferDotNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: 'inherit',
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                        }}
                      >
                        Open SAFER
                      </a>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
