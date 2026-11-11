-- MANUAL ROLLBACK ONLY.
-- This permanently deletes every active private answer key for identification
-- quizzes. Do not run while the application serves identification questions.
-- The DROP intentionally omits CASCADE so unexpected dependencies stop rollback.
BEGIN;

DROP TABLE IF EXISTS public.quiz_identification_answer_keys;

COMMIT;
