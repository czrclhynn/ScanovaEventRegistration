import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Client } from 'pg'

const require = createRequire(import.meta.url)
const png = createRequire(require.resolve('qrcode'))('pngjs').PNG
const { BinaryBitmap, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } =
  createRequire(require.resolve('@zxing/browser'))('@zxing/library')
const decode = (data) => {
  assert.match(data, /^data:image\/png;base64,/)
  const image = png.sync.read(Buffer.from(data.split(',')[1], 'base64'))
  assert.ok(image.width > 0 && image.height > 0)
  const gray = Uint8ClampedArray.from({ length: image.width * image.height }, (_, i) => image.data[i * 4])
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, image.width, image.height)))
  return new QRCodeReader().decode(bitmap, new Map([[DecodeHintType.PURE_BARCODE, true]])).getText()
}

const env = process.env
const origin = new URL(env.SCANOVA_TEST_ORIGIN || 'http://localhost:3000')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'Use a loopback test preview.')
const webhook = env.N8N_WEBHOOK_URL
assert.ok(!webhook, 'Run against an isolated preview with N8N_WEBHOOK_URL unset.')
const ca = env.SUPABASE_CA_CERT?.replace(/\\n/g, '\n') ||
  (env.SUPABASE_CA_FILE ? readFileSync(env.SUPABASE_CA_FILE, 'utf8') : undefined)
const client = new Client({
  host: env.DB_HOST, port: Number(env.DB_PORT || 5432), database: env.DB_DATABASE,
  user: env.DB_USERNAME, password: env.DB_PASSWORD, ssl: { ca, rejectUnauthorized: true },
})
const fixtures = []
const suffix = randomUUID()
const api = new URL('/api/scanova/', origin).href
const request = async (path, data, extraHeaders = {}) => {
  const response = await fetch(api + path, {
    signal: AbortSignal.timeout(30_000),
    ...(data ? { method: 'POST', body: JSON.stringify(data) } : {}),
    headers: { origin: origin.origin, 'content-type': 'application/json', ...extraHeaders },
  })
  return { status: response.status, headers: response.headers, body: await response.json() }
}
const submit = (data) => request('registrations', data)
const fixture = async (status = 'open', expired = false) => {
  const { rows } = await client.query(
    'insert into public.events(event_name,venue,event_date,start_time,end_time,registration_deadline,capacity,registration_status) ' +
    "values ($1,'Verification venue',current_date+2,'09:00','17:00',now()+$2::interval,2,$3) returning id",
    ['[Scanova verification] ' + suffix, expired ? '-1 hour' : '1 day', status],
  )
  fixtures.push(rows[0].id)
  return rows[0].id
}

