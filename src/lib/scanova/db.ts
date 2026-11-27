import 'server-only'

import { readFileSync } from 'node:fs'
import { Pool, type PoolClient } from 'pg'
import type { ScanovaEvent } from './types'

let pool: Pool | undefined

export function db() {
  if (pool) return pool
  if (process.env.SUPABASE_DB_URL) {
    pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, max: 1, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000 })
    pool.on('error', () => console.error('Scanova database connection closed unexpectedly'))
    return pool
  }
  const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD, SUPABASE_CA_CERT, SUPABASE_CA_FILE } = process.env
  if (!DB_HOST || !DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) {
    throw new Error('Scanova database configuration is missing')
  }
  const ca = SUPABASE_CA_CERT?.replace(/\\n/g, '\n') ||
    (SUPABASE_CA_FILE ? readFileSync(SUPABASE_CA_FILE, 'utf8') : undefined)
  pool = new Pool({
    host: DB_HOST,
    port: Number(DB_PORT || '5432'),
    database: DB_DATABASE,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    ssl: { ca, rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 15_000,
    statement_timeout: 8_000,
  })
  pool.on('error', () => console.error('Scanova database connection closed unexpectedly'))
  return pool
}

export async function getEvents(includeArchived = false, eventId: string | null = null, connection: Pool | PoolClient = db()) {
  return (await connection.query<ScanovaEvent>(
    `select e.id, e.event_name as name, e.description, e.venue,
      e.event_date::text as date, e.start_time::text as start, e.end_time::text as end,
      e.registration_deadline as deadline, e.capacity,
      confirmed.total as confirmed, greatest(0, e.capacity - confirmed.total) as available,
      case when e.registration_status = 'open' and e.registration_deadline <= now()
        then 'closed' else e.registration_status end as status
     from public.events e
     cross join lateral (
       select count(*)::integer as total from public.registrations r
       where r.event_id=e.id and r.registration_status='confirmed'
     ) confirmed
     where ($1::boolean or e.registration_status <> 'archived') and ($2::uuid is null or e.id=$2)
     order by e.event_date, e.start_time, e.id`, [includeArchived, eventId],
  )).rows
}
