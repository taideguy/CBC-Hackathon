import type { Verdict } from '@/types'
import { ShieldCheck, AlertTriangle, ShieldX } from 'lucide-react'

interface VerdictCardProps {
  verdict: Verdict
  title: string
  subtitle: string
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
    Icon:        ShieldX,
    iconRgb:     '247,64,64',
  },
} as const

export default function VerdictCard({ verdict, title, subtitle }: VerdictCardProps) {
  const c = config[verdict]
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
          <div style={{ marginBottom: '12px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 11px',
              background: c.badgeBg,
              border: `1px solid ${c.badgeBorder}`,
              borderRadius: '2px',
            }}>
              <Icon size={12} color={c.badgeText} aria-hidden="true" />
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
          </div>

          <div style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: '14px',
            color: c.textColor,
            opacity: 0.65,
          }}>
            {subtitle}
          </div>
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
