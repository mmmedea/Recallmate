import { QuizClient } from './QuizClient'

export default async function QuizPage({ params }: { params: { documentId: string } }) {
  const { documentId } = params;

  return <QuizClient documentId={documentId} />;
}
