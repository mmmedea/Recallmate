export type JobStatus = 'not_requested' | 'queued' | 'processing' | 'ready' | 'failed' | 'inconsistent' | 'cancelled';
export type ExtractionStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'uploaded' | 'analyzing' | 'generating';

export interface DocumentLifecycleSummary {
  document: {
    id: string;
    filename: string;
    createdAt: string;
    status: ExtractionStatus;
    errorMessage: string | null;
  };
  extraction: {
    status: ExtractionStatus;
    errorMessage: string | null;
  };
  notes: {
    status: JobStatus;
    outputId: string | null;
    errorMessage: string | null;
  };
  quiz: {
    status: JobStatus;
    outputId: string | null;
    errorMessage: string | null;
  };
}

function mapJobStatus(job: any, outputReady: boolean): JobStatus {
  if (!job) return 'not_requested';
  if (job.status === 'completed') {
    return outputReady ? 'ready' : 'inconsistent';
  }
  if (job.status === 'queued') return 'queued';
  if (job.status === 'processing') return 'processing';
  if (job.status === 'failed') return 'failed';
  if (job.status === 'cancelled') return 'cancelled';
  return 'inconsistent'; // unexpected status
}

export function computeDocumentLifecycleSummary(
  doc: any,
  jobs: any[],
  notesOutputId: string | null,
  quizOutputId: string | null
): DocumentLifecycleSummary {
  const extractJob = jobs.find(j => j.operation === 'extract_text');
  const notesJob = jobs.find(j => j.operation === 'generate_notes');
  const quizJob = jobs.find(j => j.operation === 'generate_quiz');

  return {
    document: {
      id: doc.id,
      filename: doc.filename,
      createdAt: doc.created_at,
      status: doc.status as ExtractionStatus,
      errorMessage: doc.error_message
    },
    extraction: {
      status: doc.status as ExtractionStatus,
      errorMessage: doc.error_message
    },
    notes: {
      status: mapJobStatus(notesJob, !!notesOutputId),
      outputId: notesOutputId,
      errorMessage: notesJob?.error_message || null
    },
    quiz: {
      status: mapJobStatus(quizJob, !!quizOutputId),
      outputId: quizOutputId,
      errorMessage: quizJob?.error_message || null
    }
  };
}
