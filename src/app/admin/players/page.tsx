import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlayerAdmin from './player-admin'

const ADMIN_EMAIL = 'sherief.elabbady@gmail.com'

export default async function AdminPlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/')

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Player Admin</h1>
        <PlayerAdmin />
      </div>
    </main>
  )
}
