-- The mock-test RPCs are consumed only by the server-side /api/questions and /api/grade routes.
-- Those routes must use SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY); never grant the browser anon role direct execution.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.create_mock_test_session(uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_mock_test(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_mock_test_session(uuid, jsonb, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_mock_test(uuid, uuid, jsonb)
  TO service_role;

-- All relations in the SECURITY DEFINER bodies are schema-qualified, so public need not be on search_path.
ALTER FUNCTION public.create_mock_test_session(uuid, jsonb, uuid) SET search_path = pg_catalog;
ALTER FUNCTION public.submit_mock_test(uuid, uuid, jsonb) SET search_path = pg_catalog;

COMMENT ON FUNCTION public.create_mock_test_session(uuid, jsonb, uuid) IS
  'Server-side mock-test session creation; execute only through privileged server routes.';
COMMENT ON FUNCTION public.submit_mock_test(uuid, uuid, jsonb) IS
  'Server-side mock-test grading; execute only through privileged server routes.';

COMMIT;
