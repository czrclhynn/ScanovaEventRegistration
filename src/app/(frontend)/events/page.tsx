'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { scanova } from '@/lib/scanova/client'
import { dateLabel, eventTimeLabel, type ScanovaEvent } from '@/lib/scanova/types'

const statusLabel = {
  open: 'Registration open',
  upcoming: 'Coming soon',
  closed: 'Registration closed',
  archived: 'Archived',
}

export default function EventsPage() {
  const [events, setEvents] = useState<ScanovaEvent[]>([])
  const [failure, setFailure] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    scanova<{ events: ScanovaEvent[] }>('events', undefined, controller.signal)
      .then(result => setEvents(result.events))
      .catch(error => { if (!controller.signal.aborted) setFailure(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

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
          <Link href="/?staff=events">Manage events</Link>
          <Link className="create-event-link" href="/?staff=events&new=1">Create event</Link>
        </nav>
      </header>

      <section className="events-intro">
        <span className="kicker">Discover what’s next</span>
        <h1>Events built for<br/><em>curious minds.</em></h1>
        <p>Explore upcoming seminars, workshops, and community gatherings. One registration, one QR, effortless entry.</p>
        <div className="events-utility">
          <span>{events.length} upcoming events</span>
          <Link href="/?staff=events&new=1">+ Create another event</Link>
        </div>
      </section>

      {loading || failure ? <section className="events-empty glass"><p role={failure ? "alert" : "status"}>{failure || "Loading events…"}</p></section> : events.length ? (
        <section className="events-grid">
          {events.map((event, index) => {
            const remaining = event.available
            const percentage = Math.min(100, Math.round((event.confirmed / event.capacity) * 100))
            return (
              <article className={`catalog-event glass ${index === 0 ? 'featured' : ''}`} key={event.id}>
                <div className="catalog-event-top">
                  <span className={`event-status ${event.status}`}>{statusLabel[event.status]}</span>
                  <span>{remaining} seats left</span>
                </div>
                <h2>{event.name}</h2>
                <p>{event.description}</p>
                <div className="catalog-meta">
                  <div><small>Date</small><strong>{dateLabel(event.date)}</strong></div>
                  <div><small>Time</small><strong>{eventTimeLabel(event)}</strong></div>
                  <div><small>Venue</small><strong>{event.venue}</strong></div>
                </div>
                <div className="catalog-capacity">
                  <span><b>{event.confirmed}</b> of {event.capacity} seats taken</span>
                  <b>{percentage}%</b>
                </div>
                <div className="progress"><i style={{ width: `${percentage}%` }}/></div>
                <div className="catalog-actions">
                  <Link className="primary" href={event.status === "open" ? "/?event=" + event.id : "/#event"}>{event.status === "open" ? "Register" : "Event site"}</Link>
                  <Link href="/?staff=events">Manage</Link>
                </div>
              </article>
            )
          })}
        </section>
      ) : (
        <section className="events-empty glass">
          <h2>No events are scheduled yet.</h2>
          <p>Create the first event in the Scanova event manager.</p>
          <Link className="primary" href="/?staff=events&new=1">Create event</Link>
        </section>
      )}
    </main>
  )
}
