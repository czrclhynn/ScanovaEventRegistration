import 'server-only'
import { randomUUID } from 'node:crypto'
import { db, getEvents } from './db'
import { ApiError, hash, rateLimit, text, uuid } from './http'
import { ticketPng, ticketToken } from './tickets'
import type { RegistrationTicket } from './types'

const errors: Record<string, [number, string]> = {
  event_full: [409, 'Sorry, this event has reached its maximum registration capacity. No more slots are available.'],
  registration_closed: [409, 'Registration for this event is closed.'],
  duplicate_registration: [409, 'This email address is already registered for the event.'],
  request_conflict: [409, 'This submission reference has already been used. Start a new submission.'],
  invalid_event: [404, 'The selected event could not be found.'],
  invalid_input: [400, 'Check your registration information.'],
}

export async function register(data: Record<string, unknown>): Promise<{ ticket: RegistrationTicket; delivery: string }> {
  const eventId = uuid(data.eventId)
  const requestId = uuid(data.requestId)
  const name = text(data.name, 3, 150)
  const email = text(data.email, 3, 254).toLowerCase()
  const organization = text(data.organization, 1, 160)
  const phone = text(data.phone, 7, 24).replace(/[ ().-]/g, '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'invalid_email', 'Enter a valid email address.')
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new ApiError(400, 'invalid_phone', 'Enter a valid international contact number.')
  if (data.consent !== true) throw new ApiError(400, 'consent_required', 'Confirm that we can use your details to manage your registration.')
  await rateLimit('registration:email:' + email, 8)

  const connection = await db().connect()
  try {
    await connection.query('begin isolation level read committed')
    const { rows: [reservation] } = await connection.query<{ result: string; registration_id: string }>(
      'select * from public.scanova_register($1,$2,$3,$4,$5,$6,$7)',
      [eventId, name, email, organization, phone, true, requestId],
    )
    if (reservation.result !== 'confirmed') {
      const [status, message] = errors[reservation.result] || [503, 'Registration could not be completed.']
      throw new ApiError(status, reservation.result, message)
    }

    const registrationId = reservation.registration_id
    const existing = await connection.query<{ id: string; token_hash: string; ticket_status: string }>(
      'select id, token_hash, ticket_status from public.qr_tickets where registration_id=$1 and event_id=$2 order by issued_at desc limit 1 for update',
      [registrationId, eventId],
    )
    const prior = existing.rows[0]
    if (prior?.ticket_status === 'revoked') throw new ApiError(409, 'revoked_ticket', 'This ticket has been revoked. Contact the event organizer.')
    const ticketId = prior?.id || randomUUID()
    const ticketHash = prior?.token_hash || hash(ticketToken(ticketId))
    const png = await ticketPng(ticketId, ticketHash)
    if (!prior) {
      await connection.query('insert into public.qr_tickets(id,registration_id,event_id,token_hash) values ($1,$2,$3,$4)',
        [ticketId, registrationId, eventId, ticketHash])
    }
    const existingDelivery = await connection.query<{ id: string }>(
      "select id from public.email_logs where registration_id=$1 and event_id=$2 and email_type='registration_confirmation' order by created_at desc limit 1",
      [registrationId, eventId])
    const delivery = existingDelivery.rows[0]?.id || (await connection.query<{ id: string }>(
      "insert into public.email_logs(registration_id,event_id,email_type,recipient_email) values ($1,$2,'registration_confirmation',$3) returning id",
      [registrationId, eventId, email],
    )).rows[0].id
    const [event] = await getEvents(true, eventId, connection)
    if (!event) throw new Error('Registered event could not be loaded')
    await connection.query('commit')
    return { delivery, ticket: { event, ticketId, name, email, organization, qr: 'data:image/png;base64,' + png.toString('base64') } }
  } catch (error) {
    await connection.query('rollback').catch(() => undefined)
    throw error
  } finally {
    connection.release()
  }
}
