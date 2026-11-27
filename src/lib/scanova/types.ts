export type EventStatus = 'open' | 'upcoming' | 'closed' | 'archived'

export type ScanovaEvent = {
  id: string
  name: string
  description: string
  venue: string
  date: string
  start: string
  end: string
  deadline: string
  capacity: number
  confirmed: number
  available: number
  status: EventStatus
}

export type Attendee = {
  id: string
  name: string
  email: string
  organization: string
  phone: string
  registeredAt: string
  status: 'confirmed' | 'cancelled'
  ticketId: string | null
  ticketStatus: 'active' | 'revoked' | null
  emailStatus: 'pending' | 'sent' | 'failed' | null
  checkedInAt: string | null
}

export type DashboardData = {
  rows: Attendee[]
  total: number
  stats: { total: number; confirmed: number; checkedIn: number; sent: number }
  trends: { date: string; count: number }[]
}

export type CheckinRoster = {
  rows: Pick<Attendee, 'id' | 'name' | 'email' | 'ticketId'>[]
  stats: { checkedIn: number; confirmed: number }
}

export type RegistrationTicket = {
  ticketId: string
  name: string
  email: string
  organization: string
  qr: string
  event: ScanovaEvent
}

export type CheckinResult = {
  result: 'checked_in' | 'already_checked_in' | 'invalid_ticket' | 'event_mismatch' | 'revoked_ticket'
  name?: string
  organization?: string
  event?: string
  time?: string
}

export const dateLabel = (date: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long',
  timeZone: 'Asia/Manila',
}).format(new Date(date + 'T00:00:00+08:00'))

export const timeLabel = (time: string) => new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
}).format(new Date('2026-01-01T' + time.slice(0, 5) + ':00+08:00'))

export const eventTimeLabel = (event: ScanovaEvent) => timeLabel(event.start) + ' – ' + timeLabel(event.end)
