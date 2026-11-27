import Link from 'next/link'
import { getPublicEvents } from '@/lib/events'

const statusLabel = {
  open: 'Registration open',
  upcoming: 'Coming soon',
  closed: 'Registration closed',
  archived: 'Archived',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

export default async function EventsPage() {
  const events = await getPublicEvents()

  return (
    <main className="events-page">
      <div className="ambient" aria-hidden="true"><i className="orb blue"/><i className="orb coral"/><i className="grain"/></div>
      <header className="events-header">
        <Link className="logo" href="/">
          <span className="logo-mark"><i/><i/><i/><i/></span>
          <span>scanova</span>
        </Link>
        <nav>
          <Link className="active" href="/events">All events</Link>
          <Link href="/admin/collections/events">Manage events</Link>
          <Link className="create-event-link" href="/admin/collections/events/create">Create event</Link>
        </nav>
      </header>

      <section className="events-intro">
        <span className="kicker">Discover what’s next</span>
        <h1>Events built for<br/><em>curious minds.</em></h1>
        <p>Explore upcoming seminars, workshops, and community gatherings. One registration, one QR, effortless entry.</p>
        <div className="events-utility">
          <span>{events.length} upcoming events</span>
          <Link href="/admin/collections/events/create">+ Create another event</Link>
        </div>
      </section>

      {events.length ? (
        <section className="events-grid">
          {events.map((event, index) => {
            const remaining = Math.max(0, event.capacity - event.registrations)
            const percentage = Math.min(100, Math.round((event.registrations / event.capacity) * 100))
            return (
              <article className={`catalog-event glass ${index === 0 ? 'featured' : ''}`} key={event.id}>
                <div className="catalog-event-top">
                  <span className={`event-status ${event.status}`}>{statusLabel[event.status]}</span>
                  <span>{remaining} seats left</span>
                </div>
                <span className="event-category">{event.category}</span>
                <h2>{event.title}</h2>
                <p>{event.summary}</p>
                <div className="catalog-meta">
                  <div><small>Date</small><strong>{formatDate(event.startDate)}</strong></div>
                  <div><small>Time</small><strong>{formatTime(event.startDate)} – {formatTime(event.endDate)}</strong></div>
                  <div><small>Venue</small><strong>{event.venue}<br/>{event.city}</strong></div>
                </div>
                <div className="catalog-capacity">
                  <span><b>{event.registrations}</b> of {event.capacity} seats taken</span>
                  <b>{percentage}%</b>
                </div>
                <div className="progress"><i style={{ width: `${percentage}%` }}/></div>
                <div className="catalog-actions">
                  <Link className="primary" href="/#event">View event</Link>
                  <Link href={`/admin/collections/events/${event.id}`}>Manage</Link>
                </div>
              </article>
            )
          })}
        </section>
      ) : (
        <section className="events-empty glass">
          <h2>No events are scheduled yet.</h2>
          <p>Create the first event in the Scanova event manager.</p>
          <Link className="primary" href="/admin/collections/events/create">Create event</Link>
        </section>
      )}
    </main>
  )
}
