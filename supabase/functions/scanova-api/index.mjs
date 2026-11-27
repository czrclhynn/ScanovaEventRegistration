import { AsyncLocalStorage } from 'node:async_hooks'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { parseCookieHeader, serializeCookieHeader } from 'npm:@supabase/ssr@0.12.7'
import { db } from './db.ts'
import { GET, POST } from './router.ts'

const requests = new AsyncLocalStorage()
const prefix = '/scanova-api/'
const settings = {
  SCANOVA_TICKET_KEY: 'scanova_edge_ticket_key',
  N8N_WEBHOOK_SECRET: 'scanova_edge_n8n_webhook_secret',
  N8N_WEBHOOK_URL: 'scanova_edge_n8n_webhook_url',
  APP_URL: 'scanova_edge_app_url',
  SUPABASE_URL: 'scanova_edge_supabase_url',
  SUPABASE_PUBLISHABLE_KEY: 'scanova_edge_supabase_publishable_key',
}
let configuration
const environment = { NODE_ENV: 'production' }

async function loadConfiguration() {
  const { rows } = await db().query(
    'select name, decrypted_secret from vault.decrypted_secrets where name = any($1::text[])',
    [Object.values(settings)],
  )
  const values = new Map(rows.map(({ name, decrypted_secret }) => [name, decrypted_secret]))
  for (const [key, name] of Object.entries(settings)) {
    const value = values.get(name)
    if (!value) throw new Error('Scanova Vault configuration is incomplete')
    environment[key] = value
  }
  if (Buffer.byteLength(environment.SCANOVA_TICKET_KEY) < 32) throw new Error('Scanova ticket configuration is invalid')
  return createHmac('sha256', environment.SCANOVA_TICKET_KEY).update('scanova-edge-relay-v1').digest()
}

export function runtimeValue(name) {
  return environment[name] ?? Deno.env.get(name)
}

function matchesToken(expected, supplied) {
  return /^[a-f0-9]{64}$/.test(supplied) && timingSafeEqual(expected, Buffer.from(supplied, 'hex'))
}

function errorResponse(code, message, status) {
  return Response.json({ code, message }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

Deno.serve(async (request) => {
  const token = request.headers.get('x-scanova-relay') ?? ''
  // Discard ordinary direct calls before opening a database connection.
  if (!/^[a-f0-9]{64}$/.test(token)) return errorResponse('unauthorized', 'Relay authentication failed.', 401)
  try {
    configuration ??= loadConfiguration().catch((error) => {
      configuration = undefined
      throw error
    })
    if (!matchesToken(await configuration, token)) return errorResponse('unauthorized', 'Relay authentication failed.', 401)
    const url = new URL(request.url)
    const offset = url.pathname.indexOf(prefix)
    const path = offset < 0 ? '' : url.pathname.slice(offset + prefix.length)
    if (!/^[a-z]+(?:\/[a-z-]+)?$/.test(path)) return errorResponse('not_found', 'This endpoint does not exist.', 404)
    const handler = request.method === 'POST' ? POST : request.method === 'GET' ? GET : null
    if (!handler) return errorResponse('method_not_allowed', 'This method is unavailable.', 405)
    const session = { request, cookies: [], background: [] }
    const response = await requests.run(session, () => handler(request, { params: Promise.resolve({ segments: path.split('/') }) }))
    const headers = new Headers(response.headers)
    for (const cookie of session.cookies) headers.append('Set-Cookie', cookie)
    for (const task of session.background) EdgeRuntime.waitUntil(Promise.resolve().then(task))
    return new Response(response.body, { status: response.status, headers })
  } catch (error) {
    console.error('Scanova edge request failed', error?.code ?? error?.name ?? 'internal_error')
    return errorResponse('service_unavailable', 'Scanova is temporarily unavailable. Please try again.', 503)
  }
})

export function after(task) {
  requests.getStore().background.push(task)
}

export async function cookies() {
  const { request, cookies } = requests.getStore()
  return {
    getAll: () => parseCookieHeader(request.headers.get('cookie') ?? ''),
    set: (name, value, options) => cookies.push(serializeCookieHeader(name, value, options)),
  }
}
