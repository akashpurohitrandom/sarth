import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server storage configuration is missing.')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function authorizeAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return { response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) }
  const client = getAdminClient()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return { response: NextResponse.json({ error: 'Invalid session.' }, { status: 401 }) }
  const { data: admin, error: adminError } = await client.from('admin_users')
    .select('user_id').eq('user_id', data.user.id).maybeSingle()
  if (adminError) throw adminError
  if (!admin) return { response: NextResponse.json({ error: 'Administrator access required.' }, { status: 403 }) }
  return { client, user: data.user }
}
