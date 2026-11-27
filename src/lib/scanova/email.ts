import 'server-only'
import { db } from './db'
import { ApiError, text, uuid } from './http'
import { ticketPng } from './tickets'

export async function dispatchEmail(deliveryId?: string) {
  const value = process.env.N8N_WEBHOOK_URL
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!value || !secret) return { dispatched: 0 }
  const url = new URL(value)
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('Invalid n8n webhook URL')
  }
  await db().query(`update public.email_logs set delivery_status='failed',
    error_message='transport_unconfirmed',claim_token=null,claim_expires_at=null
    where delivery_status='pending' and dispatch_attempts > 0
      and ((dispatch_attempts >= 5 and next_attempt_at <= now()) or created_at < now()-interval '20 hours')
      and coalesce(claim_expires_at,'-infinity') <= now()`)
  const { rows } = await db().query<{ id: string }>(`with due as (
    select id from public.email_logs where delivery_status='pending' and dispatch_attempts < 5
      and next_attempt_at <= now() and coalesce(claim_expires_at,'-infinity') <= now()
      and (dispatch_attempts=0 or created_at >= now()-interval '20 hours')
      and ($1::uuid is null or id=$1)
    order by next_attempt_at,id limit 12 for update skip locked
  ) update public.email_logs l set dispatch_attempts=dispatch_attempts+1,
    next_attempt_at=now()+interval '3 minutes' * power(2,dispatch_attempts)
    from due where due.id=l.id returning l.id`, [deliveryId || null])
  const outcomes = await Promise.all(rows.map(async ({ id }) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-scanova-secret': secret },
        body: JSON.stringify({ deliveryId: id }),
        signal: AbortSignal.timeout(7_000),
        redirect: 'error',
      })
      await response.body?.cancel()
      return response.ok
    } catch {
      return false
    }
  }))
  return { dispatched: outcomes.filter(Boolean).length }
}

type TicketFacts = {
  ticket_id: string
  token_hash: string
  claim_token: string
  recipient: string
  name: string
  event_name: string
  date: string
  start: string
  end: string
  venue: string
}

export async function claimDelivery(id: string) {
  const { rows: [facts] } = await db().query<TicketFacts>(`update public.email_logs l
    set claim_token=gen_random_uuid(),claim_expires_at=now()+interval '3 minutes'
    from public.registrations r,public.events e,public.qr_tickets t
    where l.id=$1 and l.delivery_status='pending' and coalesce(l.claim_expires_at,'-infinity')<=now()
      and l.registration_id=r.id and l.event_id=r.event_id and e.id=l.event_id
      and r.registration_status='confirmed' and t.event_id=r.event_id and t.registration_id=r.id and t.ticket_status='active'
    returning l.claim_token,l.recipient_email as recipient,r.full_name as name,e.event_name,
      e.event_date::text as date,e.start_time::text as start,e.end_time::text as end,e.venue`, [id])
  return facts ? { claimed: true, ...facts } : { claimed: false }
}

export async function deliveryQr(id: string, claim: string) {
  const { rows: [facts] } = await db().query<TicketFacts>(`select t.id as ticket_id,t.token_hash
    from public.email_logs l join public.registrations r on r.event_id=l.event_id and r.id=l.registration_id
    join public.qr_tickets t on t.event_id=l.event_id and t.registration_id=l.registration_id
    where l.id=$1 and l.claim_token=$2 and l.claim_expires_at > now()
      and l.delivery_status='pending' and r.registration_status='confirmed' and t.ticket_status='active'`, [id,claim])
  if (!facts) throw new ApiError(404, 'ticket_unavailable', 'This delivery has no active ticket.')
  return ticketPng(facts.ticket_id, facts.token_hash)
}

export async function recordDelivery(data: Record<string, unknown>) {
  const id = uuid(data.deliveryId)
  const claim = uuid(data.claim)
  if (data.outcome !== 'sent' && data.outcome !== 'rejected' && data.outcome !== 'retry') {
    throw new ApiError(400, 'invalid_outcome', 'Unknown delivery outcome.')
  }
  const reference = data.outcome === 'sent' ? text(data.providerReference, 1, 180) : null
  const { rowCount } = await db().query(`update public.email_logs set
    delivery_status=case $3::text when 'sent' then 'sent' when 'rejected' then 'failed' else 'pending' end,
    provider_reference=$4,sent_at=case when $3='sent' then now() else null end,
    error_message=case $3 when 'rejected' then 'provider_rejected' when 'retry' then 'transport_unconfirmed' else null end,
    claim_token=null,claim_expires_at=null
    where id=$1 and claim_token=$2 and delivery_status='pending'`, [id,claim,data.outcome,reference])
  return { recorded: Boolean(rowCount) }
}

export async function queueResend(registrationId: string, staffId: string) {
  const { rows } = await db().query<{ id: string }>(`with queued as (
    insert into public.email_logs(registration_id,event_id,email_type,recipient_email)
    select r.id,r.event_id,'registration_confirmation',r.email
    from public.registrations r
    join lateral (
      select delivery_status,error_message from public.email_logs where registration_id=r.id and event_id=r.event_id
      order by created_at desc,id limit 1
    ) previous on previous.delivery_status='failed' and previous.error_message='provider_rejected'
    where r.id=$1 and r.registration_status='confirmed'
      and exists (select 1 from public.qr_tickets where event_id=r.event_id and registration_id=r.id and ticket_status='active')
    on conflict do nothing returning id
  ), audit as (insert into public.audit_logs(user_id,action,entity_type,entity_id)
    select $2,'email_requeued','registration',$1 from queued)
  select id from queued`, [registrationId,staffId])
  if (!rows[0]) throw new ApiError(409, 'resend_unavailable', 'Resending requires an active ticket and a confirmed provider rejection.')
  return rows[0].id
}
