'use client'

import { useCallback, useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { scanova, ScanovaRequestError } from '@/lib/scanova/client'
import { dateLabel, type Attendee, type CheckinResult, type CheckinRoster, type DashboardData, type ScanovaEvent } from '@/lib/scanova/types'

type Profile = { id: string; name: string; role: 'admin' | 'staff' }
type Art = { Icon: ComponentType<{ name: string; size?: number }>; Logo: ComponentType<{ compact?: boolean }> }
type Navigation = { go: (screen: 'home' | 'scanner' | 'dashboard' | 'flow' | 'system') => void }

const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.'
const timestamp = (time: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
}).format(new Date(time))
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()

export function StaffArea({ mode, openEditor, go, notify, Icon, Logo }: Art & Navigation & {
  mode: 'scanner' | 'dashboard'; openEditor: boolean; notify: (message: string) => void
}) {
  const [profile, setProfile] = useState<Profile | null>()
  const [events, setEvents] = useState<ScanovaEvent[]>([])
  const [id, setId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const refreshEvents = useCallback(async (signal?: AbortSignal) => {
    const { events } = await scanova<{ events: ScanovaEvent[] }>('staff/events', undefined, signal)
    if (signal?.aborted) return
    setEvents(events)
    setId(current => events.some(event => event.id === current) ? current :
      (events.find(event => event.status === 'open') || events[0])?.id || '')
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    scanova<{ profile: Profile }>('staff/session', undefined, controller.signal)
      .then(({ profile }) => setProfile(profile))
      .catch(error => {
        if (controller.signal.aborted) return
        setProfile(null)
        if (error instanceof ScanovaRequestError && error.status !== 401) setError(error.message)
      })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!profile) return
    const controller = new AbortController()
    refreshEvents(controller.signal).catch(error => { if (!controller.signal.aborted) setError(message(error)) })
    return () => controller.abort()
  }, [profile, refreshEvents])
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const values = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const { profile } = await scanova<{ profile: Profile }>('staff/login', {
        email: values.get('email'), password: values.get('password'),
      })
      setProfile(profile)
    } catch (error) { setError(message(error)) }
    finally { setBusy(false) }
  }
  const signOut = async () => {
    try {
      await scanova('staff/logout', {})
      setEvents([])
      setProfile(null)
      setError('')
    } catch (error) { setError(message(error)) }
  }
  if (!profile) return <div className="scanner-entry">
    <button className="scanner-exit" onClick={() => go('home')}>Back to event site</button>
    <form className="entry-card glass" onSubmit={signIn}>
      <Logo/><div className="scanner-icon"><Icon name="users" size={32}/></div>
      <h1>Staff sign-in</h1>
      {profile === undefined ? <p role="status">Checking your session…</p> : <>
        <label className="field text-left"><span>Email address</span><input name="email" type="email" autoComplete="username" required/></label>
        <label className="field text-left"><span>Password</span><input name="password" type="password" autoComplete="current-password" required/></label>
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </>}
      {error && <p role="alert">{error}</p>}
    </form>
  </div>
  const event = events.find(event => event.id === id)
  const picker = <label className="field"><span>Event</span><select value={id} onChange={e => setId(e.target.value)}>
    {!events.length && <option value="">No events available</option>}
    {events.map(event => <option value={event.id} key={event.id}>{event.name}</option>)}
  </select></label>
  return mode === 'scanner' || profile.role === 'staff'
    ? <Scanner key={id} event={event} picker={picker} exit={() => go(profile.role === 'admin' ? 'dashboard' : 'home')}
        errorMessage={error} signOut={signOut} Icon={Icon} Logo={Logo}/>
    : <Dashboard event={event} picker={picker} profile={profile} signOut={signOut} notify={notify}
        refreshEvents={refreshEvents} error={error} openEditor={openEditor} go={go} Icon={Icon} Logo={Logo}/>
}

