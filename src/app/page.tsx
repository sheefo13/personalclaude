import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
      <h1 className="text-5xl font-bold mb-4">Gridlore</h1>
      <p className="text-gray-400 text-lg mb-8">Daily sports trivia grid — coming soon</p>
      <Link
        href="/auth"
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors"
      >
        Sign up / Log in
      </Link>
    </main>
  )
}
