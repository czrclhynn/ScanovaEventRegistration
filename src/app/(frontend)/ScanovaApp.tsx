'use client'

import { FormEvent, useMemo, useState, type ReactElement } from 'react'

type Screen = 'home' | 'register' | 'ticket' | 'email' | 'scanner' | 'dashboard' | 'flow' | 'system'
type ScanResult = 'success' | 'duplicate' | 'invalid' | null

const event = {
  title: 'Build Over Nights: Cloud & AI Seminar 2026',
  date: 'December 12, 2026',
  time: '9:00 AM – 5:00 PM',
  venue: 'Function Hall A, SMX Convention Center',
  organizer: 'AWS User Group Philippines',
}

const attendees = [
  ['8:14 AM', 'Maria Reyes', 'maria.reyes@email.com', 'Ateneo de Manila University', '+63 917 842 1093', 'SCN-2026-00482', 'Checked In', '9:06 AM'],
  ['8:18 AM', 'Paolo Mendoza', 'paolo.m@cloudstaff.ph', 'Cloudstaff Philippines', '+63 918 225 3401', 'SCN-2026-00483', 'Checked In', '9:12 AM'],
  ['8:24 AM', 'Angela Santos', 'angela.santos@dlsu.edu.ph', 'De La Salle University', '+63 917 644 2880', 'SCN-2026-00484', 'Pending', '—'],
  ['8:37 AM', 'Carlo Villanueva', 'carlo@kalibrr.com', 'Kalibrr', '+63 905 413 7670', 'SCN-2026-00485', 'Checked In', '9:18 AM'],
  ['8:42 AM', 'Sofia Garcia', 'sofia.garcia@up.edu.ph', 'UP Diliman', '+63 917 301 5914', 'SCN-2026-00486', 'Pending', '—'],
  ['8:51 AM', 'Miguel Bautista', 'miguel@paymongo.com', 'PayMongo', '+63 927 518 2038', 'SCN-2026-00487', 'Checked In', '9:25 AM'],
  ['9:03 AM', 'Nicole Ramos', 'nicole.ramos@ust.edu.ph', 'University of Santo Tomas', '+63 917 690 4432', 'SCN-2026-00488', 'Pending', '—'],
  ['9:12 AM', 'Joshua Cruz', 'jcruz@globe.com.ph', 'Globe Telecom', '+63 998 477 1265', 'SCN-2026-00489', 'Checked In', '9:31 AM'],
  ['9:26 AM', 'Bea Navarro', 'bea@thinkingmachin.es', 'Thinking Machines', '+63 917 280 9481', 'SCN-2026-00490', 'Pending', '—'],
  ['9:41 AM', 'Luis Fernandez', 'luis.fernandez@mapua.edu.ph', 'Mapúa University', '+63 905 736 2210', 'SCN-2026-00491', 'Pending', '—'],
]

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
      <a className="manage-link" href="/admin/collections/events">Manage events</a>
      <button className="nav-cta" onClick={() => go('register')}>Register now</button>
    </div>
    <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation"><Icon name={open ? 'x' : 'menu'}/></button>
  </header>
}

function Shell({ screen, go, children, bare = false }: { screen: Screen; go: (s: Screen) => void; children: React.ReactNode; bare?: boolean }) {
  return <div className="app-shell"><Ambient/>{!bare && <Header screen={screen} go={go}/>}<main id="main-content">{children}</main></div>
}

