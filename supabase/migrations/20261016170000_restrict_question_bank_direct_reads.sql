-- Prevent direct public table reads from revealing answer_index or explanations.
-- The application serves sanitized question rows through /api/questions and grades on the server.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.question_bank FROM PUBLIC, anon, authenticated;
REVOKE SELECT (
  id, exam_id, subject, topic, question_hi, question_en, options,
  answer_index, explanation_hi, explanation_en, difficulty, source_type,
  source_year, frequency_score, recency_score, topic_score, prediction_score,
  verified, active, created_at, source_name, source_url, fingerprint
) ON TABLE public.question_bank FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS public_read_active_questions ON public.question_bank;

COMMENT ON TABLE public.question_bank IS
  'Restricted to server-side access. Public practice questions are exposed through a sanitized API that omits answer keys and explanations until grading/review.';

COMMIT;
