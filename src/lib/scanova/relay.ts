import 'server-only'
import { createHmac } from 'node:crypto'
import { ApiError, json } from './http'

export async function relayScanova(request: Request, segments: string[]) {
  try {
    const project = new URL(process.env.SUPABASE_URL ?? '')
    if (project.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(project.host)) throw new Error()
    const key = process.env.SCANOVA_TICKET_KEY
    if (!key || Buffer.byteLength(key) < 32) throw new Error()
    const token = createHmac('sha256', key).update('scanova-edge-relay-v1').digest('hex')
    const path = segments.join('/')
    if (!/^[a-z]+(?:\/[a-z-]+)?$/.test(path)) return json({ code: 'not_found', message: 'This endpoint does not exist.' }, 404)
    const requestUrl = new URL(request.url)
    const site = new URL(process.env.APP_URL || process.env.FIGMA_PUBLIC_URL || request.url)
    const origin = request.headers.get('origin')
    const preview = process.env.FIGMA_PUBLIC_URL && new URL(process.env.FIGMA_PUBLIC_URL).origin
    const browserPost = request.method === 'POST' && !path.startsWith('automation/')
    if (browserPost && (!origin || (origin !== site.origin && origin !== preview))) {
      return json({ code: 'invalid_origin', message: 'This request came from an unrecognized site.' }, 403)
    }
    const headers = new Headers({ 'x-scanova-relay': token })
    if (browserPost) headers.set('origin', site.origin)
    const names = ['content-type']
    if (path.startsWith('automation/')) names.push('x-scanova-secret', 'x-scanova-claim')
    for (const name of names) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }
    if (path.startsWith('staff/')) {
      const session = request.headers.get('cookie')?.split(';').filter((part) => /^\s*scanova-session(?:\.\d+)?=/.test(part))
      if (session?.length) headers.set('cookie', session.join(';'))
    }
    const reader = request.body?.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > 16_384) {
          await reader.cancel()
          throw new ApiError(413, 'body_too_large', 'The request is too large.')
        }
        chunks.push(value)
      }
    }
    const url = new URL('/functions/v1/scanova-api/' + path + requestUrl.search, project)
    const response = await fetch(url, {
      method: request.method, headers, body: reader ? Buffer.concat(chunks) : undefined,
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000),
    })
    const outgoing = new Headers({ 'Cache-Control': 'private, no-store' })
    const contentType = response.headers.get('content-type')
    if (contentType) outgoing.set('Content-Type', contentType)
    for (const cookie of response.headers.getSetCookie()) {
      if (/^scanova-session(?:\.\d+)?=/.test(cookie)) outgoing.append('Set-Cookie', cookie)
    }
    return new Response(response.body, { status: response.status, headers: outgoing })
  } catch (error) {
    if (error instanceof ApiError) return json({ code: error.code, message: error.message }, error.status)
    return json({ code: 'service_unavailable', message: 'Scanova is temporarily unavailable. Please try again.' }, 503)
  }
}
