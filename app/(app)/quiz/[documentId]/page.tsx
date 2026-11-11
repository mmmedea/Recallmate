import { QuizClient } from './QuizClient'

export default async function QuizPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;

  return <QuizClient documentId={documentId} />;
}