let stage = 'database connection'
try {
  await client.connect()
  stage = 'test events'
  const eventId = await fixture()
  const closed = await fixture('closed')
  const expired = await fixture('open', true)
  const makeRegistration = (index, event = eventId) => ({
    eventId: event, requestId: randomUUID(), name: 'Test Attendee', email: 'scanova-' + suffix + '-' + index + '@example.invalid',
    organization: 'Registration Verification', phone: '+639171234567', consent: true,
  })

  stage = 'validation and registration availability'
  assert.equal((await submit({ ...makeRegistration(0), email: 'invalid' })).body.code, 'invalid_email')
  assert.equal((await submit({ ...makeRegistration(0), name: undefined })).status, 400)
  assert.equal((await submit(makeRegistration(0, randomUUID()))).body.code, 'invalid_event')
  assert.equal((await submit(makeRegistration(0, closed))).body.code, 'registration_closed')
  assert.equal((await submit(makeRegistration(0, expired))).body.code, 'registration_closed')
  assert.equal((await request('registrations', makeRegistration(0), { origin: 'https://example.invalid' })).status, 403)
  assert.equal((await request('automation/claim', { deliveryId: randomUUID() })).status, 401)

  stage = 'confirmation, capacity, QR and idempotency'
  const submission = makeRegistration(1)
  const first = await submit(submission)
  assert.equal(first.status, 201, first.body.code)
  assert.equal(first.body.ticket.event.available, 1)
  assert.match(decode(first.body.ticket.qr), /^scn1_[\w-]{43}$/)
  assert.equal((await submit(submission)).body.ticket.ticketId, first.body.ticket.ticketId)
  assert.equal((await submit({ ...submission, requestId: randomUUID(), email: submission.email.toUpperCase() })).body.code, 'duplicate_registration')
  const contenders = await Promise.all([2,3,4].map(index => submit(makeRegistration(index))))
  assert.deepEqual(contenders.map(result => result.status).sort(), [201,409,409])
  assert.ok(contenders.filter(result => result.status === 409).every(result => result.body.code === 'event_full'))
  const last = contenders.find(result => result.status === 201).body.ticket
  assert.equal(last.event.available, 0)
  assert.notEqual(decode(first.body.ticket.qr), decode(last.qr))

  stage = 'live persisted rows and public availability'
  const { rows } = await client.query(
    'select r.registration_status,t.id as ticket_id,t.token_hash,l.delivery_status,l.id as delivery_id from public.registrations r ' +
    'join public.qr_tickets t on t.event_id=r.event_id and t.registration_id=r.id ' +
    'join public.email_logs l on l.event_id=r.event_id and l.registration_id=r.id where r.event_id=$1',
    [eventId],
  )
  assert.equal(rows.length, 2)
  for (const ticket of [first.body.ticket,last]) {
    const record = rows.find(row => row.ticket_id === ticket.ticketId)
    assert.equal(record.registration_status, 'confirmed')
    assert.equal(record.delivery_status, 'pending')
    assert.equal(record.token_hash, createHash('sha256').update(decode(ticket.qr)).digest('hex'))
  }
  const events = (await request('events')).body.events
  assert.equal(events.find(event => event.id === eventId).available, 0)
  assert.equal(events.find(event => event.id === eventId).confirmed, 2)
  assert.equal(events.find(event => event.id === expired).status, 'closed')
  assert.equal((await client.query('select count(*)::integer as n from public.registrations where event_id=any($1)', [[closed,expired]])).rows[0].n, 0)
  console.log('Verified live registration, capacity, concurrent final-slot requests, duplicate and retry behavior, deadline, decoded PNGs, and queued email rows.')
  if (env.N8N_WEBHOOK_SECRET) {
    stage = 'authenticated automation callbacks'
    const deliveryId = rows.find(row => row.ticket_id === first.body.ticket.ticketId).delivery_id
    const automation = { 'x-scanova-secret': env.N8N_WEBHOOK_SECRET }
    const claim = await request('automation/claim', { deliveryId }, automation)
    assert.equal(claim.body.claimed, true, claim.body.code)
    const lease = claim.body.claim_token
    assert.equal((await request('automation/claim', { deliveryId }, automation)).body.claimed, false)
    const path = api + 'automation/qr?deliveryId=' + deliveryId
    const wrongLease = await fetch(path, { headers: { ...automation, 'x-scanova-claim': randomUUID() } })
    assert.equal(wrongLease.status, 404)
    const image = await fetch(path, { headers: { ...automation, 'x-scanova-claim': lease } })
    assert.equal(image.headers.get('content-type'), 'image/png')
    assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'), first.body.ticket.qr.split(',')[1])
    const providerReference = 'test-provider-' + suffix
    const outcome = { deliveryId, claim: lease, outcome: 'sent', providerReference }
    assert.equal((await request('automation/status', outcome, automation)).body.recorded, true)
    assert.equal((await request('automation/status', outcome, automation)).body.recorded, false)
    const log = (await client.query('select delivery_status,provider_reference from public.email_logs where id=$1', [deliveryId])).rows[0]
    assert.equal(log.delivery_status, 'sent')
    assert.equal(log.provider_reference, providerReference)
    const rejectedId = rows.find(row => row.ticket_id === last.ticketId).delivery_id
    const rejectedClaim = await request('automation/claim', { deliveryId: rejectedId }, automation)
    assert.equal((await request('automation/status', { deliveryId: rejectedId, claim: rejectedClaim.body.claim_token, outcome: 'rejected' }, automation)).body.recorded, true)
    assert.equal((await client.query('select delivery_status from public.email_logs where id=$1', [rejectedId])).rows[0].delivery_status, 'failed')
    console.log('Verified authenticated QR access, single-owner delivery claims, and successful and rejected callback transitions with simulated provider responses.')
  }
} catch (error) {
  console.error('Verification failed during ' + stage + ':', error.code || error.name)
  if (error.code === 'ERR_ASSERTION' && typeof error.actual !== 'object') {
    console.error('Expected', error.expected, 'received', error.actual, error.message)
  }
  process.exitCode = 1
} finally {
  if (fixtures.length) {
    try {
      await client.query('begin')
      for (const table of ['email_logs','checkin_logs','qr_tickets','registrations']) {
        await client.query('delete from public.' + table + ' where event_id=any($1)', [fixtures])
      }
      await client.query('delete from public.events where id=any($1)', [fixtures])
      await client.query('commit')
      console.log('Removed verification fixtures.')
    } catch (error) {
      await client.query('rollback').catch(() => undefined)
      console.error('Fixture cleanup failed:', error.code || error.name)
      process.exitCode = 1
    }
  }
  await client.end().catch(() => undefined)
}
