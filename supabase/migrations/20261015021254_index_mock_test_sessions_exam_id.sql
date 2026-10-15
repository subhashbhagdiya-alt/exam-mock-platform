-- Supports joins and foreign-key maintenance for mock-test sessions by exam.
CREATE INDEX IF NOT EXISTS idx_mock_test_sessions_exam_id
  ON public.mock_test_sessions (exam_id);

COMMENT ON INDEX public.idx_mock_test_sessions_exam_id IS
  'Supports joins and foreign-key maintenance for mock test sessions by exam.';
