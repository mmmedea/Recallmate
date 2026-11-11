import { getQuizViewModel } from '@/app/actions/quiz-actions'
import { QuizClient } from './QuizClient'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function QuizPage({ params }: { params: { documentId: string } }) {
  const { documentId } = params

  const { success, data, error } = await getQuizViewModel(documentId)

  if (!success || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
        <h2 className="text-xl font-semibold mb-2">Failed to load Quiz</h2>
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

  return <QuizClient viewModel={data} />
}
