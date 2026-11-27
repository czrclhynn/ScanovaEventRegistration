import { after } from 'next/server'
import { authClient, getProfile, requireStaff } from './auth'
import { db, getEvents } from './db'
import { claimDelivery, deliveryQr, dispatchEmail, queueResend, recordDelivery } from './email'
import { ApiError, automationRequest, body, browserMutation, json, rateLimit, respond, text, uuid } from './http'
import { register } from './registration'
import { checkIn, checkinRoster, dashboard, exportAttendees, revokeTicket, saveEvent } from './staff'



export type Context = { params: Promise<{ segments: string[] }> }
const missing = () => new ApiError(404, 'not_found', 'This endpoint does not exist.')

function afterDispatch(id: string) {
  after(async () => {
    try { await dispatchEmail(id) } catch { console.error('Scanova email dispatch deferred') }
  })
}

export async function GET(request: Request, context: Context) {
  const path = (await context.params).segments.join('/')
  const query = new URL(request.url).searchParams
  if (path === 'automation/qr') {
    try {
      automationRequest(request)
      const png = await deliveryQr(uuid(query.get('deliveryId')), uuid(request.headers.get('x-scanova-claim')))
      return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
    } catch (error) {
      return respond(async () => { throw error })
    }
  }
  return respond(async () => {
    if (path === 'events') return { events: await getEvents() }
    if (path === 'staff/session') return { profile: await requireStaff() }
    if (path === 'staff/events') {
      const profile = await requireStaff()
      return { events: await getEvents(profile.role === 'admin') }
    }
    if (path === 'staff/checkin-roster') {
      const profile = await requireStaff()
      await rateLimit('roster:' + profile.id, 90)
      return checkinRoster(uuid(query.get('eventId')), '')
    }
    throw missing()
  })
}

export async function POST(request: Request, context: Context) {
  const path = (await context.params).segments.join('/')
  if (path === 'registrations') {
    const response = await respond(async () => {
      browserMutation(request)
      const data = await body(request)
      await rateLimit('registrations:all', 240)
      const { delivery, ticket } = await register(data)
      afterDispatch(delivery)
      return { ticket }
    })
    if (response.ok) return new Response(response.body, { status: 201, headers: response.headers })
    return response
  }
  return respond(async () => {
    if (path.startsWith('automation/')) {
      automationRequest(request)
      if (path === 'automation/dispatch') {
        await db().query("delete from public.scanova_rate_limits where bucket < now()-interval '1 day'")
        return dispatchEmail()
      }
      const data = await body(request)
      if (path === 'automation/claim') return claimDelivery(uuid(data.deliveryId))
      if (path === 'automation/status') return recordDelivery(data)
      throw missing()
    }
    browserMutation(request)
    if (path === 'staff/logout') {
      const client = await authClient()
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) throw error
      return { signedOut: true }
    }
    const data = await body(request)
    if (path === 'staff/checkin-roster') {
      const profile = await requireStaff()
      await rateLimit('roster:' + profile.id, 90)
      return checkinRoster(uuid(data.eventId), text(data.search ?? '', 0, 160))
    }
    if (path === 'staff/dashboard' || path === 'staff/export') {
      const profile = await requireStaff(true)
      await rateLimit('dashboard:' + profile.id, 120)
      const id = uuid(data.eventId)
      const search = text(data.search ?? '', 0, 160)
      const filter = text(data.filter ?? 'all', 3, 10)
      const page = data.page ?? 1
      if (!['all','checked','waiting'].includes(filter) || typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > 100_000) {
        throw new ApiError(400, 'invalid_filter', 'Check the filter and page number.')
      }
      return path === 'staff/export' ? { rows: await exportAttendees(id, search, filter) } : dashboard(id, search, filter, page)
    }
    if (path === 'staff/login') {
      const email = text(data.email, 3, 254).toLowerCase()
      const password = typeof data.password === 'string' ? data.password : ''
      if (!email.includes('@') || !password || password.length > 1024) throw new ApiError(400, 'invalid_login', 'Enter your email and password.')
      await rateLimit('login:all', 90)
      await rateLimit('login:' + email, 8)
      const client = await authClient()
      const { data: auth, error } = await client.auth.signInWithPassword({ email, password })
      if (error || !auth.user) throw new ApiError(401, 'invalid_login', 'The email or password is incorrect.')
      const profile = await getProfile(auth.user.id)
      if (!profile) {
        await client.auth.signOut({ scope: 'local' })
        throw new ApiError(403, 'forbidden', 'This account has no Scanova staff access.')
      }
      return { profile }
    }
    if (path === 'staff/checkin') {
      const profile = await requireStaff()
      await rateLimit('checkin:' + profile.id, 120)
      return checkIn(data, profile.id)
    }
    if (path === 'staff/events') return saveEvent(data, (await requireStaff(true)).id)
    if (path === 'staff/revoke') return revokeTicket(uuid(data.ticketId), (await requireStaff(true)).id)
    if (path === 'staff/resend') {
      const profile = await requireStaff(true)
      await rateLimit('resend:' + profile.id, 20)
      afterDispatch(await queueResend(uuid(data.registrationId),profile.id))
      return { queued: true }
    }
    throw missing()
  })
}