function Landing({ go }: { go: (s: Screen) => void }) {
  return <div className="landing">
    <section className="hero section">
      <HeroMark/>
      <div className="hero-copy">
        <h1>Your next big idea<br/>starts with <em>one scan.</em></h1>
        <p>Register once, receive your QR ticket, and walk into Build Over Nights with a single scan. No accounts. No hassle.</p>
        <div className="button-row">
          <button className="primary" onClick={() => go('register')}>Register now</button>
          <a className="secondary" href="/events">See all events</a>
        </div>
        <div className="event-admin-actions">
          <span>Planning another seminar?</span>
          <a href="/admin/collections/events/create">Create an event</a>
          <i/>
          <a href="/admin/collections/events">Manage events</a>
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
      <div className="device-stage">
        <div className="device reg-device glass">
          <div className="device-bar"><Logo compact/><span>Register</span></div>
          <small>YOUR DETAILS</small><h4>Reserve your seat.</h4>
          <label>Full name</label><div className="fake-input">Maria Reyes</div>
          <label>Email address</label><div className="fake-input">maria.reyes@email.com</div>
          <button className="mini-primary">Register & get my QR</button>
        </div>
        <div className="device ticket-device glass">
          <span className="tag">YOU'RE IN</span><h4>Cloud & AI<br/>Seminar 2026</h4>
          <div className="mini-ticket"><QR small/><div><small>TICKET HOLDER</small><strong>Maria Reyes</strong><small>SCN-2026-00482</small></div></div>
        </div>
        <div className="device scanner-device">
          <div className="camera-noise"/><div className="viewfinder mini"><i/><i/><i/><i/><span/></div>
          <p>Align QR code within frame</p><div className="scanner-count">148 <small>/ 212 checked in</small></div>
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
      <div className="detail-copy"><span className="kicker">The main event</span><h2>One day to build what’s <em>next.</em></h2><p>Join builders, students, and cloud practitioners for a full day of practical sessions, live demos, and meaningful connections.</p><button className="primary" onClick={() => go('register')}>Save my seat</button></div>
      <div className="detail-panel glass">
        <div className="detail-row"><span><Icon name="calendar"/>Date</span><strong>{event.date}</strong></div>
        <div className="detail-row"><span><Icon name="clock"/>Time</span><strong>{event.time}</strong></div>
        <div className="detail-row"><span><Icon name="pin"/>Venue</span><strong>SMX Convention Center<br/><small>Pasay City, Metro Manila</small></strong></div>
        <div className="detail-row"><span><Icon name="users"/>Organizer</span><strong>{event.organizer}</strong></div>
        <div className="seats"><div><span>Seats filling up</span><strong>212 <small>/ 300</small></strong></div><div className="progress"><i/></div></div>
      </div>
    </section>
    <Footer go={go}/>
  </div>
}

function Footer({ go }: { go: (s: Screen) => void }) {
  return <footer><div><Logo/><p>Thoughtful registration. Effortless entry.</p></div><div><span>EXPLORE</span><button onClick={() => go('register')}>Register</button><button onClick={() => go('scanner')}>Staff check-in</button><button onClick={() => go('dashboard')}>Attendee list</button></div><div><span>EVENT SUPPORT</span><a href="mailto:hello@scanova.events">hello@scanova.events</a><p>+63 2 8123 4567</p></div><div className="footer-bottom"><span>© 2026 Scanova</span><span>Made for better arrivals.</span></div></footer>
}

function Registration({ go }: { go: (s: Screen) => void }) {
  const [form, setForm] = useState({ name: '', email: '', org: '', phone: '', consent: false })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const update = (key: string, value: string | boolean) => setForm(f => ({ ...f, [key]: value }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string,string> = {}
    if (form.name.trim().length < 3) next.name = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.'
    if (!form.org.trim()) next.org = 'Enter your organization, company, or school.'
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g,''))) next.phone = 'Enter a valid 10-digit mobile number.'
    if (!form.consent) next.consent = 'Please confirm to receive your ticket by email.'
    setErrors(next)
    if (!Object.keys(next).length) { setLoading(true); setTimeout(() => { setLoading(false); go('ticket') }, 850) }
  }
  return <div className="registration-page">
    <aside className="registration-aside">
      <button className="back-link" onClick={() => go('home')}>Back to event</button>
      <div><span className="kicker">December 12, 2026</span><h1>One form.<br/><em>One ticket.</em><br/>You’re in.</h1><p>Join 300 builders for a day of cloud, AI, and ideas worth sharing.</p></div>
      <div className="aside-event glass"><div><Icon name="calendar"/><span>{event.date}<small>{event.time}</small></span></div><div><Icon name="pin"/><span>SMX Convention Center<small>Pasay City, Metro Manila</small></span></div></div>
    </aside>
    <section className="form-side">
      <div className="mobile-logo"><Logo/></div>
      <form className="registration-form glass" onSubmit={submit} noValidate>
        <span className="form-step">REGISTRATION · 01 / 01</span><h2>Reserve your seat.</h2><p>We’ll send your unique QR ticket to your email.</p>
        {[
          ['name','Full name','Maria Reyes','text'],
          ['email','Email address','maria.reyes@email.com','email'],
          ['org','Organization / Company / School','Ateneo de Manila University','text'],
        ].map(([key,label,placeholder,type]) => <label className={errors[key] ? 'field error' : 'field'} key={key}><span>{label}</span><input type={type} value={(form as any)[key]} placeholder={placeholder} onChange={e => update(key,e.target.value)}/>{errors[key] && <small>{errors[key]}</small>}</label>)}
        <label className={errors.phone ? 'field error' : 'field'}><span>Contact number</span><div className="phone-field"><b>+63</b><input inputMode="numeric" value={form.phone} placeholder="917 123 4567" onChange={e => update('phone',e.target.value)}/></div>{errors.phone && <small>{errors.phone}</small>}</label>
        <label className="check-field"><input type="checkbox" checked={form.consent} onChange={e => update('consent',e.target.checked)}/><i><Icon name="check" size={13}/></i><span>I agree to receive my ticket and event updates by email.</span></label>
        {errors.consent && <small className="consent-error">{errors.consent}</small>}
        <button className="primary submit" disabled={loading}>{loading ? <><span className="spinner"/> Creating your ticket…</> : <>Register & get my QR</>}</button>
        <p className="privacy">Your details are only used for this event. No account will be created.</p>
      </form>
    </section>
  </div>
}

