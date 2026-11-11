import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin'

export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isSupabaseAdminConfigured()) return NextResponse.json({ error: 'Account deletion is not configured' }, { status: 503 })
  const admin = createSupabaseAdminClient<any>()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: 'Could not delete account' }, { status: 500 })
  return NextResponse.json({ success: true })
}
