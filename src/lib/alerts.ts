// src/lib/alerts.ts
// Twilio (SMS) and Resend (email) wrappers.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dockcheck.app'

// ---------------------------------------------------------------------------
// SMS via Twilio
// ---------------------------------------------------------------------------

export async function sendSMSAlert(
  to: string,
  carrierName: string,
  dotNumber: string,
  fieldChanged: string
): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] SMS to ${to}: DockCheck alert: ${carrierName} (DOT ${dotNumber}) — ${fieldChanged} updated.`)
    return
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    console.warn('Twilio not configured — skipping SMS alert')
    return
  }

  const body = `DockCheck alert: ${carrierName} (DOT ${dotNumber}) — ownership changed. ${fieldChanged} updated. Verify before next load. ${APP_URL}`

  try {
    const credentials = Buffer.from(`${sid}:${token}`).toString('base64')
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Twilio error:', text)
    }
  } catch (err) {
    console.error('sendSMSAlert error:', err)
  }
}

// ---------------------------------------------------------------------------
// Email via Resend
// ---------------------------------------------------------------------------

export async function sendEmailAlert(
  to: string,
  carrierName: string,
  dotNumber: string,
  fieldChanged: string,
  oldValue: string | null,
  newValue: string | null,
  detectedAt: string
): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Email to ${to}: DockCheck ownership alert for ${carrierName}`)
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Resend not configured — skipping email alert')
    return
  }

  const subject = `DockCheck: ${carrierName} ownership alert`
  const text = `A carrier on your watchlist has changed.

Carrier: ${carrierName}
DOT: ${dotNumber}
Change detected: ${fieldChanged}
Previous value: ${oldValue ?? 'unknown'}
New value: ${newValue ?? 'unknown'}
Detected: ${detectedAt}

This pattern — especially when multiple fields change simultaneously — is associated with carrier identity fraud.

Verify this carrier before your next load: ${APP_URL}/verify?dot=${dotNumber}

To stop alerts, visit your watchlist settings: ${APP_URL}/watchlist`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DockCheck <alerts@dockcheck.app>',
        to,
        subject,
        text,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      console.error('Resend error:', data)
    }
  } catch (err) {
    console.error('sendEmailAlert error:', err)
  }
}
