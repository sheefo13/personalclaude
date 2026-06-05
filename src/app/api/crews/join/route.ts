import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { inviteCode } = await req.json()
  if (!inviteCode?.trim()) return NextResponse.json({ error: 'Invite code required' }, { status: 400 })

  const { data: crew, error: crewError } = await supabase
    .from('crews')
    .select('id, name')
    .eq('invite_code', inviteCode.trim().toUpperCase())
    .single()

  if (crewError || !crew) return NextResponse.json({ error: 'Crew not found' }, { status: 404 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('crew_members')
    .upsert({ crew_id: crew.id, user_id: user.id }, { onConflict: 'crew_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ crewId: crew.id, crewName: crew.name })
}
