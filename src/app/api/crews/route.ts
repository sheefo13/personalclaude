import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase()
  const admin = createAdminClient()

  const { data: crew, error } = await admin
    .from('crews')
    .insert({ name: name.trim(), invite_code: inviteCode, owner_id: user.id })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('crew_members').insert({ crew_id: crew.id, user_id: user.id })

  return NextResponse.json({ crewId: crew.id, inviteCode })
}
