// src/lib/claude.ts
// All Claude API calls live here. No Anthropic SDK calls anywhere else.

import Anthropic from '@anthropic-ai/sdk'
import type { Carrier, Signal, Verdict } from '@/types'

const SYSTEM_PROMPT = `You are a carrier risk analyst for a freight verification tool used by shipping managers at small and mid-size manufacturers. Your job is to write a plain-English risk assessment based on carrier safety data.

Rules:
- Write 2 to 4 sentences. No more.
- Lead with the most important finding.
- Be direct. No hedging language like "may indicate" or "could suggest."
- Do not use bullet points or headers.
- Do not repeat information the user can already see in the signal list.
- If the verdict is "danger," end with a specific action the user should take.
- If the verdict is "clear," end with a brief positive confirmation.
- Write for a shipping manager who is not a compliance expert. Avoid jargon.
- Never say "I" or refer to yourself.
- Never say "based on the data" or "according to our analysis."`

function buildUserPrompt(carrier: Carrier, signals: Signal[], verdict: Verdict): string {
  const flaggedSignals = signals.filter((s) => s.status !== 'ok')
  const allClear = flaggedSignals.length === 0

  return `
Carrier: ${carrier.legalName}
DOT: ${carrier.dotNumber}
State: ${carrier.state}
Fleet size: ${carrier.powerUnits} trucks
Verdict: ${verdict}

Signal results:
${signals.map((s) => `- ${s.label}: ${s.value} [${s.status}]${s.detail ? ` — ${s.detail}` : ''}`).join('\n')}

${
  allClear
    ? 'All signals passed. Write a clear, confident 2-sentence confirmation.'
    : `Flagged signals: ${flaggedSignals.map((s) => s.label).join(', ')}. Write a 2-4 sentence risk assessment leading with the most critical flag.`
}
`.trim()
}

// ---------------------------------------------------------------------------
// Development mock
// ---------------------------------------------------------------------------

function getMockSummary(verdict: Verdict): string {
  if (verdict === 'clear') {
    return 'Authority and insurance are current with no gaps in coverage. No ownership changes detected and all BASIC scores below threshold — this carrier has a stable, clean compliance record. Safe to load.'
  }
  if (verdict === 'warn') {
    return 'Ownership transferred recently with simultaneous name and phone changes — the most common pattern in carrier identity fraud. Authority is active and insurance is on file, but verify the certificate independently and call the SAFER phone number directly before releasing freight.'
  }
  return 'Authority revoked — this carrier cannot legally haul freight. Insurance lapsed at the same time as the ownership transfer, and an active out-of-service order is on file. Do not load. Report this at nccdb.fmcsa.dot.gov.'
}

// ---------------------------------------------------------------------------
// Production: non-streaming (used as fallback)
// ---------------------------------------------------------------------------

export async function generateSummary(
  carrier: Carrier,
  signals: Signal[],
  verdict: Verdict
): Promise<string> {
  if (process.env.NODE_ENV === 'development' && process.env.USE_REAL_API !== 'true') {
    return getMockSummary(verdict)
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userPrompt = buildUserPrompt(carrier, signals, verdict)

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type from Claude')
    return content.text.trim()
  } catch (err) {
    console.error('Claude API error:', err)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Production: streaming version — for the API route
// ---------------------------------------------------------------------------

export async function generateSummaryStream(
  carrier: Carrier,
  signals: Signal[],
  verdict: Verdict
): Promise<ReadableStream<Uint8Array>> {
  if (process.env.NODE_ENV === 'development' && process.env.USE_REAL_API !== 'true') {
    const summary = getMockSummary(verdict)
    const encoder = new TextEncoder()
    // Simulate streaming by chunking by word
    return new ReadableStream({
      start(controller) {
        const words = summary.split(' ')
        let i = 0
        const interval = setInterval(() => {
          if (i < words.length) {
            controller.enqueue(encoder.encode((i === 0 ? '' : ' ') + words[i]))
            i++
          } else {
            clearInterval(interval)
            controller.close()
          }
        }, 40)
      },
    })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userPrompt = buildUserPrompt(carrier, signals, verdict)

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (err) {
        console.error('Claude stream error:', err)
        controller.error(err)
      } finally {
        controller.close()
      }
    },
  })
}
