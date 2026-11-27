import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { db } from './db'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

export const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store' },
})

export async function respond(handler: () => Promise<unknown>) {
  try {
    return json(await handler())
  } catch (error) {
    if (error instanceof ApiError) return json({ code: error.code, message: error.message }, error.status)
    console.error('Scanova request failed', (error as { code?: string })?.code || 'internal_error')
    return json({ code: 'service_unavailable', message: 'Scanova is temporarily unavailable. Please try again.' }, 503)
  }
}

export async function body(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'invalid_body', 'Send a JSON request.')
  }
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    if (!reader) throw new Error()
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.length
      if (size > 16_384) {
        await reader.cancel()
        throw new ApiError(413, 'body_too_large', 'The request is too large.')
      }
      chunks.push(chunk.value)
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    return data as Record<string, unknown>
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(400, 'invalid_body', 'Send a valid JSON object.')
  }
}

export function text(value: unknown, min: number, max: number) {
  if (typeof value !== 'string') throw new ApiError(400, 'invalid_input', 'Check the required fields.')
  const cleaned = value.trim()
  if (cleaned.length < min || cleaned.length > max) {
    throw new ApiError(400, 'invalid_input', 'Check the length of the required fields.')
  }
  return cleaned
}

export function uuid(value: unknown) {
  const id = text(value, 36, 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(400, 'invalid_id', 'This reference is invalid.')
  }
  return id
}

export const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export function browserMutation(request: Request) {
  const origin = request.headers.get('origin')
  const site = new URL(process.env.APP_URL || process.env.FIGMA_PUBLIC_URL || request.url)
  if (process.env.NODE_ENV === 'production' && site.protocol !== 'https:') {
    throw new ApiError(503, 'https_required', 'Scanova requires a secure HTTPS address.')
  }
  if (origin !== site.origin) throw new ApiError(403, 'invalid_origin', 'This request came from an unrecognized site.')
}

export function automationRequest(request: Request) {
  const secret = process.env.N8N_WEBHOOK_SECRET
  const provided = request.headers.get('x-scanova-secret') || ''
  if (!secret || !timingSafeEqual(Buffer.from(hash(provided)), Buffer.from(hash(secret)))) {
    throw new ApiError(401, 'unauthorized', 'Automation authentication failed.')
  }
}

export async function rateLimit(key: string, maximum: number) {
  const { rows } = await db().query<{ attempts: number }>(`insert into public.scanova_rate_limits
    (key, bucket, attempts) values ($1, date_trunc('minute', now()), 1)
    on conflict (key, bucket) do update set attempts = scanova_rate_limits.attempts + 1
    returning attempts`, [hash(key)])
  if (rows[0].attempts > maximum) throw new ApiError(429, 'rate_limited', 'Too many attempts. Please try again in a minute.')
}
