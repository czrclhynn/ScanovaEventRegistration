'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { scanova } from '@/lib/scanova/client'
import { dateLabel, eventTimeLabel, type RegistrationTicket, type ScanovaEvent } from '@/lib/scanova/types'
import { StaffArea } from './ScanovaOperations'

type Screen = 'home' | 'register' | 'ticket' | 'email' | 'scanner' | 'dashboard' | 'flow' | 'system'
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactElement> = {
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    scan: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M7 12h10"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    spark: <><path d="m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2L12 3ZM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z"/></>,
    torch: <><path d="m9 2 6 2-1 4-6-2 1-4ZM8 6l6 2-3 12-4-1 1-13Z"/></>,
    menu: <><path d="M5 8h14M5 16h14"/></>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.spark}</svg>
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo" aria-label="Scanova home">
    <span className="logo-mark"><i/><i/><i/><i/></span>
    {!compact && <span>scanova</span>}
  </div>
}

function QR({ small = false }: { small?: boolean }) {
  const cells = useMemo(() => Array.from({ length: 121 }, (_, i) => {
    const x = i % 11, y = Math.floor(i / 11)
    const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7)
    return finder || ((x * 7 + y * 5 + x * y) % 5 < 2)
  }), [])
  return <div className={`qr ${small ? 'small' : ''}`}>{cells.map((on, i) => <i className={on ? 'on' : ''} key={i}/>)}</div>
}

function Ambient() {
  return <div className="ambient" aria-hidden="true"><i className="orb blue"/><i className="orb coral"/><i className="grain"/></div>
}

function HeroMark() {
  return <div className="hero-mark-wrap" aria-label="Scanova glass logo artwork">
    <div className="hero-mark-halo"/>
    <div className="hero-plate plate-back"/>
    <div className="hero-plate plate-side"/>
    <div className="hero-plate plate-main">
      <div className="mark-grid">
        <i/><i/><i/>
        <span className="scan-corner"/>
      </div>
      <div className="mark-dots">{Array.from({ length: 11 }, (_, i) => <i key={i}/>)}</div>
    </div>
    <div className="hero-scan-beam"/>
    <span className="mark-caption">SCANOVA / SIGNAL 01</span>
  </div>
}

