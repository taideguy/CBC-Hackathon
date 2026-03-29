import type { Verdict } from '@/types'
import { ShieldCheck, AlertTriangle, ShieldX, ChevronsRight } from 'lucide-react'

interface VerdictCardProps {
  verdict: Verdict
  title: string
  subtitle: string
  singleFlag?: boolean
}

const config = {
  clear: {
    borderColor: '#9ccaff',
    textColor:   '#9ccaff',
    bgColor:     'rgba(156, 202, 255, 0.05)',
    badgeBg:     'rgba(156, 202, 255, 0.15)',
    badgeBorder: 'rgba(156, 202, 255, 0.40)',
    badgeText:   '#9ccaff',
    badgeLabel:  'All Clear',
    badgeSubtext: null as string | null,
    Icon:        ShieldCheck,
    iconRgb:     '156,202,255',
  },
  warn: {
    borderColor: '#FF6B00',
    textColor:   '#FF6B00',
    bgColor:     'rgba(255, 107, 0, 0.05)',
    badgeBg:     '#FF6B00',
    badgeBorder: '#FF6B00',
    badgeText:   '#000000',
    badgeLabel:  'Risk Detected',
    badgeSubtext: null as string | null,
    Icon:        AlertTriangle,
    iconRgb:     '255,107,0',
  },
  danger: {
    borderColor: '#F74040',
    textColor:   '#F74040',
    bgColor:     'rgba(247, 64, 64, 0.05)',
    badgeBg:     '#F74040',
    badgeBorder: '#F74040',
    badgeText:   '#000000',
    badgeLabel:  'Do Not Use',
    badgeSubtext: null as string | null,
    Icon:        ShieldX,
    iconRgb:     '247,64,64',
  },
} as const

export default function VerdictCard({ verdict, title, subtitle, singleFlag }: VerdictCardProps) {
  // Single-flag warn: blue card, orange badge with subtext, blue proceed icon
  const isSingleWarn = verdict === 'warn' && singleFlag

  const c = isSingleWarn
    ? {
        borderColor:  '#9ccaff',
        textColor:    '#9ccaff',
        bgColor:      'rgba(156, 202, 255, 0.05)',
        badgeBg:      '#FF6B00',
        badgeBorder:  '#FF6B00',
        badgeText:    '#000000',
        badgeLabel:   'Verify Key Details',
        badgeSubtext: null as string | null,
        Icon:         ChevronsRight,
        iconRgb:      '156,202,255',
      }
    : { ...config[verdict], badgeSubtext: null }

  const { Icon } = c

  return (
    <div
      className="animate-verdict-in"
      style={{
        background: c.bgColor,
        border: `2px solid ${c.borderColor}`,
        borderRadius: '2px',
        padding: '24px',
      }}
      role="status"
      aria-label={`Verdict: ${title}`}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>

        {/* Left: headline + badge + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '34px',
            letterSpacing: '-0.01em',
            lineHeight: 1.0,
            textTransform: 'uppercase',
            color: c.textColor,
            marginBottom: '14px',
          }}>
            {title}
          </div>

          {/* Badge */}
          <div style={{ marginBottom: isSingleWarn ? 0 : '12px' }}>
            <span style={{
              display: 'inline-flex',
              flexDirection: c.badgeSubtext ? 'column' : 'row',
              alignItems: c.badgeSubtext ? 'flex-start' : 'center',
              gap: c.badgeSubtext ? '4px' : '6px',
              padding: '5px 11px',
              background: c.badgeBg,
              border: `1px solid ${c.badgeBorder}`,
              borderRadius: '2px',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {!c.badgeSubtext && <Icon size={12} color={c.badgeText} aria-hidden="true" />}
                {c.badgeSubtext && <AlertTriangle size={12} color={c.badgeText} aria-hidden="true" />}
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: c.badgeText,
                }}>
                  {c.badgeLabel}
                </span>
              </span>
              {c.badgeSubtext && (
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  color: c.badgeText,
                  opacity: 0.75,
                  textTransform: 'none',
                  letterSpacing: 0,
                }}>
                  {c.badgeSubtext}
                </span>
              )}
            </span>
          </div>

          {!isSingleWarn && (
            <div style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: '14px',
              color: c.textColor,
              opacity: 0.65,
            }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Right: icon box */}
        <div style={{
          width: '72px',
          height: '72px',
          flexShrink: 0,
          border: `3px solid ${c.borderColor}`,
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `rgba(${c.iconRgb}, 0.08)`,
        }} aria-hidden="true">
          <Icon size={36} color={c.textColor} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}
