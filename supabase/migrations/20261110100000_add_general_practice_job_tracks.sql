-- Add board-wide general-practice tracks that already have enough verified questions.
-- The API derives readiness from the live exam configuration and question-bank count.
-- This migration only inserts a track when its active exam meets that threshold.

BEGIN;

INSERT INTO public.job_tracks (
  exam_board, slug, name_hi, name_en, description_hi, description_en,
  status, exam_slug, active, sort_order, exam_category, official_url
)
SELECT
  'MPESB', 'mpesb-general-practice', 'MPESB सामान्य अभ्यास', 'MPESB General Practice',
  'MPESB की सामान्य तैयारी के लिए उपलब्ध verified सवालों पर आधारित board-wide अभ्यास।',
  'Board-wide foundation practice using the currently available verified MPESB general question bank.',
  'question_bank_ready', e.slug, true, 31, 'recruitment',
  'https://esb.mp.gov.in/student_dashboard.htm'
FROM public.exams e
WHERE e.slug = 'mpesb-general'
  AND e.is_active IS TRUE
  AND e.total_questions > 0
  AND (
    SELECT count(*) FROM public.question_bank q
    WHERE q.exam_id = e.id AND q.active IS TRUE AND q.verified IS TRUE
  ) >= e.total_questions
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.job_tracks (
  exam_board, slug, name_hi, name_en, description_hi, description_en,
  status, exam_slug, active, sort_order, exam_category, official_url
)
SELECT
  'SSC', 'ssc-general-practice', 'SSC सामान्य अभ्यास', 'SSC General Practice',
  'SSC की सामान्य तैयारी के लिए उपलब्ध verified सवालों पर आधारित board-wide अभ्यास।',
  'Board-wide foundation practice using the currently available verified SSC general question bank.',
  'question_bank_ready', e.slug, true, 208, 'recruitment',
  'https://ssc.gov.in/'
FROM public.exams e
WHERE e.slug = 'ssc-general'
  AND e.is_active IS TRUE
  AND e.total_questions > 0
  AND (
    SELECT count(*) FROM public.question_bank q
    WHERE q.exam_id = e.id AND q.active IS TRUE AND q.verified IS TRUE
  ) >= e.total_questions
ON CONFLICT (slug) DO NOTHING;

COMMIT;
