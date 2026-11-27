import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from './db'
import { ApiError } from './http'

type Profile = { id: string; name: string; role: 'admin' | 'staff' }

export async function authClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new ApiError(503, 'staff_auth_unavailable', 'Staff authentication has not been configured.')
  const store = await cookies()
  return createServerClient(url, key, {
    cookieOptions: { name: 'scanova-session', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) store.set(name, value, options)
      },
    },
  })
}

export async function getProfile(userId: string) {
  const { rows } = await db().query<Profile>(
    "select id, full_name as name, role from public.profiles where id=$1 and role in ('admin','staff')",
    [userId],
  )
  return rows[0]
}

export async function requireStaff(adminOnly = false) {
  const client = await authClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new ApiError(401, 'sign_in_required', 'Sign in to continue.')
  const profile = await getProfile(data.user.id)
  if (!profile || (adminOnly && profile.role !== 'admin')) {
    throw new ApiError(403, 'forbidden', 'This account does not have access to this action.')
  }
  return profile
}
