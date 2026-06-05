import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { score } = await req.json()
  if (typeof score !== 'number') {
    return NextResponse.json({ error: 'Missing score' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: challenge, error } = await admin
    .from('challenges')
    .select('id, code, challenger_id, challenger_score, responses')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  }

  const responses: Array<{ userId: string; score: number; completedAt: string; username: string }> =
    challenge.responses ?? []

  // Check if user already responded
  if (responses.some((r) => r.userId === user.id)) {
    return NextResponse.json({ alreadyResponded: true })
  }

  // Get username
  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  // Get challenger username
  const { data: challengerProfile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', challenge.challenger_id)
    .single()

  const newResponse = {
    userId: user.id,
    score,
    completedAt: new Date().toISOString(),
    username: profile?.username ?? 'Unknown',
  }

  const updatedResponses = [...responses, newResponse]

  const { error: updateError } = await admin
    .from('challenges')
    .update({ responses: updatedResponses })
    .eq('id', challenge.id)

  if (updateError) {
    console.error('Challenge respond error:', updateError)
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 })
  }

  const challengerScore = challenge.challenger_score
  let result: 'win' | 'loss' | 'tie'
  if (score > challengerScore) result = 'win'
  else if (score < challengerScore) result = 'loss'
  else result = 'tie'

  return NextResponse.json({
    result,
    challengerScore,
    yourScore: score,
    challengerUsername: challengerProfile?.username ?? 'Unknown',
  })
}
