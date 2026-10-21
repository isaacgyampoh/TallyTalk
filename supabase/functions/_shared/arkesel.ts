/**
 * Talking to Arkesel, in one place.
 *
 * Both things this app texts — a sign-in code and an invitation — go through
 * here, so the hard-won lessons apply to both:
 *
 *  * Arkesel answers HTTP 200 even when it refuses a message, putting the real
 *    outcome in the body. A status check alone reports undelivered texts as
 *    sent.
 *  * Accepted is not sent. An unapproved sender ID is taken with a cheerful
 *    200 and then held at "PENDING APPROVAL" forever. Only the message-status
 *    endpoint tells the truth, and only a moment later.
 *  * A sender ID over 11 characters is rejected, and so is an unset one.
 */

const ARKESEL_SMS_URL = 'https://sms.arkesel.com/api/v2/sms/send'
const ARKESEL_STATUS_URL = 'https://sms.arkesel.com/api/v2/sms'

/** Statuses that mean the message is on its way, or has arrived. */
const IN_FLIGHT = new Set(['DELIVERED', 'SENT', 'PENDING', 'QUEUED', 'SUBMITTED'])

export interface ArkeselConfig {
  apiKey: string
  senderId: string
}

export function readArkeselConfig(): ArkeselConfig {
  return {
    apiKey: Deno.env.get('ARKESEL_API_KEY') ?? '',
    senderId: (Deno.env.get('ARKESEL_SENDER_ID') ?? '').trim(),
  }
}

/** Why this configuration cannot send, or null if it can. */
export function configProblem(config: ArkeselConfig): string | null {
  if (!config.apiKey) return 'ARKESEL_API_KEY is not set'
  if (!config.senderId) return 'ARKESEL_SENDER_ID is not set'
  if (config.senderId.length > 11) {
    return `ARKESEL_SENDER_ID is ${config.senderId.length} characters; Arkesel allows at most 11`
  }
  return null
}

export interface SendResult {
  /** Arkesel took the message. Not the same as delivered — see confirmSent. */
  accepted: boolean
  /** Its id, when it took it, for the follow-up check. */
  id: string | null
  /** The provider's own words, for a log or a recorded failure. */
  detail: string
  status: number
}

/** Arkesel wants a recipient as digits with no leading "+". */
export function toRecipient(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function sendSms(
  config: ArkeselConfig,
  phone: string,
  message: string,
): Promise<SendResult> {
  const res = await fetch(ARKESEL_SMS_URL, {
    method: 'POST',
    headers: { 'api-key': config.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: config.senderId,
      message,
      recipients: [toRecipient(phone)],
    }),
  })

  const detail = await res.text()
  let accepted = res.ok
  let id: string | null = null
  if (accepted) {
    try {
      const body = JSON.parse(detail) as { status?: string; data?: { id?: string }[] }
      accepted = body.status === 'success'
      id = body.data?.[0]?.id ?? null
    } catch {
      accepted = false
    }
  }
  return { accepted, id, detail, status: res.status }
}

/**
 * Ask what became of a message Arkesel accepted.
 *
 * Returns a human explanation when it is not on its way, or null when it is.
 * Call it in the background: it waits for the provider to settle, and nothing
 * a user is waiting on should.
 */
export async function confirmSent(
  config: ArkeselConfig,
  id: string,
  waitMs = 5000,
): Promise<string | null> {
  try {
    await new Promise((resolve) => setTimeout(resolve, waitMs))
    const res = await fetch(`${ARKESEL_STATUS_URL}/${id}`, {
      headers: { 'api-key': config.apiKey },
    })
    if (!res.ok) return null
    const status = (await res.json())?.data?.status as string | undefined
    if (!status || IN_FLIGHT.has(status.toUpperCase())) return null
    return (
      `arkesel accepted the message but its status is "${status}" — with sender ` +
      `"${config.senderId}". PENDING APPROVAL means that sender ID is not approved ` +
      `on the account, so nothing is delivered.`
    )
  } catch {
    return null
  }
}

/** Keep background work alive after the response has gone back. */
export function inBackground(work: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime
  runtime?.waitUntil?.(work)
}
