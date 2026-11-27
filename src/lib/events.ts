import 'server-only'

import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

export type PublicEvent = {
  id: string
  title: string
  slug: string
  startDate: string
  endDate: string
  summary: string
  venue: string
  city: string
  organizer: string
  capacity: number
  registrations: number
  category: string
  status: 'open' | 'upcoming' | 'closed' | 'archived'
  featured?: boolean | null
}

export const getPublicEvents = unstable_cache(async (): Promise<PublicEvent[]> => {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'events',
    overrideAccess: false,
    depth: 0,
    limit: 100,
    sort: 'startDate',
    where: { status: { not_equals: 'archived' } },
  })

  return docs as PublicEvent[]
}, ['events'], { tags: ['events'] })