function Ticket({ go, notify }: { go: (s: Screen) => void; notify: (s: string) => void }) {
  const download = () => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 800
    const c = canvas.getContext('2d')!; c.fillStyle = '#fff'; c.fillRect(0,0,800,800); c.fillStyle = '#10182D'
    for(let y=0;y<25;y++) for(let x=0;x<25;x++) if ((x*y+x*3+y*7)%5<2) c.fillRect(80+x*25,80+y*25,22,22)
    const a=document.createElement('a'); a.download='scanova-ticket-SCN-2026-00482.png'; a.href=canvas.toDataURL(); a.click(); notify('QR ticket downloaded')
  }
  const calendar = () => {
    const data='BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:20261212T010000Z\nDTEND:20261212T090000Z\nSUMMARY:Build Over Nights: Cloud & AI Seminar 2026\nLOCATION:SMX Convention Center, Pasay City\nEND:VEVENT\nEND:VCALENDAR'
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type:'text/calendar'})); a.download='build-over-nights.ics'; a.click(); notify('Calendar file ready')
  }
  return <div className="success-page page-wrap">
    <div className="success-heading"><div className="success-icon"><Icon name="check" size={28}/></div><span className="kicker">Registration complete</span><h1>You’re registered!</h1><p>We sent your QR ticket to <strong>maria.reyes@email.com</strong></p></div>
    <div className="ticket-layout">
      <article className="digital-ticket">
        <div className="ticket-head"><Logo/><span>ADMIT ONE</span></div>
        <div className="ticket-body">
          <span className="kicker">BUILD OVER NIGHTS</span><h2>Cloud & AI<br/>Seminar 2026</h2>
          <div className="ticket-details"><div><small>ATTENDEE</small><strong>Maria Reyes</strong></div><div><small>ORGANIZATION</small><strong>Ateneo de Manila University</strong></div><div><small>DATE</small><strong>Dec 12, 2026</strong></div><div><small>TIME</small><strong>9:00 AM – 5:00 PM</strong></div><div className="wide"><small>VENUE</small><strong>Function Hall A, SMX Convention Center</strong></div></div>
        </div>
        <div className="perforation"><i/><span/><i/></div>
        <div className="ticket-qr"><div><QR/><small>SCAN AT ENTRANCE</small></div><div><small>TICKET ID</small><strong>SCN-2026-00482</strong><p>Keep this code visible and ready when you arrive.</p></div></div>
      </article>
      <aside className="ticket-actions glass"><h3>Your ticket is ready.</h3><p>Please present this QR at the entrance. You can use the email, download the image, or add the event to your calendar.</p><button className="primary" onClick={download}><Icon name="download"/> Download QR (PNG)</button><button className="secondary" onClick={calendar}><Icon name="calendar"/> Add to calendar</button><button className="text-button" onClick={() => notify('Email resend simulated — no email was sent')}><Icon name="mail"/> Resend email</button><button className="email-preview-link" onClick={() => go('email')}>Preview confirmation email</button></aside>
    </div>
    <button className="back-home" onClick={() => go('home')}>Return to event page</button>
  </div>
}

