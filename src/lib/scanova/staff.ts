import 'server-only'
import { db } from './db'
import { ApiError, hash, text, uuid } from './http'
import type { Attendee, CheckinResult, CheckinRoster, DashboardData } from './types'

const attendeeQuery = `select r.id,r.full_name as name,r.email,r.organization,
  r.contact_number as phone,r.registered_at as "registeredAt",r.registration_status as status,
  t.id as "ticketId",t.ticket_status as "ticketStatus",l.delivery_status as "emailStatus",
  c.checked_in_at as "checkedInAt"
 from public.registrations r
 left join lateral (select id,ticket_status from public.qr_tickets
   where event_id=r.event_id and registration_id=r.id order by issued_at desc,id limit 1) t on true
 left join lateral (select delivery_status from public.email_logs
   where event_id=r.event_id and registration_id=r.id order by created_at desc,id limit 1) l on true
 left join public.checkin_logs c on c.event_id=r.event_id and c.registration_id=r.id
 where r.event_id=$1
   and ($2='' or strpos(lower(concat_ws(' ',r.full_name,r.email,r.organization,t.id::text)),lower($2)) > 0)
   and ($3='all' or ($3='checked' and c.id is not null) or
     ($3='waiting' and r.registration_status='confirmed' and c.id is null))`

export async function dashboard(eventId: string, search: string, filter: string, page: number): Promise<DashboardData> {
  const args = [eventId, search, filter]
  const [rows, total, stats, trends] = await Promise.all([
    db().query<Attendee>(attendeeQuery + ' order by r.registered_at desc,r.id limit 10 offset $4', [...args, (page - 1) * 10]),
    db().query<{ total: number }>('select count(*)::integer as total from (' + attendeeQuery + ') found', args),
    db().query<DashboardData['stats']>(`select count(*)::integer as total,
      count(*) filter (where registration_status='confirmed')::integer as confirmed,
      (select count(*)::integer from public.checkin_logs c join public.registrations r
        on r.event_id=c.event_id and r.id=c.registration_id where c.event_id=$1 and r.registration_status='confirmed') as "checkedIn",
      (select count(*)::integer from public.email_logs where event_id=$1 and delivery_status='sent') as sent
      from public.registrations where event_id=$1`, [eventId]),
    db().query<DashboardData['trends'][number]>(`select day::date::text as date, coalesce(t.total,0)::integer as count
      from generate_series((now() at time zone 'Asia/Manila')::date-13,
        (now() at time zone 'Asia/Manila')::date, interval '1 day') day
      left join (select (registered_at at time zone 'Asia/Manila')::date as date, count(*) as total
        from public.registrations where event_id=$1 and registered_at >= now()-interval '15 days'
        group by 1) t on t.date=day::date order by day`, [eventId]),
  ])
  return { rows: rows.rows, total: total.rows[0].total, stats: stats.rows[0], trends: trends.rows }
}

export async function exportAttendees(eventId: string, search: string, filter: string) {
  return (await db().query<Attendee>(attendeeQuery + ' order by r.registered_at desc,r.id', [eventId, search, filter])).rows
}

export async function checkinRoster(eventId: string, search: string): Promise<CheckinRoster> {
  const [counts, matches] = await Promise.all([
    db().query<CheckinRoster['stats']>(`select count(*)::integer as confirmed,
      count(c.id)::integer as "checkedIn" from public.registrations r
      left join public.checkin_logs c on c.event_id=r.event_id and c.registration_id=r.id
      where r.event_id=$1 and r.registration_status='confirmed'`, [eventId]),
    search.length < 2 ? null : db().query<CheckinRoster['rows'][number]>(`select r.id,r.full_name as name,r.email,t.id as "ticketId"
      from public.registrations r left join lateral (select id from public.qr_tickets
        where event_id=r.event_id and registration_id=r.id order by issued_at desc,id limit 1) t on true
      where r.event_id=$1 and r.registration_status='confirmed'
        and strpos(lower(concat_ws(' ',r.full_name,r.email,t.id::text)),lower($2)) > 0
      order by r.full_name,r.id limit 10`, [eventId,search]),
  ])
  return { stats: counts.rows[0], rows: matches?.rows || [] }
}

