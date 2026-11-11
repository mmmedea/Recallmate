import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

async function collectUserFiles(admin: ReturnType<typeof createAdminClient>, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = []
  const pageSize = 100
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`Storage listing failed for ${bucket}`)
    if (!data?.length) break

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id) files.push(path)
      else files.push(...await collectUserFiles(admin, bucket, path))
    }
    if (data.length < pageSize) break
  }
  return files
}

export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) return NextResponse.json({ error: 'Account deletion is not configured' }, { status: 503 })

  const admin = createAdminClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    // Remove all user-owned files from the application's private storage folders.
    // Only paths rooted at this authenticated user's UUID are ever considered.
    for (const bucket of ['study_materials', 'reviewers']) {
      const paths = await collectUserFiles(admin, bucket, user.id)
      for (let index = 0; index < paths.length; index += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100))
        if (error) throw new Error(`Storage cleanup failed for ${bucket}`)
      }
    }
  } catch (error) {
    console.error('[account-delete] storage cleanup failed:', error)
    return NextResponse.json({ error: 'Account files could not be safely removed. The account was not deleted.' }, { status: 503 })
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('[account-delete] auth deletion failed:', deleteError)
    return NextResponse.json({ error: 'Could not delete account' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
