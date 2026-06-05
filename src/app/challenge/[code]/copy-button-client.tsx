'use client'

import { useState } from 'react'

export default function CopyButtonClient({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      prompt('Copy this link:', url)
    }
  }

  return (
    <button
      onClick={copy}
      className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
    >
      {copied ? '✓ Copied!' : '📋 Copy challenge link'}
    </button>
  )
}
