import { getDocumentLifecycle } from "@/app/actions/document-actions"
import { requireUser } from "@/lib/security"
import { redirect, notFound } from "next/navigation"
import StudyHubClient from "./StudyHubClient"

export default async function StudyHubPage({ params }: { params: { id: string } }) {
  // Authorize User
  try {
    await requireUser()
  } catch (error) {
    redirect('/login')
  }

  // Fetch canonical lifecycle state
  const { success, data, status } = await getDocumentLifecycle(params.id)

  // Explicit non-disclosure convention (404 for unauthorized)
  if (!success || !data) {
    if (status === 404 || status === 403) {
      notFound()
    }
    throw new Error('Failed to load document')
  }

  const { extraction } = data

  // Study Hub Availability Rule: 
  // If extraction isn't ready, the document isn't usable.
  // Failed extraction passes through so the user can see the recovery state.
  if (extraction.status !== 'completed' && extraction.status !== 'failed') {
    redirect(`/documents/${params.id}/process`)
  }

  return <StudyHubClient initialSummary={data} />
}