function Header({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const [open, setOpen] = useState(false)
  return <header className="site-header">
    <button className="brand-button" onClick={() => go('home')}><Logo/></button>
    <nav className={open ? 'open' : ''}>
      <a href="/events">All events</a>
      <button onClick={() => go('home')}>How it works</button>
      <button className={screen === 'scanner' ? 'active' : ''} onClick={() => go('scanner')}>Staff mode</button>
      <button className={screen === 'dashboard' ? 'active' : ''} onClick={() => go('dashboard')}>Attendees</button>
    </nav>
    <div className="header-actions">
      <a className="manage-link" href="/?staff=events">Manage events</a>
      <button className="nav-cta" onClick={() => go('register')}>Register now</button>
    </div>
    <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation"><Icon name={open ? 'x' : 'menu'}/></button>
  </header>
}

function Shell({ screen, go, children, bare = false }: { screen: Screen; go: (s: Screen) => void; children: React.ReactNode; bare?: boolean }) {
  return <div className="app-shell"><Ambient/>{!bare && <Header screen={screen} go={go}/>}<main id="main-content">{children}</main></div>
}

function Landing({ go, event }: { go: (s: Screen) => void; event?: ScanovaEvent }) {
  return <div className="landing">
    <section className="hero section">
      <HeroMark/>
      <div className="hero-copy">
        <h1>Your next big idea<br/>starts with <em>one scan.</em></h1>
        <p>Register once, receive your QR ticket, and walk into your next event with a single scan. No accounts. No hassle.</p>
        <div className="button-row">
          <button className="primary" onClick={() => go('register')}>Register now</button>
          <a className="secondary" href="/events">See all events</a>
        </div>
        <div className="event-admin-actions">
          <span>Planning another seminar?</span>
          <a href="/?staff=events&new=1">Create an event</a>
          <i/>
          <a href="/?staff=events">Manage events</a>
        </div>
      </div>
      <div className="hero-rule"><span>01</span><i/><span>SCANOVA / 2026</span></div>
    </section>

    <section className="preview-section section">
      <div className="section-heading">
        <span className="kicker">One seamless journey</span>
        <h2>From registration<br/>to <em>right this way.</em></h2>
        <p>Every touchpoint designed to keep attendees moving and organizers in control.</p>
      </div>
      <div className="device-stage" aria-hidden="true">
        <div className="device reg-device glass">
          <div className="device-bar"><Logo compact/><span>Register</span></div>
          <small>YOUR DETAILS</small><h4>Reserve your seat.</h4>
          <label>Full name</label><div className="fake-input">Maria Reyes</div>
          <label>Email address</label><div className="fake-input">attendee@example.invalid</div>
          <button className="mini-primary" tabIndex={-1}>Register & get my QR</button>
        </div>
        <div className="device ticket-device glass">
          <span className="tag">YOU'RE IN</span><h4>Cloud & AI<br/>Seminar 2026</h4>
          <div className="mini-ticket"><QR small/><div><small>TICKET HOLDER</small><strong>Maria Reyes</strong><small>SCN-2026-00482</small></div></div>
        </div>
        <div className="device scanner-device">
          <div className="camera-noise"/><div className="viewfinder mini"><i/><i/><i/><i/><span/></div>
          <p>Align QR code within frame</p><div className="scanner-count"><small>Staff check-in</small></div>
        </div>
      </div>
    </section>

    <section className="steps section" id="how">
      <div className="section-heading compact"><span className="kicker">Effortless by design</span><h2>Four steps. <em>Zero friction.</em></h2></div>
      <div className="step-grid">
        {[
          ['01','users','Complete the form','Share only what the event needs. No account or password.'],
          ['02','mail','Receive your ticket','Your unique QR ticket arrives directly in your inbox.'],
          ['03','scan','Present your QR','Open your ticket on any phone or bring a printed copy.'],
          ['04','check','Walk right in','One scan confirms your place and checks you in instantly.'],
        ].map(s => <article className="step-card" key={s[0]}><span>{s[0]}</span><div className="icon-box"><Icon name={s[1]}/></div><h3>{s[2]}</h3><p>{s[3]}</p></article>)}
      </div>
    </section>

    <section className="event-detail section" id="event">
      <div className="detail-copy"><span className="kicker">The main event</span><h2>{event?.name || <>One day to build what’s <em>next.</em></>}</h2><p>{event?.description || "Browse the event catalog to see what’s coming up."}</p><button className="primary" onClick={() => go('register')}>Save my seat</button></div>
      <div className="detail-panel glass">
        <div className="detail-row"><span><Icon name="calendar"/>Date</span><strong>{event ? dateLabel(event.date) : 'To be announced'}</strong></div>
        <div className="detail-row"><span><Icon name="clock"/>Time</span><strong>{event ? eventTimeLabel(event) : 'To be announced'}</strong></div>
        <div className="detail-row"><span><Icon name="pin"/>Venue</span><strong>{event?.venue || 'To be announced'}</strong></div>
        {event && <div className="seats"><div><span>Seats reserved</span><strong>{event.confirmed} <small>/ {event.capacity}</small></strong></div><div className="progress"><i style={{ width: (event.confirmed / event.capacity * 100) + '%' }}/></div></div>}
      </div>
    </section>
    <Footer go={go}/>
  </div>
}

function Footer({ go }: { go: (s: Screen) => void }) {
  return <footer><div><Logo/><p>Thoughtful registration. Effortless entry.</p></div><div><span>EXPLORE</span><button onClick={() => go('register')}>Register</button><button onClick={() => go('scanner')}>Staff check-in</button><button onClick={() => go('dashboard')}>Attendee list</button></div><div><span>EVENT SUPPORT</span><a href="mailto:hello@scanova.events">hello@scanova.events</a><p>+63 2 8123 4567</p></div><div className="footer-bottom"><span>© 2026 Scanova</span><span>Made for better arrivals.</span></div></footer>
}

function Registration({ go, events, selected, choose, loadError, confirmed }: {
  go: (s: Screen) => void
  events: ScanovaEvent[]
  selected: string
  choose: (id: string) => void
  loadError: string
  confirmed: (ticket: RegistrationTicket) => void
}) {
  const event = events.find(entry => entry.id === selected)
  const [form, setForm] = useState({ name: '', email: '', org: '', phone: '', consent: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const busy = useRef(false)
  const submission = useRef<{ details: string; id: string } | null>(null)
  const update = (key: keyof typeof form, value: string | boolean) => setForm(f => ({ ...f, [key]: value }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy.current) return
    const next: Record<string, string> = {}
    if (!event || event.status !== 'open') next.event = 'Choose an event with open registration.'
    if (form.name.trim().length < 3) next.name = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.org.trim()) next.org = 'Enter your organization, company, or school.'
    const localNumber = form.phone.replace(/[ ().-]/g, '')
    if (!/^9\d{9}$/.test(localNumber)) next.phone = 'Enter your 10-digit Philippine mobile number.'
    if (!form.consent) next.consent = 'Please confirm how we can use your details.'
    setErrors(next)
    if (Object.keys(next).length || !event) return

    const data = { eventId: event.id, name: form.name.trim(), email: form.email.trim().toLowerCase(),
      organization: form.org.trim(), phone: '+63' + localNumber, consent: form.consent }
    const details = JSON.stringify(data)
    if (submission.current?.details !== details) submission.current = { details, id: crypto.randomUUID() }
    busy.current = true
    setLoading(true)
    try {
      const { ticket } = await scanova<{ ticket: RegistrationTicket }>('registrations', { ...data, requestId: submission.current.id })
      confirmed(ticket)
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Registration is temporarily unavailable.' })
    } finally {
      busy.current = false
      setLoading(false)
    }
  }
  return <div className="registration-page">
    <aside className="registration-aside">
      <button className="back-link" onClick={() => go('home')}>Back to event</button>
      <div><span className="kicker">{event ? dateLabel(event.date) : 'Event registration'}</span><h1>One form.<br/><em>One ticket.</em><br/>You’re in.</h1><p>{event ? event.name : "Choose an event to reserve your place."}</p></div>
      <div className="aside-event glass"><div><Icon name="calendar"/><span>{event ? dateLabel(event.date) : 'Date to be announced'}<small>{event && eventTimeLabel(event)}</small></span></div><div><Icon name="pin"/><span>{event?.venue || 'Venue to be announced'}</span></div></div>
    </aside>
    <section className="form-side">
      <div className="mobile-logo"><Logo/></div>
      <form className="registration-form glass" onSubmit={submit} noValidate>
        <span className="form-step">REGISTRATION · 01 / 01</span><h2>Reserve your seat.</h2><p>We’ll send your unique QR ticket to your email.</p>
        <label className={errors.event ? 'field error' : 'field'}><span>Event</span>
          <select required value={selected} onChange={e => choose(e.target.value)} disabled={loading}>
            <option value="">Choose an event</option>
            {events.map(entry => <option key={entry.id} value={entry.id}>{entry.name}{entry.status !== 'open' ? ' · Registration closed' : ' · ' + entry.available + ' seats left'}</option>)}
          </select>{errors.event && <small>{errors.event}</small>}
        </label>
        {([
          ['name','Full name','Maria Reyes','text'],
          ['email','Email address','attendee@example.com','email'],
          ['org','Organization / Company / School','Ateneo de Manila University','text'],
        ] as const).map(([key,label,placeholder,type]) => <label className={errors[key] ? 'field error' : 'field'} key={key}><span>{label}</span><input type={type} value={form[key]} maxLength={key === 'email' ? 254 : key === 'name' ? 150 : 160} placeholder={placeholder} onChange={e => update(key,e.target.value)}/>{errors[key] && <small>{errors[key]}</small>}</label>)}
        <label className={errors.phone ? 'field error' : 'field'}><span>Contact number</span><div className="phone-field"><b>+63</b><input inputMode="numeric" value={form.phone} placeholder="917 123 4567" onChange={e => update('phone',e.target.value)}/></div>{errors.phone && <small>{errors.phone}</small>}</label>
        <label className="check-field"><input type="checkbox" checked={form.consent} onChange={e => update('consent',e.target.checked)}/><i><Icon name="check" size={13}/></i><span>I agree to the use of my details for event registration, ticket delivery, and attendance.</span></label>
        {errors.consent && <small className="consent-error">{errors.consent}</small>}
        {(errors.form || loadError) && <p className="consent-error" role="alert">{errors.form || loadError}</p>}
        <button className="primary submit" disabled={loading || !event || event.status !== 'open'}>{loading ? <><span className="spinner"/> Creating your ticket…</> : <>Register & get my QR</>}</button>
        <p className="privacy">The event organizer and authorized staff use your details to manage registration and attendance. Your name, email, and ticket are shared with the email delivery service.</p>
      </form>
    </section>
  </div>
}

function downloadFile(href: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
}

function addCalendar(event: ScanovaEvent) {
  const escape = (value: string) => value.replaceAll('\\', '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&')
  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')
  const time = (value: string) => new Date(event.date + 'T' + value.slice(0, 5) + ':00+08:00')
    .toISOString().replace(/[-:]|\.\d{3}/g, '')
  const data = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Scanova//Event Registration//EN', 'BEGIN:VEVENT',
    'UID:' + event.id + '@scanova', 'DTSTAMP:' + stamp, 'DTSTART:' + time(event.start), 'DTEND:' + time(event.end),
    'SUMMARY:' + escape(event.name), 'LOCATION:' + escape(event.venue), 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')
  const url = URL.createObjectURL(new Blob([data], { type: 'text/calendar;charset=utf-8' }))
  downloadFile(url, 'scanova-event.ics')
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Ticket({ go, notify, ticket }: { go: (s: Screen) => void; notify: (s: string) => void; ticket: RegistrationTicket }) {
  const { event } = ticket
  return <div className="success-page page-wrap">
    <div className="success-heading"><div className="success-icon"><Icon name="check" size={28}/></div><span className="kicker">Registration complete</span><h1>You’re registered!</h1><p>Your seat is confirmed. Your confirmation email is queued for <strong>{ticket.email}</strong>.</p></div>
    <div className="ticket-layout">
      <article className="digital-ticket">
        <div className="ticket-head"><Logo/><span>ADMIT ONE</span></div>
        <div className="ticket-body">
          <h2>{event.name}</h2>
          <div className="ticket-details"><div><small>ATTENDEE</small><strong>{ticket.name}</strong></div><div><small>ORGANIZATION</small><strong>{ticket.organization}</strong></div><div><small>DATE</small><strong>{dateLabel(event.date)}</strong></div><div><small>TIME</small><strong>{eventTimeLabel(event)}</strong></div><div className="wide"><small>VENUE</small><strong>{event.venue}</strong></div></div>
        </div>
        <div className="perforation"><i/><span/><i/></div>
        <div className="ticket-qr"><div><img src={ticket.qr} width={132} height={132} alt="Your private check-in QR code"/><small>SCAN AT ENTRANCE</small></div><div className="min-w-0"><small>TICKET ID</small><strong className="break-all">{ticket.ticketId}</strong><p>Keep this code visible and ready when you arrive.</p></div></div>
      </article>
      <aside className="ticket-actions glass"><h3>Your ticket is ready.</h3><p>Present this QR at the entrance. Save the image or add the event to your calendar.</p><button className="primary" onClick={() => { downloadFile(ticket.qr, 'scanova-ticket.png'); notify('QR ticket downloaded') }}><Icon name="download"/> Download QR (PNG)</button><button className="secondary" onClick={() => { addCalendar(event); notify('Calendar file ready') }}><Icon name="calendar"/> Add to calendar</button><button className="email-preview-link" onClick={() => go('email')}>Preview confirmation email</button></aside>
    </div>
    <button className="back-home" onClick={() => go('home')}>Return to event page</button>
  </div>
}

function EmailPreview({ go, ticket }: { go: (s: Screen) => void; ticket: RegistrationTicket }) {
  const { event } = ticket
  const subject = 'Your Scanova ticket for ' + event.name
  const content = <div className="email-body"><div className="email-brand"><Logo/></div><div className="email-content"><span>YOU’RE REGISTERED</span><h2>Hi {ticket.name}, your seat is saved.</h2><p>We’re excited to see you at {event.name}. Present this code at the entrance.</p><div className="email-qr"><img src={ticket.qr} width={108} height={108} alt="Check-in QR code"/><strong className="break-all">{ticket.ticketId}</strong></div><p>{dateLabel(event.date)}<br/>{eventTimeLabel(event)}<br/>{event.venue}</p><button onClick={() => addCalendar(event)}>Add to calendar</button></div></div>
  return <div className="email-page page-wrap"><div className="page-heading"><span className="kicker">Messaging preview</span><h1>Your confirmation email.</h1></div>
    <div className="mail-showcase">
      <div className="mail-window glass"><div className="mail-chrome"><i/><i/><i/><span>Inbox / Scanova ticket</span></div><div className="mail-meta"><strong>{subject}</strong></div>{content}</div>
      <div className="phone-mail"><div className="phone-notch"/><div className="mobile-mail-bar">‹ Inbox <span>•••</span></div><div className="mobile-subject">{subject}</div>{content}</div>
    </div>
    <button className="secondary return-button" onClick={() => go('ticket')}>Back to ticket</button>
  </div>
}

function SystemFlow({ go }: { go:(s:Screen)=>void }) {
  const nodes = [
    ['Frontend','users','Registration form','Attendee submits details'],
    ['Backend / Automation','database','Event database','Secure record is created'],
    ['Backend / Automation','scan','QR generator','Unique ticket ID encoded'],
    ['Messaging','mail','Email automation','Confirmation is composed'],
    ['Messaging','mail','Attendee inbox','QR ticket is delivered'],
    ['Event Day','scan','On-site scanner','Staff validates ticket'],
    ['Event Day','check','Database update','Status marked checked in'],
  ]
  return <div className="flow-page page-wrap"><button className="back-link" onClick={()=>go('dashboard')}>Back to dashboard</button><div className="page-heading"><span className="kicker">System architecture</span><h1>One connected flow.<br/><em>Seven clear moments.</em></h1><p>From the first form field to the final check-in, every transition is traceable.</p></div><div className="flow-stage glass"><div className="stage-labels"><span>01 · FRONTEND</span><span>02 · BACKEND / AUTOMATION</span><span>03 · MESSAGING</span><span>04 · EVENT DAY</span></div><div className="flow-nodes">{nodes.map((n,i)=><div className="flow-item" key={n[2]}><article><span className="node-num">{String(i+1).padStart(2,'0')}</span><div className="icon-box"><Icon name={n[1]}/></div><small>{n[0]}</small><h3>{n[2]}</h3><p>{n[3]}</p></article>{i<nodes.length-1&&<div className="connector"><i/><Icon name="arrow" size={15}/></div>}</div>)}</div><div className="flow-note"><Icon name="spark"/><span><strong>Designed for integration</strong> Supabase stores confirmations and attendance. n8n sends the confirmation email after ticket issuance.</span></div></div></div>
}

function DesignSystem({ go }: { go:(s:Screen)=>void }) {
  return <div className="system-page page-wrap"><button className="back-link" onClick={()=>go('dashboard')}>Back to dashboard</button><div className="page-heading"><span className="kicker">Scanova foundations · v1.0</span><h1>Brand & Components</h1><p>A premium dark system built for clarity, confidence, and effortless arrivals.</p></div>
    <section className="system-section logos"><div className="system-title"><span>01</span><h2>Brand marks</h2></div><div className="brand-grid"><div><Logo/><small>PRIMARY / DARK</small></div><div className="light-logo"><Logo/><small>PRIMARY / LIGHT</small></div><div><Logo compact/><small>ICON MARK</small></div></div></section>
    <section className="system-section"><div className="system-title"><span>02</span><h2>Color atmosphere</h2></div><div className="swatches">{[['#10182D','Midnight'],['#131D35','Deep Navy'],['#34445F','Slate'],['#627B9C','Steel Blue'],['#F07870','Soft Coral'],['#FF8B7C','Highlight'],['#52C99A','Success'],['#F2BB63','Warning']].map(c=><div key={c[0]}><i style={{background:c[0]}}/><span>{c[1]}</span><code>{c[0]}</code></div>)}</div></section>
    <section className="system-section two-col"><div><div className="system-title"><span>03</span><h2>Typography</h2></div><div className="type-sheet"><h1>Ideas worth showing up for.</h1><h2>Seminar title</h2><h3>Component heading</h3><p>Body text is designed for calm, clear reading across every touchpoint.</p><small>METADATA / 12PX / 0.16EM</small></div></div><div><div className="system-title"><span>04</span><h2>Controls</h2></div><div className="control-sheet glass"><button className="primary">Primary action</button><button className="secondary">Secondary action</button><button className="primary pressed">Pressed state</button><button className="primary" disabled>Disabled state</button><label className="field"><span>Email address</span><input placeholder="name@email.com"/></label><label className="field error"><span>Email address</span><input value="maria@" readOnly/><small>Enter a valid email address.</small></label></div></div></section>
    <section className="system-section"><div className="system-title"><span>05</span><h2>Status & surfaces</h2></div><div className="component-row"><div className="component-card glass"><span className="badge checked">Checked in</span><span className="badge pending">Pending</span><span className="badge sent">Email sent</span><span className="badge failed">Failed</span></div><div className="component-card glass"><div className="toast-demo"><div className="success-icon"><Icon name="check"/></div><span><strong>Ticket downloaded</strong><small>Saved as a PNG image.</small></span><Icon name="x"/></div></div><div className="component-card scanner-mini"><div className="viewfinder mini"><i/><i/><i/><i/><span/></div></div></div></section>
  </div>
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [events, setEvents] = useState<ScanovaEvent[]>([])
  const [selected, setSelected] = useState('')
  const [loadError, setLoadError] = useState('')
  const [ticket, setTicket] = useState<RegistrationTicket>()
  const [toast, setToast] = useState('')
  const [newEvent, setNewEvent] = useState(false)
  const go = (next: Screen) => {
    setScreen(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    if (query.has('staff')) {
      setScreen('dashboard')
      setNewEvent(query.has('new'))
    } else if (query.has('event')) setScreen('register')
    const controller = new AbortController()
    scanova<{ events: ScanovaEvent[] }>('events', undefined, controller.signal)
      .then(({ events: rows }) => {
        setEvents(rows)
        setSelected(rows.find(event => event.id === query.get('event'))?.id || rows.find(event => event.status === 'open')?.id || '')
      })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.message) })
    return () => controller.abort()
  }, [])
  const notify = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(current => current === message ? '' : current), 2800)
  }
  const confirmed = (result: RegistrationTicket) => {
    setTicket(result)
    setEvents(rows => rows.map(row => row.id === result.event.id ? result.event : row))
    go('ticket')
  }
  const staff = screen === 'scanner' || screen === 'dashboard'
  return <Shell screen={screen} go={go} bare={screen !== 'home'}>
    {screen === 'home' && <Landing go={go} event={events.find(event => event.status === 'open') || events[0]}/>}
    {screen === 'register' && <Registration go={go} events={events} selected={selected} choose={setSelected} loadError={loadError} confirmed={confirmed}/>}
    {screen === 'ticket' && ticket && <Ticket go={go} ticket={ticket} notify={notify}/>}
    {screen === 'email' && ticket && <EmailPreview go={go} ticket={ticket}/>}
    {staff && <StaffArea mode={screen} openEditor={newEvent} go={go} notify={notify} Icon={Icon} Logo={Logo}/>}
    {screen === 'flow' && <SystemFlow go={go}/>}
    {screen === 'system' && <DesignSystem go={go}/>}
    {toast && <div className="global-toast" role="status"><div className="success-icon"><Icon name="check"/></div><span><strong>{toast}</strong></span></div>}
  </Shell>
}