export async function saveEvent(data: Record<string, unknown>, staffId: string) {
  const id = data.id ? uuid(data.id) : null
  const name = text(data.name, 1, 200)
  const venue = text(data.venue, 1, 240)
  const description = text(data.description, 0, 4_000)
  const date = text(data.date, 10, 10)
  const start = text(data.start, 5, 5)
  const end = text(data.end, 5, 5)
  const deadline = text(data.deadline, 16, 16)
  const status = text(data.status, 4, 8)
  const capacity = data.capacity
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !clock.test(start) || !clock.test(end) || end <= start ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline) || !['open','upcoming','closed','archived'].includes(status) ||
    typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1 || capacity > 100_000) {
    throw new ApiError(400, 'invalid_event', 'Check the event dates, times, capacity, and status.')
  }
  try {
    const saved = await db().query<{ id: string }>(id
      ? `with saved as (update public.events set event_name=$1,description=$2,venue=$3,event_date=$4,start_time=$5,
        end_time=$6,registration_deadline=$7,capacity=$8,registration_status=$9 where id=$10 returning id),
        audit as (insert into public.audit_logs(user_id,action,entity_type,entity_id)
          select $11,'event_updated','event',id from saved) select id from saved`
      : `with saved as (insert into public.events(event_name,description,venue,event_date,start_time,end_time,
          registration_deadline,capacity,registration_status,created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id),
        audit as (insert into public.audit_logs(user_id,action,entity_type,entity_id)
          select $10,'event_created','event',id from saved) select id from saved`,
    [name, description, venue, date, start, end, deadline + ':00+08:00', capacity, status, ...(id ? [id, staffId] : [staffId])])
    if (!saved.rows[0]) throw new ApiError(404, 'invalid_event', 'The event could not be found.')
    return saved.rows[0]
  } catch (error) {
    const code = (error as { code?: string }).code || ''
    if (code === '23514') throw new ApiError(409, 'invalid_capacity', 'Capacity cannot be lower than confirmed registrations.')
    if (['22007', '22008'].includes(code)) throw new ApiError(400, 'invalid_event', 'Check the event date and deadline.')
    throw error
  }
}

export async function checkIn(data: Record<string, unknown>, staffId: string): Promise<CheckinResult> {
  const eventId = uuid(data.eventId).toLowerCase()
  const reference = typeof data.reference === 'string' ? data.reference.trim() : ''
  const manual = data.manual === true
  if (!manual && !/^scn1_[A-Za-z0-9_-]{43}$/.test(reference)) return { result: 'invalid_ticket' }
  if (manual && !/^[0-9a-f-]{36}$/i.test(reference)) return { result: 'invalid_ticket' }
  const connection = await db().connect()
  try {
    await connection.query('begin')
    const { rows: [ticket] } = await connection.query<{
      id: string; event_id: string; registration_id: string; ticket_status: string
      registration_status: string; name: string; organization: string; event: string
    }>(`select t.id,t.event_id,t.registration_id,t.ticket_status,r.registration_status,
       r.full_name as name,r.organization,e.event_name as event
       from public.qr_tickets t
       join public.registrations r on r.event_id=t.event_id and r.id=t.registration_id
       join public.events e on e.id=t.event_id
       where ` + (manual ? 't.id::text=$1' : 't.token_hash=$1') + ' for update of t,r',
    [manual ? reference.toLowerCase() : hash(reference)])
    let result: CheckinResult
    if (!ticket || ticket.registration_status !== 'confirmed') result = { result: 'invalid_ticket' }
    else if (ticket.event_id !== eventId) result = { result: 'event_mismatch' }
    else if (ticket.ticket_status === 'revoked') result = { result: 'revoked_ticket' }
    else {
      const { rows } = await connection.query<{ time: string }>(`insert into public.checkin_logs
        (registration_id,event_id,ticket_id,checked_in_by) values ($1,$2,$3,$4)
        on conflict (event_id,registration_id) do nothing returning checked_in_at as time`,
      [ticket.registration_id, eventId, ticket.id, staffId])
      const prior = rows[0] || (await connection.query<{ time: string }>(
        'select checked_in_at as time from public.checkin_logs where event_id=$1 and registration_id=$2',
        [eventId, ticket.registration_id],
      )).rows[0]
      if (rows[0]) {
        await connection.query("insert into public.audit_logs(user_id,action,entity_type,entity_id) values ($1,'checked_in','ticket',$2)", [staffId,ticket.id])
      }
      result = { result: rows[0] ? 'checked_in' : 'already_checked_in', name: ticket.name, organization: ticket.organization, event: ticket.event, time: prior.time }
    }
    await connection.query('commit')
    return result
  } catch (error) {
    await connection.query('rollback').catch(() => undefined)
    throw error
  } finally {
    connection.release()
  }
}

export async function revokeTicket(id: string, staffId: string) {
  const { rows } = await db().query<{ id: string }>(`with revoked as (
    update public.qr_tickets set ticket_status='revoked', revoked_at=clock_timestamp()
    where id=$1 and ticket_status='active' returning id
  ) insert into public.audit_logs(user_id,action,entity_type,entity_id)
    select $2,'ticket_revoked','ticket',id from revoked returning entity_id as id`, [id,staffId])
  if (!rows[0] && !(await db().query('select 1 from public.qr_tickets where id=$1',[id])).rowCount) {
    throw new ApiError(404, 'invalid_ticket', 'The ticket could not be found.')
  }
  return { revoked: true }
}
