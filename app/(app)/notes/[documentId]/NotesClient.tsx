'use client'

import { NotesViewModel } from '@/app/actions/notes-actions'
import { CitationBadge } from '@/components/CitationBadge'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'

interface NotesClientProps {
  viewModel: NotesViewModel
}

export function NotesClient({ viewModel }: NotesClientProps) {
  const { document, notes } = viewModel

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <Link 
          href={`/documents/${document.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Notes
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">{document.title} - Study Notes</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 md:p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-4">Executive Summary</h2>
          <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-blue-600">
             <ReactMarkdown>{notes.summary}</ReactMarkdown>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 px-2">Key Topics</h2>
        
        {notes.topics.map((topic, idx) => (
          <div key={topic.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">{topic.name}</h3>
            
            <div className="prose prose-slate max-w-none mb-6">
               <ReactMarkdown>{topic.description}</ReactMarkdown>
            </div>
            
            {topic.sourceChunkId && (
              <div className="border-t border-slate-100 pt-4">
                <CitationBadge chunkId={topic.sourceChunkId} documentId={document.id} />
              </div>
            )}
          </div>
        ))}
        
        {notes.topics.length === 0 && (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
             No specific topics were generated for this document.
          </div>
        )}
      </div>
    </div>
  )
}