function Dashboard({ event, picker, profile, signOut, notify, refreshEvents, error, openEditor, go, Icon, Logo }: Art & Navigation & {
  event?: ScanovaEvent; picker: React.ReactNode; profile: Profile; signOut: () => Promise<void>;
  notify: (text: string) => void; refreshEvents: () => Promise<void>; error: string; openEditor: boolean
}) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState<DashboardData>()
  const [failure, setFailure] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<'new' | 'edit' | null>(openEditor && profile.role === 'admin' ? 'new' : null)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const eventId = event?.id

  useEffect(() => { setPage(1); setRecords(undefined) }, [eventId])
  useEffect(() => {
    if (!eventId) return
    const controller = new AbortController()
    const load = async () => {
      try {
        const result = await scanova<DashboardData>('staff/dashboard', { eventId, search, filter, page }, controller.signal)
        if (!controller.signal.aborted) { setRecords(result); setFailure('') }
      } catch (error) {
        if (!controller.signal.aborted) { setRecords(undefined); setFailure(message(error)) }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    setLoading(true)
    const debounce = setTimeout(load, 140)
    const timer = setInterval(() => { if (!document.hidden) void load() }, 15_000)
    return () => { controller.abort(); clearTimeout(debounce); clearInterval(timer) }
  }, [eventId, search, filter, page, revision])

  const action = async (path: string, data: Record<string, unknown>, success: string) => {
    if (busy) return
    setFailure('')
    setBusy(true)
    try {
      await scanova(path, data)
      setRevision(current => current + 1)
      notify(success)
    } catch (error) { setFailure(message(error)) }
    finally { setBusy(false) }
  }
  const exportCsv = async () => {
    if (!eventId || busy) return
    setBusy(true)
    try {
      const { rows } = await scanova<{ rows: Attendee[] }>('staff/export', { eventId, search, filter })
      const csvCell = (value: string | null) => {
        const raw = value || ''
        const sanitized = /^[\s]*[=+\-@]/.test(raw) || /^[\t\r\n]/.test(raw) ? "'" + raw : raw
        return '"' + sanitized.replaceAll('"', '""') + '"'
      }
      const csv = ['Timestamp,Full Name,Email,Organization,Contact,Ticket ID,Registration,Email,Check-in Time',
        ...rows.map(row => [row.registeredAt,row.name,row.email,row.organization,row.phone,row.ticketId,
          row.status,row.emailStatus,row.checkedInAt].map(csvCell).join(','))].join('\r\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'scanova-attendees.csv'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify('Attendee CSV exported')
    } catch (error) { setFailure(message(error)) }
    finally { setBusy(false) }
  }
  const stats = records?.stats
  const total = records?.total || 0
  const maxPages = Math.max(1, Math.ceil(total / 10))
  const card = (label: string, value: number | undefined, change: string, icon: string, accent = false) =>
    <div className={'stat-card glass' + (accent ? ' accent' : '')} key={label}><div className="stat-icon"><Icon name={icon}/></div>
      <span>{label}</span><strong>{value ?? '—'}</strong><small>{change}</small></div>
  return <div className="dashboard-page">
    <aside className="dash-sidebar"><Logo compact/><div><button className="active"><Icon name="users"/><span>Attendees</span></button>
      <button onClick={() => go('scanner')}><Icon name="scan"/><span>Scanner</span></button>
      <button onClick={() => go('flow')}><Icon name="database"/><span>System flow</span></button>
      <button onClick={() => go('system')}><Icon name="spark"/><span>Components</span></button>
    </div><button onClick={() => go('home')}><span>Event site</span></button></aside>
    <div className="dashboard-main">
      <header><div><span className="kicker">{event?.name || 'Event operations'}</span><h1>Attendee List</h1>
        <p>Registration, ticket delivery, and event check-in status.</p></div>
        {profile.role === 'admin' && <button className="secondary" title="Export CSV" onClick={exportCsv} disabled={busy || !event}><Icon name="download"/> Export CSV</button>}
      </header>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">{picker}</div>
        {profile.role === 'admin' && <>
          <button className="secondary" onClick={() => setEditing('new')}>Create event</button>
          <button className="secondary" disabled={!event} onClick={() => setEditing('edit')}>Edit event</button>
        </>}
        <button className="secondary" onClick={() => go('home')}>Event site</button>
        <button className="secondary" onClick={signOut}>Sign out</button>
      </div>
      {(error || failure) && <p className="consent-error" role="alert">{failure || error}</p>}
      {editing && <EventEditor event={editing === 'edit' ? event : undefined} close={() => setEditing(null)}
        saved={async () => { setEditing(null); await refreshEvents(); setRevision(current => current + 1); notify('Event saved') }}/>}
      <div className="stat-grid">
        {card('Total registered',stats?.total,(stats?.confirmed ?? 0) + ' confirmed','users')}
        {card('Available slots',stats && event ? Math.max(0,event.capacity-stats.confirmed) : undefined,'Capacity ' + (event?.capacity ?? '—'),'calendar')}
        {card('Checked in',stats?.checkedIn,(stats?.confirmed ? Math.round(stats.checkedIn / stats.confirmed * 100) : 0) + '% arrival rate','check',true)}
        {card('Awaiting check-in',stats ? stats.confirmed - stats.checkedIn : undefined,(stats?.sent ?? 0) + ' confirmation emails sent','mail')}
      </div>
      {records && <div className="table-card glass mb-5 p-4"><h2 className="mb-3">Registrations in the last 14 days</h2>
        <div className="grid grid-cols-7 gap-2 sm:grid-cols-14">
          {records.trends.map(item => <div key={item.date} title={dateLabel(item.date) + ', ' + item.count + ' registrations'} className="flex flex-col items-center text-xs">
            <span>{item.count}</span><div className="flex h-14 w-full items-end"><i className="w-full rounded-t bg-[#f07870]" style={{ height: (4 + 96 * item.count / Math.max(1, ...records.trends.map(day => day.count))) + '%' }}/></div>
            <span>{item.date.slice(-2)}</span>
          </div>)}
        </div>
      </div>}
      <div className="table-card glass">
        <div className="table-tools"><label><Icon name="search"/><input aria-label="Search attendees" value={search} maxLength={160} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search attendees"/></label>
          <div className="filters">{[['all','All'],['checked','Checked in'],['waiting','Awaiting check-in']].map(([value,label]) =>
            <button className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setPage(1) }} key={value}>{label}</button>)}</div>
          <span aria-live="polite">{loading && event ? 'Loading…' : total + ' matching records'}</span>
        </div>
        <div className="table-scroll"><table><thead><tr>{['Timestamp','Full name','Email','Organization','Contact number','Ticket ID','QR status','Email delivery','Registration','Check-in','Actions'].map(heading => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>{(records?.rows || []).map(row => <tr key={row.id}>
            <td>{timestamp(row.registeredAt)}</td><td><strong>{row.name}</strong></td><td>{row.email}</td>
            <td>{row.organization}</td><td>{row.phone}</td><td><code>{row.ticketId || '—'}</code></td>
            <td>{row.ticketStatus || '—'}</td><td><span className={'badge ' + (row.emailStatus || 'pending')}>{row.emailStatus || '—'}</span></td>
            <td>{row.status}</td><td>{row.checkedInAt ? timestamp(row.checkedInAt) : '—'}</td>
            <td>{profile.role === 'admin' && row.emailStatus === 'failed' && <button disabled={busy} onClick={() => action('staff/resend',{ registrationId: row.id },'Email queued')}>Resend email</button>}
              {' '}{profile.role === 'admin' && row.ticketStatus === 'active' && <button disabled={busy} onClick={() => {
                if (window.confirm('Revoke this QR ticket? It will no longer work for check-in.')) void action('staff/revoke',{ ticketId: row.ticketId },'Ticket revoked')
              }}>Revoke ticket</button>}</td>
          </tr>)}
          {!records?.rows.length && <tr><td colSpan={11}>{!event ? 'Choose or create an event.' : loading ? 'Loading attendees…' : failure ? 'Attendees could not be loaded.' : 'No matching attendees.'}</td></tr>}</tbody>
        </table></div>
        <div className="pagination"><span>{total ? ((page-1)*10+1) + '–' + Math.min(total,page*10) + ' of ' + total : '0 records'}</span>
          <div><button disabled={page <= 1} onClick={() => setPage(page-1)}>Prev</button><button className="active">{page}</button>
            <button disabled={page >= maxPages} onClick={() => setPage(page+1)}>Next</button></div></div>
      </div>
    </div>
  </div>
}

function EventEditor({ event, close, saved }: { event?: ScanovaEvent; close: () => void; saved: () => Promise<void> }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    try {
      await scanova('staff/events', { ...data, id: event?.id, capacity: Number(data.capacity) })
      await saved()
    } catch (error) { setError(message(error)) }
    finally { setBusy(false) }
  }
  const deadline = event ? new Date(new Date(event.deadline).getTime() + 8*60*60*1000).toISOString().slice(0, 16) : ''
  return <form className="registration-form glass my-5" onSubmit={submit}>
    <h2>{event ? 'Edit event' : 'Create event'}</h2>
    {[
      ['name','Event name','text',event?.name], ['venue','Venue','text',event?.venue],
      ['date','Event date','date',event?.date], ['start','Start time','time',event?.start.slice(0,5)],
      ['end','End time','time',event?.end.slice(0,5)], ['deadline','Deadline (Philippine time)','datetime-local',deadline],
      ['capacity','Capacity','number',event?.capacity],
    ].map(([name,label,type,value]) => <label className="field" key={name}><span>{label}</span>
      <input required name={String(name)} type={String(type)} min={name === 'capacity' ? 1 : undefined} defaultValue={value}/></label>)}
    <label className="field"><span>Description</span><textarea name="description" defaultValue={event?.description} maxLength={4000}/></label>
    <label className="field"><span>Registration status</span><select name="status" defaultValue={event?.status || 'upcoming'}>
      {['upcoming','open','closed','archived'].map(value => <option key={value}>{value}</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}
    <div className="flex gap-3"><button className="primary" disabled={busy}>Save event</button><button className="secondary" type="button" onClick={close}>Cancel</button></div>
  </form>
}

function Scanner({ event, picker, exit, errorMessage, signOut, Icon, Logo }: Art & {
  event?: ScanovaEvent; picker: React.ReactNode; exit: () => void; errorMessage: string; signOut: () => Promise<void>
}) {
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [torch, setTorch] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CheckinResult>()
  const [manual, setManual] = useState(false)
  const [stats, setStats] = useState<CheckinRoster['stats']>()
  const video = useRef<HTMLVideoElement>(null)
  const media = useRef<MediaStream | null>(null)
  const controls = useRef<IScannerControls | null>(null)
  const generation = useRef(0)
  const paused = useRef(false)
  const lastScan = useRef<{ reference: string; time: number } | null>(null)
  const eventId = event?.id
  const stop = useCallback(() => {
    generation.current++
    controls.current?.stop()
    controls.current = null
    media.current?.getTracks().forEach(track => track.stop())
    media.current = null
    if (video.current) video.current.srcObject = null
  }, [])
  useEffect(() => {
    const hide = () => { stop(); setActive(false); setStarting(false) }
    window.addEventListener('pagehide', hide)
    return () => { window.removeEventListener('pagehide', hide); stop() }
  }, [stop])
  const count = useCallback(async () => {
    if (!eventId) return
    const { stats } = await scanova<CheckinRoster>('staff/checkin-roster?eventId=' + eventId)
    setStats(stats)
  }, [eventId])
  useEffect(() => { void count().catch(() => undefined) }, [count])
  const check = async (reference: string, manual = false) => {
    if (!eventId || paused.current) return
    const now = Date.now()
    if (!manual && lastScan.current?.reference === reference && now - lastScan.current.time < 3000) return
    if (!manual) lastScan.current = { reference, time: now }
    paused.current = true
    setError('')
    try {
      const outcome = await scanova<CheckinResult>('staff/checkin', { eventId, reference, manual })
      setManual(false)
      setResult(outcome)
      if (outcome.result === 'checked_in') void count().catch(() => undefined)
    } catch (error) {
      paused.current = false
      setError(message(error))
    }
  }
  const start = async () => {
    if (!eventId || starting || active) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs HTTPS and a supported browser. Use manual verification.')
      return
    }
    const attempt = ++generation.current
    setError('')
    setStarting(true)
    setTorch(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      if (generation.current !== attempt) { stream.getTracks().forEach(track => track.stop()); return }
      media.current = stream
      setActive(true)
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      if (generation.current !== attempt || !video.current) return
      const scanner = await new BrowserQRCodeReader().decodeFromStream(stream, video.current, (decoded) => {
        if (decoded && generation.current === attempt) void check(decoded.getText())
      })
      if (generation.current !== attempt) { scanner.stop(); return }
      controls.current = scanner
      setTorchAvailable(Boolean(scanner.switchTorch))
    } catch (error) {
      if (generation.current !== attempt) return
      stop()
      setActive(false)
      setError(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Camera permission was denied. You can verify tickets manually.'
        : 'The camera could not be started. You can verify tickets manually.')
    } finally { setStarting(false) }
  }
  const closeResult = () => { setResult(undefined); paused.current = false }
  const stopScanner = () => { stop(); setActive(false); setStarting(false); lastScan.current = null; closeResult() }
  const outcomes = {
    checked_in: ['Successful check-in','check','success'],
    already_checked_in: ['Already checked in','clock','duplicate'],
    invalid_ticket: ['Invalid ticket','x','invalid'],
    event_mismatch: ['Event mismatch','x','invalid'],
    revoked_ticket: ['Revoked ticket','x','invalid'],
  }
  const current = result && outcomes[result.result]
  return <>
    {!active && <div className="scanner-entry"><button className="scanner-exit" onClick={exit}>Exit staff mode</button>
      <div className="entry-card glass"><Logo/><div className="scanner-icon"><Icon name="scan" size={34}/></div><span className="kicker">Event operations</span>
        <h1>Staff Check-in<br/>Mode</h1>{picker}
        {event && <div className="entry-meta"><span><Icon name="calendar"/>{dateLabel(event.date)}</span><span><Icon name="pin"/>{event.venue}</span></div>}
        <p>Camera access reads ticket QR codes on this device.</p>
        <button className="primary" disabled={starting || !event} onClick={start}>{starting ? 'Requesting camera…' : 'Start Scanner'}</button>
        {starting && <button className="secondary mt-2" onClick={stopScanner}>Cancel camera request</button>}
        <button className="secondary mt-2" disabled={!event} onClick={() => setManual(true)}>Manual verification</button>
        <button className="text-button mx-auto" onClick={signOut}>Sign out</button>
        {(error || errorMessage) && <p role="alert">{error || errorMessage}</p>}
      </div></div>}
    <div className="live-scanner" hidden={!active}>
      <video ref={video} muted playsInline className="absolute inset-0 h-full w-full object-cover" aria-label="Live QR camera preview"/>
      <div className="scanner-top"><button aria-label="Stop Scanner" title="Stop Scanner" onClick={stopScanner}><Icon name="x"/></button><div><Logo compact/><span>Staff check-in</span></div><span className="live-dot">LIVE</span></div>
      <div className="scan-copy"><h2>Scan attendee ticket</h2><p>Align the QR code within the frame.</p>{error && <p role="alert">{error}</p>}</div>
      <div className="scan-target w-max" aria-hidden="true"><div className="viewfinder"><i/><i/><i/><i/><span/></div></div>
      <div className="scanner-controls">
        <button className={torch ? 'on' : ''} disabled={!torchAvailable} onClick={async () => {
          try { await controls.current?.switchTorch?.(!torch); setTorch(!torch) } catch { setError('The torch is unavailable.') }
        }}><Icon name="torch"/><span>Torch</span></button>
        <div className="check-counter"><strong>{stats?.checkedIn ?? '—'}</strong><span>of {stats?.confirmed ?? '—'}<br/>checked in</span></div>
        <button onClick={() => { paused.current = true; setManual(true) }}><Icon name="search"/><span>Manual search</span></button>
      </div>
    </div>
    {manual && eventId && <ManualSearch eventId={eventId} Icon={Icon} error={error}
      close={() => { setManual(false); paused.current = false }}
      check={reference => { paused.current = false; return check(reference, true) }}/>}
    {result && current && <div className={'result-overlay ' + current[2]} role="dialog" aria-modal="true" aria-label={current[0]}><div className="result-sheet">
      <div className="result-symbol"><Icon name={current[1]} size={34}/></div><h2>{current[0]}</h2>
      {result.time && <p>{timestamp(result.time)}</p>}
      {result.name && <div className="person-card"><div>{initials(result.name)}</div><span><strong>{result.name}</strong><small>{result.organization}</small><small>{result.event}</small></span></div>}
      <button className="result-primary" onClick={closeResult}>{active ? 'Scan next' : 'Done'}</button>
      <button className="result-secondary" onClick={() => { setResult(undefined); paused.current = true; setManual(true) }}>Search manually</button>
    </div></div>}
  </>
}

function ManualSearch({ eventId, close, check, error, Icon }: Pick<Art,'Icon'> & {
  eventId: string; close: () => void; check: (reference: string) => Promise<void>; error: string
}) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<CheckinRoster['rows']>([])
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (search.trim().length < 2) { setRows([]); return }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      scanova<CheckinRoster>('staff/checkin-roster',{eventId,search},controller.signal)
        .then(({ rows }) => { setRows(rows); setProblem('') })
        .catch(error => { if (!controller.signal.aborted) setProblem(message(error)) })
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [eventId,search])
  const verify = async (id: string) => {
    if (busy) return
    setBusy(true)
    try { await check(id) } finally { setBusy(false) }
  }
  return <div className="manual-overlay" role="dialog" aria-modal="true" aria-label="Manual ticket verification"><div className="manual-sheet max-h-[85vh] overflow-auto">
    <div className="sheet-handle"/><div className="manual-head"><div><span className="kicker">Fallback check-in</span><h2>Find an attendee</h2></div><button onClick={close} aria-label="Close manual verification"><Icon name="x"/></button></div>
    <label className="search-box"><Icon name="search"/><input autoFocus value={search} maxLength={160} onChange={e => setSearch(e.target.value)} placeholder="Name, email, or ticket ID"/></label>
    <p className="search-hint">{search.trim().length < 2 ? 'Enter at least two characters' : rows.length + ' matches'}</p>
    {(error || problem) && <p role="alert">{error || problem}</p>}
    {rows.map(row => <div className="search-result" key={row.id}><div className="avatar">{initials(row.name)}</div>
      <div><strong>{row.name}</strong><span>{row.email}</span><small>{row.ticketId || 'Ticket unavailable'}</small></div>
      <button disabled={busy || !row.ticketId} onClick={() => row.ticketId && verify(row.ticketId)}>Verify &amp; check in</button></div>)}
  </div></div>
}
