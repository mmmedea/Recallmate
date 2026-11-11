'use client'

import { useState } from 'react'
import { getCitation, Citation } from '@/app/actions/citation-actions'
import { BookOpen } from 'lucide-react'
import { DiamondLoader } from '@/components/DiamondLoader'

interface CitationBadgeProps {
  chunkId: string
  documentId: string
}

export function CitationBadge({ chunkId, documentId }: CitationBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [citation, setCitation] = useState<Citation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    if (!isOpen && !citation && !loading) {
      setLoading(true)
      const res = await getCitation(chunkId, documentId)
      if (res.success && res.data) {
        setCitation(res.data)
      } else {
        setError(res.error || 'Failed to load citation')
      }
      setLoading(false)
    }
    setIsOpen(!isOpen)
  }

  return (
    <div className="relative inline-block mt-2">
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors border border-slate-200"
        aria-expanded={isOpen}
      >
        <BookOpen className="w-3.5 h-3.5" />
        Source Citation
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-10 p-4 text-left">
          {loading ? (
            <div className="flex min-h-20 items-center justify-center gap-2 p-4 text-sm text-violet-600">
              <DiamondLoader variant="inline" label="Loading citation" />
              <span>Loading citation…</span>
            </div>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : citation ? (
            <div>
              <div className="font-semibold text-sm text-slate-900 mb-1">
                {citation.label}
              </div>
              <p className="text-sm text-slate-600 italic">"{citation.excerpt}"</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
