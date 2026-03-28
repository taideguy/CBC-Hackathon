interface RiskSummaryProps {
  summary: string
  streaming?: boolean
}

export default function RiskSummary({ summary, streaming }: RiskSummaryProps) {
  if (!summary) return null

  return (
    <div style={{
      background: 'var(--surface)',
      border: '2px solid var(--border)',
      borderRadius: '2px',
      padding: '20px',
    }}>
      <p style={{
        fontSize: '10px',
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.28em',
        color: 'var(--text-3)',
        marginBottom: '14px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border)',
      }}>
        Operational Assessment
      </p>

      <p
        style={{
          fontSize: '15px',
          lineHeight: 1.7,
          color: '#c4bfbe',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
        }}
        aria-live="polite"
      >
        {summary}
        {streaming && (
          <span
            style={{
              display: 'inline-block',
              width: '2px',
              height: '15px',
              background: 'var(--primary)',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'blink 1.2s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
        )}
      </p>
    </div>
  )
}