function EmailPreview({ go }: { go: (s: Screen) => void }) {
  return <div className="email-page page-wrap"><div className="page-heading"><span className="kicker">Messaging preview</span><h1>Your ticket, delivered.</h1><p>A responsive confirmation email designed for desktop and mobile inboxes.</p></div>
    <div className="mail-showcase">
      <div className="mail-window glass"><div className="mail-chrome"><i/><i/><i/><span>Inbox / Scanova ticket</span></div><div className="mail-meta"><strong>Your Scanova ticket for Build Over Nights: Cloud & AI Seminar 2026</strong><span>Scanova Events &lt;hello@scanova.events&gt;</span></div><EmailBody/></div>
      <div className="phone-mail"><div className="phone-notch"/><div className="mobile-mail-bar">‹ Inbox <span>•••</span></div><div className="mobile-subject">Your Scanova ticket for Build Over Nights…</div><EmailBody/></div>
    </div>
    <button className="secondary return-button" onClick={() => go('ticket')}>Back to ticket</button>
  </div>
}

function EmailBody() {
  return <div className="email-body"><div className="email-brand"><Logo/></div><div className="email-content"><span>YOU’RE REGISTERED</span><h2>Hi Maria, your seat<br/>is officially saved.</h2><p>We’re excited to see you at Build Over Nights: Cloud & AI Seminar 2026. Present the QR code below at the entrance.</p><div className="email-qr"><QR small/><strong>SCN-2026-00482</strong></div><div className="email-info"><div><b>DEC</b><strong>12</strong></div><p><strong>Saturday, December 12, 2026</strong><br/>9:00 AM – 5:00 PM<br/>SMX Convention Center, Pasay City</p></div><button>Add to calendar</button><small>Need help? Contact hello@scanova.events</small></div></div>
}

function Scanner({ go, checked, setChecked }: { go: (s: Screen) => void; checked: number; setChecked: (n: number) => void }) {
  const [started, setStarted] = useState(false)
  const [result, setResult] = useState<ScanResult>(null)
  const [manual, setManual] = useState(false)
  const [torch, setTorch] = useState(false)
  const showResult = (r: ScanResult) => { setResult(r); if(r === 'success') setChecked(checked + 1) }
  if (!started) return <div className="scanner-entry"><Ambient/><button className="scanner-exit" onClick={() => go('home')}>Exit staff mode</button><div className="entry-card glass"><Logo/><div className="scanner-icon"><Icon name="scan" size={34}/></div><span className="kicker">Event operations</span><h1>Staff Check-in<br/>Mode</h1><p>{event.title}</p><div className="entry-meta"><span><Icon name="calendar"/>{event.date}</span><span><Icon name="pin"/>SMX Convention Center</span></div><button className="primary" onClick={() => setStarted(true)}>Start scanning</button><small>No login required · Front-end simulation</small></div></div>
  return <div className="live-scanner">
    <div className="camera-noise"/><div className={torch ? 'torch-glow on' : 'torch-glow'}/>
    <div className="scanner-top"><button onClick={() => setStarted(false)}><Icon name="x"/></button><div><Logo compact/><span>Staff check-in</span></div><span className="live-dot">LIVE</span></div>
    <div className="scan-copy"><h2>Scan attendee ticket</h2><p>Align the QR code within the frame.</p></div>
    <button className="scan-target" onClick={() => showResult('success')} aria-label="Simulate valid scan"><div className="viewfinder"><i/><i/><i/><i/><span/></div></button>
    <div className="scanner-controls"><button className={torch ? 'on' : ''} onClick={() => setTorch(!torch)}><Icon name="torch"/><span>Torch</span></button><div className="check-counter"><strong>{checked}</strong><span>of 212<br/>checked in</span></div><button onClick={() => setManual(true)}><Icon name="search"/><span>Manual search</span></button></div>
    <div className="simulation-switch"><span>Simulate result:</span><button onClick={() => showResult('success')}>Valid</button><button onClick={() => showResult('duplicate')}>Duplicate</button><button onClick={() => showResult('invalid')}>Invalid</button></div>
    {manual && <ManualSearch close={() => setManual(false)} checkin={() => { setChecked(checked + 1); setManual(false); setResult('success') }}/>}
    {result && <ScanSheet result={result} close={() => setResult(null)} manual={() => {setResult(null);setManual(true)}}/>}
  </div>
}

