import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('notifications').select('id,title,body,kind,event_id,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
  if (error) return NextResponse.json({ error: 'Could not load notifications' }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id)
  const { error } = body.id ? await query.eq('id', body.id) : await query.is('read_at', null)
  if (error) return NextResponse.json({ error: 'Could not update notifications' }, { status: 500 })
  return NextResponse.json({ success: true })
}
