'use client'

import { useSwipeable } from 'react-swipeable'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { WatchlistItem as WatchlistItemType } from '@/types'

interface WatchlistItemProps {
  item: WatchlistItemType
  onTap: () => void
  onDelete: () => void
}

const verdictConfig = {
  clear:  { label: 'Clear',       color: '#9ccaff',  borderColor: 'rgba(156,202,255,0.30)' },
  warn:   { label: 'Verify',      color: '#FF6B00',  borderColor: 'rgba(255,107,0,0.35)' },
  danger: { label: 'Do not load', color: '#F74040',  borderColor: 'rgba(247,64,64,0.35)' },
  null:   { label: 'Not checked', color: '#57534e',  borderColor: '#333333' },
} as const

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours === 1) return '1h ago'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function WatchlistItem({ item, onTap, onDelete }: WatchlistItemProps) {
  const [swiped, setSwiped] = useState(false)

  const handlers = useSwipeable({
    onSwipedLeft: () => setSwiped(true),
    onSwipedRight: () => setSwiped(false),
    trackMouse: false,
  })

  const verdictKey = item.lastVerdict ?? 'null'
  const vc = verdictConfig[verdictKey as keyof typeof verdictConfig] ?? verdictConfig.null

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Delete button revealed on swipe */}
      <div style={{
        position: 'absolute',
        right: 0, top: 0,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        transform: swiped ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s ease',
      }}>
        <button
          onClick={onDelete}
          aria-label={`Remove ${item.carrierName} from watchlist`}
          style={{
            height: '100%',
            padding: '0 20px',
            background: 'var(--danger)',
            border: 'none',
            color: 'white',
            fontSize: '10px',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderRadius: '0 2px 2px 0',
          }}
        >
          Remove
        </button>
      </div>

      {/* Main card */}
      <div
        {...handlers}
        onClick={() => { if (!swiped) onTap() }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!swiped) onTap()
          }
        }}
        aria-label={`${item.carrierName}, DOT ${item.dotNumber}. Tap to run fresh lookup.`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '14px',
          background: 'var(--surface)',
          border: '2px solid var(--border)',
          borderRadius: '2px',
          transform: swiped ? 'translateX(-84px)' : 'translateX(0)',
          transition: 'transform 0.2s ease',
          cursor: 'pointer',
        }}
      >
        {/* Verdict left bar */}
        <div style={{
          width: '3px',
          height: '42px',
          borderRadius: '2px',
          background: vc.color,
          flexShrink: 0,
        }} aria-hidden="true" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--text)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.carrierName}
            </span>
            {item.ownershipAlert && (
              <span
                aria-label="Unread ownership alert"
                style={{
                  flexShrink: 0,
                  width: 7, height: 7,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  animation: 'danger-pulse 2s ease-out infinite',
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 400,
              fontSize: '10px',
              color: 'var(--text-3)',
              letterSpacing: '0.04em',
            }}>
              DOT {item.dotNumber}
            </span>
            {item.lastChecked && (
              <>
                <span style={{ color: 'var(--border-2)', fontSize: '10px' }}>·</span>
                <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                  {formatRelativeTime(item.lastChecked)}
                </span>
              </>
            )}
          </div>

          <div style={{ marginTop: '5px' }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              background: 'transparent',
              border: `1px solid ${vc.borderColor}`,
              borderRadius: '2px',
              fontSize: '8px',
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: vc.color,
            }}>
              {vc.label}
            </span>
          </div>
        </div>

        <ChevronRight size={16} color="var(--text-3)" aria-hidden="true" />
      </div>
    </div>
  )
}