function ScanSheet({ result, close, manual }: { result: Exclude<ScanResult,null>; close: () => void; manual: () => void }) {
  const data = result === 'success'
    ? { title: 'Checked In', icon: 'check', sub: 'Entry confirmed at 9:42 AM', person: true }
    : result === 'duplicate'
    ? { title: 'Already Checked In', icon: 'clock', sub: 'Previous check-in at 9:06 AM', person: true }
    : { title: 'Ticket Not Found', icon: 'x', sub: 'This QR code isn’t linked to this event.', person: false }
  return <div className={`result-overlay ${result}`}><div className="result-sheet"><div className="result-symbol"><Icon name={data.icon} size={34}/></div><span className="result-label">{result === 'success' ? 'ENTRY CONFIRMED' : result === 'duplicate' ? 'DUPLICATE SCAN' : 'INVALID QR'}</span><h2>{data.title}</h2><p>{data.sub}</p>{data.person && <div className="person-card"><div>MR</div><span><strong>Maria Reyes</strong><small>Ateneo de Manila University</small><small>SCN-2026-00482</small></span></div>}<button className="result-primary" onClick={close}>{result === 'success' ? 'Scan next' : result === 'duplicate' ? 'Back to scanner' : 'Try again'}</button>{result === 'invalid' && <button className="result-secondary" onClick={manual}>Search manually</button>}</div></div>
}

function ManualSearch({ close, checkin }: { close: () => void; checkin: () => void }) {
  const [query, setQuery] = useState('')
  return <div className="manual-overlay"><div className="manual-sheet"><div className="sheet-handle"/><div className="manual-head"><div><span className="kicker">Fallback check-in</span><h2>Find an attendee</h2></div><button onClick={close}><Icon name="x"/></button></div><label className="search-box"><Icon name="search"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, email, or ticket ID"/></label><p className="search-hint">{query ? '1 matching attendee' : 'Recent registrations'}</p><div className="search-result"><div className="avatar">MR</div><div><strong>Maria Reyes</strong><span>maria.reyes@email.com</span><small>SCN-2026-00482 · Pending</small></div><button onClick={checkin}>Check in</button></div><div className="search-result"><div className="avatar">AS</div><div><strong>Angela Santos</strong><span>angela.santos@dlsu.edu.ph</span><small>SCN-2026-00484 · Pending</small></div><button onClick={checkin}>Check in</button></div></div></div>
}

