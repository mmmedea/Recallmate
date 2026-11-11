import { getNotesViewModel } from '@/app/actions/notes-actions'
import { NotesClient } from './NotesClient'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NotesPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params

  const { success, data, error } = await getNotesViewModel(documentId)

  if (!success || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
        <h2 className="text-xl font-semibold mb-2">Failed to load Notes</h2>
        <p className="text-slate-500 mb-6">{error || 'An unknown error occurred.'}</p>
        <Link 
          href={`/documents/${documentId}`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md font-medium hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Study Hub
        </Link>
      </div>
    )
  }

  return <NotesClient viewModel={data} />
}
