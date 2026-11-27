import type { CollectionConfig } from 'payload'
import { revalidateTag } from 'next/cache'

const refreshEvents: NonNullable<CollectionConfig['hooks']>['afterChange'][number] = ({
  doc,
  previousDoc,
}) => {
  revalidateTag('events', 'max')
  if (previousDoc?.slug) revalidateTag(`event:${previousDoc.slug}`, 'max')
  if (doc.slug) revalidateTag(`event:${doc.slug}`, 'max')
  return doc
}

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    group: 'Event Operations',
    useAsTitle: 'title',
    defaultColumns: ['title', 'startDate', 'venue', 'status', 'registrations', 'capacity'],
    description: 'Create and manage seminars available through Scanova.',
  },
  access: {
    read: ({ req }) => req.user ? true : { status: { not_equals: 'archived' } },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  versions: { maxPerDoc: 20 },
  hooks: {
    afterChange: [refreshEvents],
    afterDelete: [
      ({ doc }) => {
        revalidateTag('events', 'max')
        if (doc.slug) revalidateTag(`event:${doc.slug}`, 'max')
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'slug', useAsSlug: 'title' },
    {
      type: 'row',
      fields: [
        { name: 'startDate', type: 'date', required: true, admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'endDate', type: 'date', required: true, admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    { name: 'summary', type: 'textarea', required: true },
    {
      type: 'row',
      fields: [
        { name: 'venue', type: 'text', required: true, admin: { width: '60%' } },
        { name: 'city', type: 'text', required: true, admin: { width: '40%' } },
      ],
    },
    { name: 'organizer', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'capacity', type: 'number', required: true, min: 1, admin: { width: '50%' } },
        { name: 'registrations', type: 'number', required: true, defaultValue: 0, min: 0, admin: { width: '50%', readOnly: true } },
      ],
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: ['Cloud & AI', 'Design & Product', 'Engineering', 'Community'],
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Registration open', value: 'open' },
        { label: 'Coming soon', value: 'upcoming' },
        { label: 'Registration closed', value: 'closed' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
