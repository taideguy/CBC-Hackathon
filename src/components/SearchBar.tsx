'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import type { CarrierResult } from '@/types'

interface SearchBarProps {
  onResult: (result: CarrierResult) => void
  onLoading: (loading: boolean) => void
  defaultValue?: string
  autoRun?: boolean
  commodity?: string
}

export default function SearchBar({ onResult, onLoading, defaultValue, autoRun, commodity }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoRun && defaultValue) {
      handleLookup(defaultValue)
    } else {
      inputRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLookup(query: string) {
    const q = query.trim()
    if (!q) {
      setError('Enter a DOT number, MC number, or carrier name')
      return
    }

    setError(null)
    onLoading(true)

    try {
      const res = await fetch('/api/carrier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, commodity: commodity ?? '' }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        onLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      let buffer = ''
      let result: Omit<CarrierResult, 'summary'> | null = null
      let summary = ''
      let firstChunkParsed = false

      onLoading(false)

      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break

        buffer += decoder.decode(chunk, { stream: true })

        if (!firstChunkParsed) {
          const newlineIdx = buffer.indexOf('\n')
          if (newlineIdx !== -1) {
            const jsonPart = buffer.slice(0, newlineIdx)
            buffer = buffer.slice(newlineIdx + 1)
            firstChunkParsed = true

            try {
              result = JSON.parse(jsonPart)
            } catch {
              setError('Unexpected response format')
              return
            }

            if (result) {
              onResult({ ...result, summary: '' })
            }
          }
        }

        if (firstChunkParsed && buffer) {
          summary += buffer
          buffer = ''
          if (result) {
            onResult({ ...result, summary })
          }
        }
      }

      if (result) {
        saveRecentLookup(result.carrier.dotNumber, result.carrier.legalName, result.verdict)
      }
    } catch (err) {
      console.error('Lookup error:', err)
      setError('FMCSA is unreachable — try again')
      onLoading(false)
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleLookup(value)
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Brutalist segmented search bar */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        border: '2px solid var(--border)',
        background: 'var(--surface-2)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        {/* Search icon */}
        <div style={{
          paddingLeft: '14px',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--text-3)',
          flexShrink: 0,
        }}>
          <Search size={17} aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          type="search"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="DOT# OR CARRIER NAME"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{
            flex: 1,
            height: '52px',
            padding: '0 12px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: '13px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        />

        {/* Run Check button */}
        <button
          onClick={() => handleLookup(value)}
          aria-label="Search carrier"
          style={{
            height: '52px',
            padding: '0 20px',
            background: 'var(--primary)',
            border: 'none',
            borderLeft: '2px solid var(--border)',
            color: '#000000',
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#ffffff')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'var(--primary)')}
        >
          Run Check
        </button>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            marginTop: '8px',
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--danger)',
            textTransform: 'uppercase',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent lookups — stored in localStorage
// ---------------------------------------------------------------------------

export interface RecentLookup {
  dotNumber: string
  legalName: string
  verdict: 'clear' | 'warn' | 'danger'
  lookedUpAt: string
}

function saveRecentLookup(dotNumber: string, legalName: string, verdict: 'clear' | 'warn' | 'danger') {
  try {
    const raw = localStorage.getItem('dockcheck_recent') ?? '[]'
    const existing: RecentLookup[] = JSON.parse(raw)
    const filtered = existing.filter((r) => r.dotNumber !== dotNumber)
    const updated = [{ dotNumber, legalName, verdict, lookedUpAt: new Date().toISOString() }, ...filtered].slice(0, 5)
    localStorage.setItem('dockcheck_recent', JSON.stringify(updated))
  } catch {
    // localStorage may not be available
  }
}
