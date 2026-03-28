import { ShieldCheck, Eye } from 'lucide-react'

interface BottomNavProps {
  activeTab: 'verify' | 'watchlist'
  onTabChange: (tab: 'verify' | 'watchlist') => void
  hasUnreadAlerts: boolean
}

const TABS = [
  { id: 'verify'    as const, Icon: ShieldCheck, label: 'Verify' },
  { id: 'watchlist' as const, Icon: Eye,         label: 'Watchlist' },
]

export default function BottomNav({ activeTab, onTabChange, hasUnreadAlerts }: BottomNavProps) {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: '72px',
        background: 'var(--surface)',
        borderTop: '2px solid var(--border)',
        display: 'flex',
        zIndex: 50,
      }}
    >
      {TABS.map((tab, i) => {
        const isActive = activeTab === tab.id
        const showDot = tab.id === 'watchlist' && hasUnreadAlerts

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: isActive ? 'var(--primary)' : 'transparent',
              border: 'none',
              borderLeft: i > 0 ? '2px solid var(--border)' : 'none',
              cursor: 'pointer',
              position: 'relative',
              outline: 'none',
              transition: 'background 0.15s ease',
              minWidth: 0,
              padding: '0 8px',
            }}
          >
            <span style={{ position: 'relative' }}>
              <tab.Icon
                size={26}
                color={isActive ? '#000000' : 'var(--text-2)'}
                strokeWidth={isActive ? 2.5 : 1.75}
                aria-hidden="true"
                style={{ display: 'block', transition: 'color 0.15s ease' }}
              />
              {showDot && (
                <span
                  aria-label="Unread alerts"
                  style={{
                    position: 'absolute',
                    top: -2, right: -4,
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: 'var(--danger)',
                    border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--surface)'}`,
                    animation: 'danger-pulse 2s ease-out infinite',
                  }}
                />
              )}
            </span>

            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: isActive ? '#000000' : 'var(--text-2)',
              transition: 'color 0.15s ease',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