function Dashboard({ go, checked, notify }: { go: (s: Screen) => void; checked: number; notify: (s:string)=>void }) {
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const rows = attendees.filter(a => (filter === 'All' || a[6] === filter) && a.join(' ').toLowerCase().includes(search.toLowerCase()))
  const exportCsv = () => { const csv=['Timestamp,Full Name,Email,Organization,Contact,Ticket ID,Status,Check-in Time',...attendees.map(a=>a.map(x=>`"${x}"`).join(','))].join('\n'); const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='scanova-attendees.csv';a.click();notify('Attendee CSV exported') }
  return <div className="dashboard-page"><aside className="dash-sidebar"><Logo compact/><div><button className="active"><Icon name="users"/><span>Attendees</span></button><button onClick={() => go('scanner')}><Icon name="scan"/><span>Scanner</span></button><button onClick={() => go('flow')}><Icon name="database"/><span>System flow</span></button><button onClick={() => go('system')}><Icon name="spark"/><span>Components</span></button></div><button onClick={() => go('home')}><span>Event site</span></button></aside>
    <div className="dashboard-main"><header><div><span className="kicker">Build Over Nights · 2026</span><h1>Attendee List</h1><p>Registration, ticket delivery, and event check-in status.</p></div><button className="secondary" onClick={exportCsv}><Icon name="download"/> Export CSV</button></header>
      <div className="stat-grid"><Stat label="Total registered" value="212" change="+18 today" icon="users"/><Stat label="Emails sent" value="209" change="98.6% delivered" icon="mail"/><Stat label="Checked in" value={String(checked)} change="70% arrival rate" icon="check" accent/><Stat label="Remaining" value={String(212-checked)} change="of registered guests" icon="clock"/></div>
      <div className="table-card glass"><div className="table-tools"><label><Icon name="search"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search attendees"/></label><div className="filters">{['All','Checked In','Pending'].map(f=><button className={filter===f?'active':''} onClick={()=>setFilter(f)} key={f}>{f}{f==='All'&&<span>212</span>}</button>)}</div><span>Showing {rows.length} records</span></div>
      <div className="table-scroll"><table><thead><tr>{['Timestamp','Full name','Email','Organization','Contact number','Ticket ID','QR status','Email','Check-in','Time'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((a,i)=><tr key={a[5]}><td>{a[0]}</td><td><strong>{a[1]}</strong></td><td>{a[2]}</td><td>{a[3]}</td><td>{a[4]}</td><td><code>{a[5]}</code></td><td><span className="badge sent">Generated</span></td><td><span className="badge sent">{i===8?'Failed':'Sent'}</span></td><td><span className={`badge ${a[6]==='Checked In'?'checked':'pending'}`}>{a[6]}</span></td><td>{a[7]}</td></tr>)}</tbody></table></div><div className="pagination"><span>1–10 of 212</span><div><button disabled>Prev</button><button className="active">1</button><button>2</button><button>3</button><button>…</button><button>22</button><button>Next</button></div></div></div>
    </div></div>
}

function Stat({label,value,change,icon,accent=false}:{label:string,value:string,change:string,icon:string,accent?:boolean}) {
  return <div className={`stat-card glass ${accent?'accent':''}`}><div className="stat-icon"><Icon name={icon}/></div><span>{label}</span><strong>{value}</strong><small>{change}</small></div>
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
  return <div className="flow-page page-wrap"><button className="back-link" onClick={()=>go('dashboard')}>Back to dashboard</button><div className="page-heading"><span className="kicker">System architecture</span><h1>One connected flow.<br/><em>Seven clear moments.</em></h1><p>From the first form field to the final check-in, every transition is traceable.</p></div><div className="flow-stage glass"><div className="stage-labels"><span>01 · FRONTEND</span><span>02 · BACKEND / AUTOMATION</span><span>03 · MESSAGING</span><span>04 · EVENT DAY</span></div><div className="flow-nodes">{nodes.map((n,i)=><div className="flow-item" key={n[2]}><article><span className="node-num">{String(i+1).padStart(2,'0')}</span><div className="icon-box"><Icon name={n[1]}/></div><small>{n[0]}</small><h3>{n[2]}</h3><p>{n[3]}</p></article>{i<nodes.length-1&&<div className="connector"><i/><Icon name="arrow" size={15}/></div>}</div>)}</div><div className="flow-note"><Icon name="spark"/><span><strong>Designed for integration</strong> The prototype simulates each handoff and is structured for future API, email, camera, and database connections.</span></div></div></div>
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
  const [checked, setChecked] = useState(148)
  const [toast, setToast] = useState('')
  const go = (next: Screen) => { setScreen(next); window.scrollTo({top:0,behavior:'smooth'}) }
  const notify = (text:string) => { setToast(text); setTimeout(()=>setToast(''),2800) }
  const bare = ['register','ticket','email','scanner','dashboard','flow','system'].includes(screen)
  return <Shell screen={screen} go={go} bare={bare}>
    {screen === 'home' && <Landing go={go}/>}
    {screen === 'register' && <Registration go={go}/>}
    {screen === 'ticket' && <Ticket go={go} notify={notify}/>}
    {screen === 'email' && <EmailPreview go={go}/>}
    {screen === 'scanner' && <Scanner go={go} checked={checked} setChecked={setChecked}/>}
    {screen === 'dashboard' && <Dashboard go={go} checked={checked} notify={notify}/>}
    {screen === 'flow' && <SystemFlow go={go}/>}
    {screen === 'system' && <DesignSystem go={go}/>}
    {toast && <div className="global-toast"><div className="success-icon"><Icon name="check"/></div><span><strong>{toast}</strong><small>Simulated action completed.</small></span></div>}
  </Shell>
}
