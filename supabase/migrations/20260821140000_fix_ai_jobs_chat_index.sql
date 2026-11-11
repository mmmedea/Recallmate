-- Drop the restrictive indexes that block multiple chat jobs per document
DROP INDEX IF EXISTS idx_ai_jobs_single_active_per_generation;
DROP INDEX IF EXISTS idx_ai_jobs_single_success_per_generation;

-- Recreate them excluding 'chat' operations, since Chat turns are not bound by a single run per document version
CREATE UNIQUE INDEX idx_ai_jobs_single_active_per_generation 
ON public.ai_jobs (document_id, operation, generation_version) 
WHERE status IN ('queued', 'processing') AND operation != 'chat';

CREATE UNIQUE INDEX idx_ai_jobs_single_success_per_generation 
ON public.ai_jobs (document_id, operation, generation_version) 
WHERE status = 'completed' AND operation != 'chat';
